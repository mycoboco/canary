import SwiftUI

enum AppTab: Int {
    case songs, genres, artists, albums, playlists
}

struct MainTabView: View {
    @Environment(LibraryViewModel.self) private var library
    @Environment(AudioPlayer.self) private var player

    @State private var showFullPlayer = false
    @State private var hasRestoredNavigation = false
    @Binding var selectedTab: AppTab
    @Binding var pendingContext: PlaybackContext?

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
                    .tabItem { tabLabel("Songs", "play.circle", for: .songs) }
                    .tag(AppTab.songs)

                tab { GenresView(pendingContext: $pendingContext) }
                    .tabItem { tabLabel("Genres", "guitars", for: .genres) }
                    .tag(AppTab.genres)

                tab { ArtistsView(pendingContext: $pendingContext) }
                    .tabItem { tabLabel("Artists", "person", for: .artists) }
                    .tag(AppTab.artists)

                tab { AlbumsView(pendingContext: $pendingContext) }
                    .tabItem { tabLabel("Albums", "square.stack", for: .albums) }
                    .tag(AppTab.albums)

                tab { PlaylistsView(pendingContext: $pendingContext) }
                    .tabItem { tabLabel("Playlists", "list.bullet.rectangle.portrait", for: .playlists) }
                    .tag(AppTab.playlists)
            }
            .tint(.primary)
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

    // Outline symbol when unselected, filled when selected. symbolVariants(.none)
    // stops the Liquid Glass tab bar from forcing the filled variant on all items.
    private func tabLabel(_ title: String, _ base: String, for tab: AppTab) -> some View {
        Label {
            Text(title)
        } icon: {
            Image(systemName: selectedTab == tab ? "\(base).fill" : base)
                .environment(\.symbolVariants, .none)
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
        guard !hasRestoredNavigation else { return }
        hasRestoredNavigation = true
        guard let data = SharedConstants.sharedDefaults?.data(forKey: SharedConstants.lastContextKey),
              let context = try? JSONDecoder().decode(PlaybackContext.self, from: data) else { return }

        switch context.type {
        case .allSongs: selectedTab = .songs
        case .genre: selectedTab = .genres
        case .artist: selectedTab = .artists
        case .album: selectedTab = .albums
        case .playlist: selectedTab = .playlists
        }
    }
}
