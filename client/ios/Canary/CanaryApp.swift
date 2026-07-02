import SwiftUI

extension Notification.Name {
    static let signOut = Notification.Name("canary.signOut")
}

@main
struct CanaryApp: App {
    @State private var apiClient: APIClient?
    @State private var library = LibraryViewModel()
    @State private var player = AudioPlayer()
    @State private var playlistVM = PlaylistViewModel()
    @State private var pendingURL: URL?

    var body: some Scene {
        WindowGroup {
            if let api = apiClient {
                MainTabView()
                    .environment(api)
                    .environment(library)
                    .environment(player)
                    .environment(playlistVM)
                    .task {
                        library.configure(apiClient: api)
                        player.configure(apiClient: api)
                        playlistVM.configure(apiClient: api, library: library)
                        await library.load()
                    }
                    .onOpenURL { url in handleURL(url) }
                    .onChange(of: library.loaded) {
                        if let url = pendingURL {
                            pendingURL = nil
                            handleURL(url)
                        }
                    }
                    .onChange(of: library.authError) {
                        if library.authError { signOut() }
                    }
                    .onReceive(NotificationCenter.default.publisher(for: .signOut)) { _ in
                        signOut()
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
            Task {
                if let playlistName {
                    guard let playlist = library.playlists.first(where: { $0.name.caseInsensitiveCompare(playlistName) == .orderedSame }),
                          let api = apiClient else { return }
                    let songs = (try? await api.fetchPlaylistSongs(playlist.id)) ?? []
                    guard !songs.isEmpty else { return }
                    player.playSong(songs: songs, index: 0, context: PlaybackContext(type: .playlist, name: playlist.name, playlistId: playlist.id, songId: songs[0].id))
                } else {
                    await player.startDefaultPlayback()
                }
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
