import SwiftUI

extension Notification.Name {
    static let signOut = Notification.Name("canary.signOut")
    static let consumePendingSiri = Notification.Name("canary.consumePendingSiri")
}

@main
struct CanaryApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var apiClient: APIClient?
    @State private var library = LibraryViewModel()
    @State private var player = AudioPlayer()
    @State private var playlistVM = PlaylistViewModel()
    @State private var pendingURL: URL?
    @State private var selectedTab: AppTab = .songs
    @State private var pendingContext: PlaybackContext?

    var body: some Scene {
        WindowGroup {
            if let api = apiClient {
                MainTabView(selectedTab: $selectedTab, pendingContext: $pendingContext)
                    .environment(api)
                    .environment(library)
                    .environment(player)
                    .environment(playlistVM)
                    .task {
                        library.configure(apiClient: api)
                        player.configure(apiClient: api)
                        playlistVM.configure(apiClient: api, library: library)
                        await library.load()
                        consumePendingSiriRequests()
                    }
                    .onOpenURL { url in handleURL(url) }
                    .onChange(of: library.loaded) {
                        if let url = pendingURL {
                            pendingURL = nil
                            handleURL(url)
                        }
                        consumePendingSiriRequests()
                    }
                    .onChange(of: scenePhase) {
                        if scenePhase == .active { consumePendingSiriRequests() }
                    }
                    .onChange(of: library.authError) {
                        if library.authError { signOut() }
                    }
                    .onReceive(NotificationCenter.default.publisher(for: .signOut)) { _ in
                        signOut()
                    }
                    .onReceive(NotificationCenter.default.publisher(for: .consumePendingSiri)) { _ in
                        consumePendingSiriRequests()
                    }
            } else {
                LoginView { url, password in
                    KeychainService.save(Credentials(serverURL: url, password: password))
                    apiClient = APIClient(baseURL: url, password: password)
                }
            }
        }
    }

    private func handleURL(_ url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme == "canary",
              apiClient != nil else { return }

        if !library.loaded {
            pendingURL = url
            return
        }

        let params = components.queryItems
        let param = { (name: String) in params?.first(where: { $0.name == name })?.value }

        switch components.host {
        case "play":
            let playlistName = param("playlist")
            if let v = param("shuffle") { player.shuffleMode = v == "true" }
            if let v = param("repeat") {
                player.setRepeatMode(AudioPlayer.RepeatMode(rawValue: v) ?? .none)
            }
            if let playlistName {
                guard let playlist = library.playlists.first(where: { $0.name.caseInsensitiveCompare(playlistName) == .orderedSame }) else { return }
                playPlaylist(id: playlist.id, name: playlist.name)
            } else {
                Task { await player.startDefaultPlayback() }
            }
        case "pause":
            if player.isPlaying { player.togglePlay() }
        case "next":
            player.next()
        case "prev":
            player.prev()
        default:
            break
        }
    }

    private func playPlaylist(id: Int, name: String?) {
        Task {
            guard let api = apiClient else { return }
            let songs = (try? await api.fetchPlaylistSongs(id)) ?? []
            guard !songs.isEmpty else { return }
            let plName = name
                ?? library.playlists.first(where: { $0.id == id })?.name
                ?? SharedConstants.playlists.first(where: { $0.id == id })?.name
                ?? ""
            let ctx = PlaybackContext(type: .playlist, name: plName, playlistId: id, songId: songs[0].id)
            player.playSong(songs: songs, index: 0, context: ctx)
            selectedTab = .playlists
            pendingContext = ctx
        }
    }

    private func consumePendingSiriRequests() {
        guard library.loaded, let defaults = SharedConstants.sharedDefaults else { return }

        if defaults.object(forKey: SharedConstants.pendingPlaylistIdKey) != nil {
            let id = defaults.integer(forKey: SharedConstants.pendingPlaylistIdKey)
            defaults.removeObject(forKey: SharedConstants.pendingPlaylistIdKey)
            if id > 0 { playPlaylist(id: id, name: nil) }
        }

        if defaults.bool(forKey: SharedConstants.pendingStartKey) {
            defaults.removeObject(forKey: SharedConstants.pendingStartKey)
            if !player.isPlaying {
                Task { await player.startDefaultPlayback() }
            }
        }
    }

    private func signOut() {
        player.stop()
        library.clearSongCache()
        player.cache.clearAll()
        CoverImageCache.shared.clearAll()
        KeychainService.delete()
        apiClient = nil
    }

    init() {
        if let credentials = KeychainService.load() {
            _apiClient = State(initialValue: APIClient(
                baseURL: credentials.serverURL,
                password: credentials.password
            ))
        }
    }
}
