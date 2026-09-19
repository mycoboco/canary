import AVFoundation
import NowPlaying
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
    private static let cacheMinPlayTime: TimeInterval = 20

    let cache: AudioCache
    private var apiClient: APIClient?
    private var pendingCache: (songId: Int, format: String)?

    nonisolated(unsafe) static var _widgetInstance: AudioPlayer?

    private var widgetRefreshTimer: Timer?
    private var stallTimer: Timer?
    private var stallEnabled = false
    private var statusObservation: NSKeyValueObservation?
    private var timeControlObservation: NSKeyValueObservation?
    private var endObserver: NSObjectProtocol?
    private var errorObserver: NSObjectProtocol?
    private var interruptionObserver: NSObjectProtocol?
    private var routeChangeObserver: NSObjectProtocol?
    private var mediaSession: MediaSession<AudioPlayer>?
    private var seekTimer: Timer?
    private static let seekStep: TimeInterval = 5
    private static let seekInterval: TimeInterval = 0.5

    init(cache: AudioCache = AudioCache()) {
        self.cache = cache
        setupAudioSession()
        setupTimeObserver()
        setupNotifications()
        setupTimeControlObserver()
    }

    deinit {
        MainActor.assumeIsolated {
            widgetRefreshTimer?.invalidate()
            stallTimer?.invalidate()
            seekTimer?.invalidate()
            statusObservation?.invalidate()
            timeControlObservation?.invalidate()
            if let timeObserver { player.removeTimeObserver(timeObserver) }
            if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
            if let errorObserver { NotificationCenter.default.removeObserver(errorObserver) }
            if let interruptionObserver { NotificationCenter.default.removeObserver(interruptionObserver) }
            if let routeChangeObserver { NotificationCenter.default.removeObserver(routeChangeObserver) }
        }
    }

    func configure(apiClient: APIClient) {
        self.apiClient = apiClient
        AudioPlayer._widgetInstance = self
        setupWidgetObservers()
        if mediaSession == nil {
            let session = MediaSession(self)
            mediaSession = session
            Task { try? await session.requestToBecomeApplicationPrimary() }
        }
    }

    func stop() {
        cleanupPendingCache()
        widgetRefreshTimer?.invalidate()
        widgetRefreshTimer = nil
        stallTimer?.invalidate()
        stallTimer = nil
        seekTimer?.invalidate()
        seekTimer = nil
        player.pause()
        player.replaceCurrentItem(with: nil)
        isPlaying = false
        queue = []
        currentIndex = -1
        currentTime = 0
        duration = 0
        currentContext = nil
        apiClient = nil
        mediaSession = nil
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
                guard let self, !self.isSeeking else { return }
                self.currentTime = time.seconds
                self.duration = self.player.currentItem?.duration.seconds ?? 0
                self.updateSharedState()
                self.checkCacheEligibility()
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
                    self.updateSharedState()
                } else if shouldResume {
                    self.player.play()
                    self.isPlaying = true
                    self.updateSharedState()
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
                self.updateSharedState()
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
        updateSharedState()
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
            updateSharedState()
        }
    }

    @ObservationIgnored private var isSeeking = false

    func seek(to time: TimeInterval) {
        isSeeking = true
        currentTime = time
        updateSharedState()
        player.seek(to: CMTime(seconds: time, preferredTimescale: 600)) { [weak self] _ in
            Task { @MainActor in
                self?.isSeeking = false
            }
        }
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
        cleanupPendingCache()

        let item: AVPlayerItem

        let cached = cache.exists(songId: song.id, format: song.format)
        if cached {
            let fileURL = cache.fileURL(songId: song.id, format: song.format)
            cache.touch(songId: song.id, format: song.format)
            item = AVPlayerItem(url: fileURL)
        } else if let streamURL = apiClient?.streamURL(for: song.id) {
            let cachingItem = CachingPlayerItem(url: streamURL, customFileExtension: song.format)
            cachingItem.delegate = CachingDelegateProxy.shared
            CachingDelegateProxy.shared.register(item: cachingItem, songId: song.id, format: song.format, cache: cache)
            item = cachingItem
            pendingCache = (songId: song.id, format: song.format)
        } else {
            return
        }

        observePlayerItem(item)
        stallTimer?.invalidate()
        stallTimer = nil
        stallEnabled = !cached
        player.replaceCurrentItem(with: item)
        player.volume = volume
        player.play()
        isPlaying = true
        startWidgetRefresh()
        currentTime = 0
        duration = 0
        saveContext()
        SharedConstants.sharedDefaults?.removeObject(forKey: SharedConstants.coverDataKey)
        updateSharedState()
        fetchWidgetArtwork(for: song)
    }

    private func cleanupPendingCache() {
        guard let pending = pendingCache else { return }
        pendingCache = nil
        CachingDelegateProxy.shared.clearEligible(songId: pending.songId)
        let cache = self.cache
        DispatchQueue.global().async {
            cache.clearPending(songId: pending.songId, format: pending.format)
        }
    }

    private func checkCacheEligibility() {
        guard let pending = pendingCache, currentTime >= Self.cacheMinPlayTime,
              currentSong?.id == pending.songId else { return }
        pendingCache = nil
        CachingDelegateProxy.shared.markEligible(songId: pending.songId)
        let cache = self.cache
        DispatchQueue.global().async {
            cache.promotePending(songId: pending.songId, format: pending.format)
        }
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
            updateSharedState()
        }
    }

    private func setupTimeControlObserver() {
        timeControlObservation = player.observe(\.timeControlStatus) { [weak self] observed, _ in
            Task { @MainActor in
                guard let self else { return }
                switch observed.timeControlStatus {
                case .waitingToPlayAtSpecifiedRate:
                    guard self.stallEnabled, self.stallTimer == nil else { return }
                    self.stallTimer = Timer.scheduledTimer(withTimeInterval: 15, repeats: false) { [weak self] _ in
                        Task { @MainActor in
                            guard let self,
                                  self.player.timeControlStatus == .waitingToPlayAtSpecifiedRate else { return }
                            self.handleError()
                        }
                    }
                case .playing:
                    self.stallTimer?.invalidate()
                    self.stallTimer = nil
                default:
                    break
                }
            }
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
            updateSharedState()
            return
        }
        handleEnded()
    }

    private func startWidgetRefresh() {
        widgetRefreshTimer?.invalidate()
        widgetRefreshTimer = Timer.scheduledTimer(withTimeInterval: 240, repeats: true) { _ in
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    private func updateSharedState() {
        guard currentSong != nil else {
            SharedConstants.sharedDefaults?.removeObject(forKey: SharedConstants.heartbeatKey)
            updateSharedNowPlaying()
            return
        }
        SharedConstants.sharedDefaults?.set(Date(), forKey: SharedConstants.heartbeatKey)
        updateSharedNowPlaying()
    }

    private func fetchWidgetArtwork(for song: Song) {
        guard let api = apiClient else { return }
        let songId = song.id
        Task { @MainActor [weak self] in
            guard let image = await CoverImageCache.shared.image(for: songId, fetch: {
                await api.fetchCoverImage(for: songId)
            }),
                  let self,
                  self.currentSong?.id == songId else { return }
            if let thumb = image.preparingThumbnail(of: CGSize(width: 200, height: 200)) {
                SharedConstants.sharedDefaults?.set(thumb.jpegData(compressionQuality: 0.7), forKey: SharedConstants.coverDataKey)
                WidgetCenter.shared.reloadAllTimelines()
            }
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

    private func remotePlay() {
        guard !isPlaying else { return }
        player.play()
        isPlaying = true
        updateSharedState()
    }

    private func remotePause() {
        guard isPlaying else { return }
        player.pause()
        isPlaying = false
        updateSharedState()
    }
}

// MARK: - NowPlaying

extension AudioPlayer: MediaSessionRepresentable {
    nonisolated var id: String { "org.woong.canary.player" }

    var content: (any MediaContentRepresentable)? {
        guard let song = currentSong else { return nil }
        let songId = song.id
        let safeDuration = duration.isFinite && duration > 0 ? duration : nil
        return MusicContent(
            id: String(songId),
            songTitle: song.title,
            artistName: song.artist,
            albumName: song.album,
            type: .audio,
            duration: safeDuration.map { .finite($0) },
            artwork: Artwork(id: String(songId)) { [weak self] _ in
                guard let self, let data = await self.loadArtworkData(songId: songId) else {
                    throw ArtworkError.unavailable
                }
                return try ArtworkRepresentation(data: data)
            }
        )
    }

    var playbackSnapshot: MediaPlaybackSnapshot? {
        guard currentSong != nil else { return nil }
        let elapsed = currentTime.isFinite ? currentTime : 0
        return MediaPlaybackSnapshot(
            state: isPlaying ? .playing(rate: 1.0) : .paused,
            defaultPlaybackRate: 1.0,
            elapsedTime: elapsed,
            timestamp: .now
        )
    }

    var commands: [MediaCommand] {
        [
            .play { [weak self] in await self?.remotePlay() },
            .pause { [weak self] in await self?.remotePause() },
            .togglePlayPause { [weak self] in await self?.togglePlay() },
            .next { [weak self] in await self?.next() },
            .previous { [weak self] in await self?.prev() },
            .seekToPosition { [weak self] position in await self?.seek(to: position) },
            .seekForward(
                beginAction: { [weak self] in await self?.beginSeek(forward: true) },
                endAction: { [weak self] in await self?.endSeek() }
            ),
            .seekBackward(
                beginAction: { [weak self] in await self?.beginSeek(forward: false) },
                endAction: { [weak self] in await self?.endSeek() }
            ),
        ]
    }

    func beginSeek(forward: Bool) {
        seekTimer?.invalidate()
        let step = forward ? Self.seekStep : -Self.seekStep
        seekTimer = Timer.scheduledTimer(withTimeInterval: Self.seekInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.currentSong != nil else { return }
                let upper = self.duration.isFinite && self.duration > 0 ? self.duration : self.currentTime
                let target = min(max(self.currentTime + step, 0), upper)
                self.seek(to: target)
            }
        }
    }

    func endSeek() {
        seekTimer?.invalidate()
        seekTimer = nil
    }

    private func loadArtworkData(songId: Int) async -> Data? {
        guard let api = apiClient else { return nil }
        guard let image = await CoverImageCache.shared.image(for: songId, fetch: {
            await api.fetchCoverImage(for: songId)
        }) else { return nil }
        return image.jpegData(compressionQuality: 0.9)
    }

    enum ArtworkError: Error { case unavailable }
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
    private var eligibleSongIds = Set<Int>()
    private let lock = NSLock()
    private let fileQueue = DispatchQueue(label: "org.woong.canary.cache-io")

    func register(item: CachingPlayerItem, songId: Int, format: String, cache: AudioCache) {
        lock.lock()
        entries.setObject(Entry(songId: songId, format: format, cache: cache), forKey: item)
        lock.unlock()
    }

    func markEligible(songId: Int) {
        lock.lock()
        eligibleSongIds.insert(songId)
        lock.unlock()
    }

    func clearEligible(songId: Int) {
        lock.lock()
        eligibleSongIds.remove(songId)
        lock.unlock()
    }

    func playerItem(_ playerItem: CachingPlayerItem, didFinishDownloadingFileAt filePath: String) {
        lock.lock()
        let entry = entries.object(forKey: playerItem)
        entries.removeObject(forKey: playerItem)
        let eligible = entry.map { eligibleSongIds.contains($0.songId) } ?? false
        if eligible, let entry { eligibleSongIds.remove(entry.songId) }
        lock.unlock()
        guard let entry else { return }
        fileQueue.async {
            let src = URL(fileURLWithPath: filePath)
            if eligible {
                let dst = entry.cache.fileURL(songId: entry.songId, format: entry.format)
                try? FileManager.default.moveItem(at: src, to: dst)
                entry.cache.evictIfNeeded()
            } else {
                let dst = entry.cache.pendingFileURL(songId: entry.songId, format: entry.format)
                try? FileManager.default.moveItem(at: src, to: dst)
            }
        }
    }

    func playerItem(_ playerItem: CachingPlayerItem, downloadingFailedWith error: Error) {
        lock.lock()
        if let entry = entries.object(forKey: playerItem) {
            eligibleSongIds.remove(entry.songId)
        }
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

