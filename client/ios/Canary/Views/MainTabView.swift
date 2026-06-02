import SwiftUI

enum AppTab: Int {
    case songs, genres, artists, albums, playlists
}

struct MainTabView: View {
    @Environment(LibraryViewModel.self) private var library
    @Environment(AudioPlayer.self) private var player

    @State private var showFullPlayer = false
    @State private var selectedTab: AppTab = .songs
    @State private var pendingContext: PlaybackContext?

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
            TabView(selection: $selectedTab) {
                tab { SongsView() }
                    .tabItem { Label("Songs", systemImage: "music.note") }
                    .tag(AppTab.songs)

                tab { GenresView(pendingContext: $pendingContext) }
                    .tabItem { Label("Genres", systemImage: "guitars") }
                    .tag(AppTab.genres)

                tab { ArtistsView(pendingContext: $pendingContext) }
                    .tabItem { Label("Artists", systemImage: "person") }
                    .tag(AppTab.artists)

                tab { AlbumsView(pendingContext: $pendingContext) }
                    .tabItem { Label("Albums", systemImage: "square.stack") }
                    .tag(AppTab.albums)

                tab { PlaylistsView(pendingContext: $pendingContext) }
                    .tabItem { Label("Playlists", systemImage: "music.note.list") }
                    .tag(AppTab.playlists)
            }
            .sheet(isPresented: $showFullPlayer) {
                FullPlayerView()
                    .presentationDetents([.large])
                    .presentationCornerRadius(0)
                    .presentationDragIndicator(.hidden)
                    .presentationBackground(.ultraThinMaterial)
            }
            .onAppear { restoreNavigation() }
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

    private func restoreNavigation() {
        guard let data = SharedConstants.sharedDefaults?.data(forKey: SharedConstants.lastContextKey),
              let context = try? JSONDecoder().decode(PlaybackContext.self, from: data) else { return }

        switch context.type {
        case .allSongs: selectedTab = .songs
        case .genre: selectedTab = .genres
        case .artist: selectedTab = .artists
        case .album: selectedTab = .albums
        case .playlist: selectedTab = .playlists
        }
        pendingContext = context
    }
}
