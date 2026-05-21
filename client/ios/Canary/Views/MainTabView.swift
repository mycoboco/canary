import SwiftUI

struct MainTabView: View {
    @Environment(LibraryViewModel.self) private var library
    @Environment(AudioPlayer.self) private var player

    @State private var showFullPlayer = false

    var body: some View {
        if library.loading {
            ProgressView("Loading...")
        } else if library.error != nil {
            VStack(spacing: 16) {
                Text(library.error ?? "Cannot connect to server")
                    .foregroundStyle(.red)
                Button("Retry") {
                    Task { await library.load() }
                }
                .buttonStyle(.bordered)
            }
        } else if library.songs.isEmpty {
            VStack(spacing: 16) {
                Text("No songs")
                    .foregroundStyle(.secondary)
                Button("Refresh") {
                    Task { await library.load() }
                }
                .buttonStyle(.bordered)
            }
        } else {
            TabView {
                tab { SongsView() }
                    .tabItem { Label("Songs", systemImage: "music.note") }

                tab { GenresView() }
                    .tabItem { Label("Genres", systemImage: "guitars") }

                tab { ArtistsView() }
                    .tabItem { Label("Artists", systemImage: "person") }

                tab { AlbumsView() }
                    .tabItem { Label("Albums", systemImage: "square.stack") }

                tab { PlaylistsView() }
                    .tabItem { Label("Playlists", systemImage: "music.note.list") }
            }
            .sheet(isPresented: $showFullPlayer) {
                FullPlayerView()
            }
        }
    }

    private func tab<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .contentMargins(.bottom, player.currentSong != nil ? 64 : 0, for: .scrollContent)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if player.currentSong != nil {
                    MiniPlayerView(onExpand: { showFullPlayer = true })
                }
            }
    }
}
