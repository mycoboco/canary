import AVFoundation
@preconcurrency import MediaPlayer
import Observation
import CachingPlayerItem
import WidgetKit

@Observable
@MainActor
final class AudioPlayer {
    enum RepeatMode: String, Sendable {
        case none, all, one
    }

    private(set) var queue: [Song] = []
    private(set) var currentIndex: Int = -1
    private(set) var isPlaying: Bool = false
    private(set) var currentTime: TimeInterval = 0
    private(set) var duration: TimeInterval = 0
    var volume: Float = 1.0 {
        didSet { player.volume = volume }
    }
    var shuffleMode: Bool = UserDefaults.standard.bool(forKey: "shuffleMode") {
        didSet { UserDefaults.standard.set(shuffleMode, forKey: "shuffleMode") }
    }
    private(set) var repeatMode: RepeatMode = RepeatMode(rawValue: UserDefaults.standard.string(forKey: "repeatMode") ?? "") ?? .none {
        didSet { UserDefaults.standard.set(repeatMode.rawValue, forKey: "repeatMode") }
    }

    var currentSong: Song? {
        guard currentIndex >= 0 && currentIndex < queue.count else { return nil }
        return queue[currentIndex]
    }

    private let player = AVPlayer()
    private var originalQueue: [Song] = []
    private var errorCount = 0
    private var timeObserver: Any?
    let cache: AudioCache
    private var apiClient: APIClient?

    nonisolated(unsafe) static var _widgetInstance: AudioPlayer?

    private var widgetRefreshTimer: Timer?
    private var statusObservation: NSKeyValueObservation?
    private var endObserver: NSObjectProtocol?
    private var errorObserver: NSObjectProtocol?
    private var interruptionObserver: NSObjectProtocol?
    private var routeChangeObserver: NSObjectProtocol?

    init(cache: AudioCache = AudioCache()) {
        self.cache = cache
        setupAudioSession()
        setupRemoteCommands()
        setupTimeObserver()
        setupNotifications()
    }

    deinit {
        MainActor.assumeIsolated {
            widgetRefreshTimer?.invalidate()
            statusObservation?.invalidate()
            if let timeObserver { player.removeTimeObserver(timeObserver) }
            if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
            if let errorObserver { NotificationCenter.default.removeObserver(errorObserver) }
            if let interruptionObserver { NotificationCenter.default.removeObserver(interruptionObserver) }
            if let routeChangeObserver { NotificationCenter.default.removeObserver(routeChangeObserver) }
            let center = MPRemoteCommandCenter.shared()
            center.playCommand.removeTarget(nil)
            center.pauseCommand.removeTarget(nil)
            center.nextTrackCommand.removeTarget(nil)
            center.previousTrackCommand.removeTarget(nil)
            center.changePlaybackPositionCommand.removeTarget(nil)
        }
    }

    func configure(apiClient: APIClient) {
        self.apiClient = apiClient
        AudioPlayer._widgetInstance = self
        setupWidgetObservers()
    }

    func stop() {
        widgetRefreshTimer?.invalidate()
        widgetRefreshTimer = nil
        player.pause()
        player.replaceCurrentItem(with: nil)
        isPlaying = false
        queue = []
        currentIndex = -1
        currentTime = 0
        duration = 0
        cachedArtwork = nil
        currentContext = nil
        apiClient = nil
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        SharedConstants.sharedDefaults?.removeObject(forKey: SharedConstants.heartbeatKey)
        updateSharedNowPlaying()
    }

    func isCached(_ song: Song) -> Bool {
        cache.exists(songId: song.id, format: song.format)
    }

    private func setupAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {}
    }

    private func setupTimeObserver() {
        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.5, preferredTimescale: 600),
            queue: .main
        ) { [weak self] time in
            Task { @MainActor in
                guard let self else { return }
                self.currentTime = time.seconds
                self.duration = self.player.currentItem?.duration.seconds ?? 0
                self.updateNowPlaying()
            }
        }
    }

    private func setupNotifications() {
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let info = notification.userInfo,
                  let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }
            let shouldResume = type == .ended &&
                (info[AVAudioSessionInterruptionOptionKey] as? UInt).map {
                    AVAudioSession.InterruptionOptions(rawValue: $0).contains(.shouldResume)
                } ?? false
            Task { @MainActor in
                guard let self else { return }
                if type == .began {
                    self.isPlaying = false
                    self.updateNowPlaying()
                } else if shouldResume {
                    self.player.play()
                    self.isPlaying = true
                    self.updateNowPlaying()
                }
            }
        }
        routeChangeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let info = notification.userInfo,
                  let reasonValue = info[AVAudioSessionRouteChangeReasonKey] as? UInt,
                  let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else { return }
            guard reason == .oldDeviceUnavailable else { return }
            Task { @MainActor in
                guard let self else { return }
                self.player.pause()
                self.isPlaying = false
                self.updateNowPlaying()
            }
        }
    }

    private func observePlayerItem(_ item: AVPlayerItem) {
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        if let errorObserver { NotificationCenter.default.removeObserver(errorObserver) }
        statusObservation?.invalidate()
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.player.currentItem === item else { return }
                self.handleEnded()
            }
        }
        errorObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemFailedToPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.player.currentItem === item else { return }
                self.handleError()
            }
        }
        statusObservation = item.observe(\.status) { [weak self] observed, _ in
            guard observed.status == .failed else { return }
            Task { @MainActor in
                guard let self, self.player.currentItem === observed else { return }
                self.handleError()
            }
        }
    }

    private(set) var currentContext: PlaybackContext?

    func playSong(songs: [Song], index: Int, context: PlaybackContext? = nil) {
        originalQueue = songs
        errorCount = 0
        currentContext = context

        if shuffleMode {
            let selected = songs[index]
            var rest = songs
            rest.remove(at: index)
            rest.shuffle()
            queue = [selected] + rest
            currentIndex = 0
        } else {
            queue = songs
            currentIndex = index
        }
        loadAndPlay(queue[currentIndex])
    }

    func togglePlay() {
        if isPlaying {
            player.pause()
            isPlaying = false
        } else {
            player.play()
            isPlaying = true
        }
        updateNowPlaying()
    }

    func prev() {
        guard currentIndex > 0 else { return }
        errorCount = 0
        currentIndex -= 1
        loadAndPlay(queue[currentIndex])
    }

    func next() {
        errorCount = 0
        let nextIdx = pickNext()
        if nextIdx >= 0 {
            currentIndex = nextIdx
            loadAndPlay(queue[currentIndex])
        } else {
            isPlaying = false
            updateNowPlaying()
        }
    }

    func seek(to time: TimeInterval) {
        player.seek(to: CMTime(seconds: time, preferredTimescale: 600))
        currentTime = time
        updateNowPlaying()
    }

    func toggleShuffle() {
        guard !queue.isEmpty else { return }
        let current = queue[currentIndex]

        if !shuffleMode {
            originalQueue = queue
            var rest = queue
            rest.remove(at: currentIndex)
            rest.shuffle()
            queue = [current] + rest
            currentIndex = 0
        } else {
            let origIdx = originalQueue.firstIndex(where: { $0.id == current.id }) ?? 0
            queue = originalQueue
            currentIndex = origIdx
        }
        shuffleMode.toggle()
    }

    func setRepeatMode(_ mode: RepeatMode) {
        repeatMode = mode
    }

    func toggleRepeat() {
        switch repeatMode {
        case .none: repeatMode = .all
        case .all: repeatMode = .one
        case .one: repeatMode = .none
        }
    }

    private func loadAndPlay(_ song: Song) {
        let item: AVPlayerItem

        if cache.exists(songId: song.id, format: song.format) {
            let fileURL = cache.fileURL(songId: song.id, format: song.format)
            cache.touch(songId: song.id, format: song.format)
            item = AVPlayerItem(url: fileURL)
        } else if let streamURL = apiClient?.streamURL(for: song.id) {
            let cachingItem = CachingPlayerItem(url: streamURL, customFileExtension: song.format)
            cachingItem.delegate = CachingDelegateProxy.shared
            CachingDelegateProxy.shared.register(item: cachingItem, songId: song.id, format: song.format, cache: cache)
            item = cachingItem
        } else {
            return
        }

        observePlayerItem(item)
        player.replaceCurrentItem(with: item)
        player.volume = volume
        player.play()
        isPlaying = true
        startWidgetRefresh()
        currentTime = 0
        duration = 0
        saveContext()
        cachedArtwork = nil
        SharedConstants.sharedDefaults?.removeObject(forKey: SharedConstants.coverDataKey)
        updateNowPlaying()
        fetchNowPlayingArtwork(for: song)
    }

    private func pickNext() -> Int {
        if currentIndex < queue.count - 1 { return currentIndex + 1 }
        if repeatMode == .all { return 0 }
        return -1
    }

    private func handleEnded() {
        errorCount = 0
        if repeatMode == .one {
            player.seek(to: .zero)
            player.play()
            return
        }
        let nextIdx = pickNext()
        if nextIdx >= 0 {
            currentIndex = nextIdx
            loadAndPlay(queue[currentIndex])
        } else {
            isPlaying = false
            updateNowPlaying()
        }
    }

    private var errorSongId: Int?

    private func handleError() {
        let songId = currentSong?.id
        if songId != errorSongId {
            errorCount = 0
            errorSongId = songId
        }
        errorCount += 1
        if errorCount > 3 {
            isPlaying = false
            errorCount = 0
            errorSongId = nil
            updateNowPlaying()
            return
        }
        handleEnded()
    }

    private var cachedArtwork: (songId: Int, artwork: MPMediaItemArtwork)?

    private func startWidgetRefresh() {
        widgetRefreshTimer?.invalidate()
        widgetRefreshTimer = Timer.scheduledTimer(withTimeInterval: 240, repeats: true) { _ in
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    private func updateNowPlaying() {
        guard let song = currentSong else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            SharedConstants.sharedDefaults?.removeObject(forKey: SharedConstants.heartbeatKey)
            updateSharedNowPlaying()
            return
        }
        SharedConstants.sharedDefaults?.set(Date(), forKey: SharedConstants.heartbeatKey)
        let safeDuration = duration.isFinite ? duration : 0
        let safeCurrentTime = currentTime.isFinite ? currentTime : 0
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: song.title,
            MPMediaItemPropertyArtist: song.artist,
            MPMediaItemPropertyAlbumTitle: song.album,
            MPMediaItemPropertyPlaybackDuration: safeDuration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: safeCurrentTime,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0,
        ]
        if let cached = cachedArtwork, cached.songId == song.id {
            info[MPMediaItemPropertyArtwork] = cached.artwork
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        updateSharedNowPlaying()
    }

    private func fetchNowPlayingArtwork(for song: Song) {
        guard let api = apiClient else { return }
        let songId = song.id
        Task { @MainActor [weak self] in
            guard let image = await CoverImageCache.shared.image(for: songId, fetch: {
                await api.fetchCoverImage(for: songId)
            }),
                  let self,
                  self.currentSong?.id == songId else { return }
            let artwork = _makeNowPlayingArtwork(size: image.size, image: image)
            self.cachedArtwork = (songId: songId, artwork: artwork)
            if let thumb = image.preparingThumbnail(of: CGSize(width: 200, height: 200)) {
                SharedConstants.sharedDefaults?.set(thumb.jpegData(compressionQuality: 0.7), forKey: SharedConstants.coverDataKey)
                WidgetCenter.shared.reloadAllTimelines()
            }
            self.updateNowPlaying()
        }
    }

    private var lastSharedSongId: Int?
    private var lastSharedIsPlaying: Bool?

    private func updateSharedNowPlaying() {
        let songId = currentSong?.id
        let playing = isPlaying
        guard songId != lastSharedSongId || playing != lastSharedIsPlaying else { return }
        lastSharedSongId = songId
        lastSharedIsPlaying = playing

        guard let defaults = SharedConstants.sharedDefaults else { return }
        if let song = currentSong {
            SharedConstants.saveNowPlaying(SharedNowPlaying(
                songId: song.id, title: song.title, artist: song.artist,
                album: song.album, isPlaying: isPlaying
            ))
        } else {
            defaults.removeObject(forKey: SharedConstants.nowPlayingKey)
            defaults.removeObject(forKey: SharedConstants.coverDataKey)
        }
        WidgetCenter.shared.reloadAllTimelines()
    }

    func startDefaultPlayback() async {
        guard let api = apiClient else { return }

        if let data = SharedConstants.sharedDefaults?.data(forKey: SharedConstants.lastContextKey),
           let context = try? JSONDecoder().decode(PlaybackContext.self, from: data),
           let songs = try? await fetchSongsForContext(context, api: api),
           !songs.isEmpty {
            let index = songs.firstIndex(where: { $0.id == context.songId }) ?? 0
            playSong(songs: songs, index: index, context: context)
            return
        }

        let playlistId = SharedConstants.sharedDefaults?.object(forKey: SharedConstants.defaultPlaylistIdKey) as? Int
        do {
            let songs: [Song]
            let context: PlaybackContext
            if let playlistId {
                songs = try await api.fetchPlaylistSongs(playlistId)
                guard !songs.isEmpty else { return }
                context = PlaybackContext(type: .playlist, name: "", playlistId: playlistId, songId: songs[0].id)
            } else {
                songs = try await api.fetchSongs()
                guard !songs.isEmpty else { return }
                context = PlaybackContext(type: .allSongs, songId: songs[0].id)
            }
            playSong(songs: songs, index: 0, context: context)
        } catch {}
    }

    private func fetchSongsForContext(_ context: PlaybackContext, api: APIClient) async throws -> [Song] {
        switch context.type {
        case .allSongs:
            return try await api.fetchSongs()
        case .playlist:
            guard let id = context.playlistId else { return [] }
            return try await api.fetchPlaylistSongs(id)
        case .genre:
            return try await api.fetchSongs().filter { $0.genre == context.name }
        case .artist:
            return try await api.fetchSongs().filter { $0.artist == context.name }
        case .album:
            return try await api.fetchSongs().filter {
                $0.album == context.name && (context.artistName == nil || $0.artist == context.artistName)
            }
        }
    }

    private func saveContext() {
        guard let song = currentSong, let ctx = currentContext else {
            SharedConstants.sharedDefaults?.removeObject(forKey: SharedConstants.lastContextKey)
            return
        }
        let updated = PlaybackContext(
            type: ctx.type, name: ctx.name, artistName: ctx.artistName,
            playlistId: ctx.playlistId, songId: song.id
        )
        SharedConstants.sharedDefaults?.set(try? JSONEncoder().encode(updated), forKey: SharedConstants.lastContextKey)
    }

    private var widgetObserversRegistered = false

    private func setupWidgetObservers() {
        guard !widgetObserversRegistered else { return }
        widgetObserversRegistered = true
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        for command in WidgetCommand.allCases {
            CFNotificationCenterAddObserver(
                center, nil, _handleWidgetCommand,
                command.rawValue as CFString, nil, .deliverImmediately
            )
        }
    }

    private func setupRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.addTarget { [weak self] _ in
            Task { @MainActor in
                guard let self, !self.isPlaying else { return }
                self.player.play()
                self.isPlaying = true
                self.updateNowPlaying()
            }
            return .success
        }
        center.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in
                guard let self, self.isPlaying else { return }
                self.player.pause()
                self.isPlaying = false
                self.updateNowPlaying()
            }
            return .success
        }
        center.nextTrackCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.next() }
            return .success
        }
        center.previousTrackCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.prev() }
            return .success
        }
        center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            Task { @MainActor in self?.seek(to: event.positionTime) }
            return .success
        }
    }
}

final class CachingDelegateProxy: NSObject, CachingPlayerItemDelegate, @unchecked Sendable {
    static let shared = CachingDelegateProxy()

    private final class Entry {
        let songId: Int
        let format: String
        let cache: AudioCache
        init(songId: Int, format: String, cache: AudioCache) {
            self.songId = songId
            self.format = format
            self.cache = cache
        }
    }
    private let entries = NSMapTable<CachingPlayerItem, Entry>.weakToStrongObjects()
    private let lock = NSLock()
    private let fileQueue = DispatchQueue(label: "org.woong.canary.cache-io")

    func register(item: CachingPlayerItem, songId: Int, format: String, cache: AudioCache) {
        lock.lock()
        entries.setObject(Entry(songId: songId, format: format, cache: cache), forKey: item)
        lock.unlock()
    }

    func playerItem(_ playerItem: CachingPlayerItem, didFinishDownloadingFileAt filePath: String) {
        lock.lock()
        let entry = entries.object(forKey: playerItem)
        entries.removeObject(forKey: playerItem)
        lock.unlock()
        guard let entry else { return }
        fileQueue.async {
            let src = URL(fileURLWithPath: filePath)
            let dst = entry.cache.fileURL(songId: entry.songId, format: entry.format)
            try? FileManager.default.moveItem(at: src, to: dst)
            entry.cache.evictIfNeeded()
        }
    }

    func playerItem(_ playerItem: CachingPlayerItem, downloadingFailedWith error: Error) {
        lock.lock()
        entries.removeObject(forKey: playerItem)
        lock.unlock()
    }
}

private func _handleWidgetCommand(
    _ center: CFNotificationCenter?,
    _ observer: UnsafeMutableRawPointer?,
    _ name: CFNotificationName?,
    _ object: UnsafeRawPointer?,
    _ info: CFDictionary?
) {
    guard let name = name?.rawValue as String?,
          let command = WidgetCommand(rawValue: name) else { return }
    Task { @MainActor in
        guard let player = AudioPlayer._widgetInstance else { return }
        switch command {
        case .togglePlay: player.togglePlay()
        case .nextTrack: player.next()
        case .prevTrack: player.prev()
        }
    }
}

private func _makeNowPlayingArtwork(size: CGSize, image: sending UIImage) -> MPMediaItemArtwork {
    nonisolated(unsafe) let img = image
    return MPMediaItemArtwork(boundsSize: size) { _ in img }
}
