import SwiftUI

enum AppTab: Int {
    case songs, genres, artists, albums, playlists
}

// Reports the mini ("mini") and full ("full") album-art slots so a single flying
// art view can be interpolated between them.
struct PlayerArtAnchor: PreferenceKey {
    static let defaultValue: [String: Anchor<CGRect>] = [:]
    static func reduce(value: inout [String: Anchor<CGRect>], nextValue: () -> [String: Anchor<CGRect>]) {
        value.merge(nextValue()) { _, new in new }
    }
}

private func lerp(_ a: CGFloat, _ b: CGFloat, _ t: CGFloat) -> CGFloat { a + (b - a) * t }

private func lerpRect(_ a: CGRect, _ b: CGRect, _ t: CGFloat) -> CGRect {
    CGRect(
        x: lerp(a.minX, b.minX, t), y: lerp(a.minY, b.minY, t),
        width: lerp(a.width, b.width, t), height: lerp(a.height, b.height, t)
    )
}

struct MainTabView: View {
    @Environment(LibraryViewModel.self) private var library
    @Environment(AudioPlayer.self) private var player

    @State private var progress: CGFloat = 0
    @State private var hasRestoredNavigation = false
    @Binding var selectedTab: AppTab
    @Binding var pendingContext: PlaybackContext?

    private static let playerAnimation = Animation.spring(response: 0.5, dampingFraction: 0.9)

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
            ZStack {
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
                .onAppear { restoreNavigation() }

                if player.currentSong != nil {
                    FullPlayerView(progress: $progress, onCollapse: {
                        withAnimation(Self.playerAnimation) { progress = 0 }
                    })
                    .allowsHitTesting(progress > 0)
                    .zIndex(1)
                }
            }
            .overlayPreferenceValue(PlayerArtAnchor.self) { anchors in
                GeometryReader { proxy in
                    if let song = player.currentSong,
                       let mini = anchors["mini"], let full = anchors["full"] {
                        let rect = lerpRect(proxy[mini], proxy[full], progress)
                        AlbumCoverView(songId: song.id, size: rect.width, clipCorners: false)
                            .clipShape(RoundedRectangle(cornerRadius: lerp(6, 20, progress)))
                            .shadow(color: .black.opacity(0.45 * progress), radius: 24 * progress, y: 16 * progress)
                            .position(x: rect.midX, y: rect.midY)
                            .allowsHitTesting(false)
                    }
                }
            }
            .onChange(of: player.currentSong == nil) {
                // Collapse when playback stops so a new song doesn't reopen expanded.
                if player.currentSong == nil { progress = 0 }
            }
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
                    MiniPlayerView(progress: progress, onExpand: {
                        withAnimation(Self.playerAnimation) { progress = 1 }
                    })
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
