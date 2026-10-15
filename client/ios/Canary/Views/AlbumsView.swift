import SwiftUI

struct AlbumsView: View {
    @Environment(LibraryViewModel.self) private var library

    @Binding var pendingContext: PlaybackContext?
    @State private var selectedAlbum: AlbumItem?
    @State private var search = ""

    private let columns = [
        GridItem(.flexible(), spacing: 16),
        GridItem(.flexible(), spacing: 16),
    ]

    private var filteredAlbums: [AlbumItem] {
        library.albums.filtered(by: search) { [$0.name, $0.artist] }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 16) {
                    ForEach(filteredAlbums) { album in
                        Button {
                            selectedAlbum = album
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Color.clear
                                    .aspectRatio(1, contentMode: .fit)
                                    .frame(maxWidth: .infinity)
                                    .overlay {
                                        AlbumCoverView(songId: album.coverId, size: 0, clipCorners: false)
                                    }
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                Text(album.name)
                                    .font(.caption)
                                    .fontWeight(.medium)
                                    .lineLimit(1)
                                Text(album.artist)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding()
            }
            .refreshable { await library.load() }
            .navigationTitle("Albums")
            .searchable(text: $search, prompt: "Search albums")
            .task(id: pendingContext) {
                guard let ctx = pendingContext, ctx.type == .album,
                      let album = library.albums.first(where: { $0.name == ctx.name && $0.artist == (ctx.artistName ?? $0.artist) }) else { return }
                pendingContext = nil
                selectedAlbum = album
            }
            .navigationDestination(item: $selectedAlbum) { album in
                AlbumDetailView(album: album)
            }
        }
    }
}

struct AlbumDetailView: View {
    let album: AlbumItem

    @Environment(LibraryViewModel.self) private var library
    @State private var addingSong: Song?
    @State private var search = ""

    var body: some View {
        let shown = album.songs.filtered(by: search)
        List {
            Section {
                HStack(spacing: 16) {
                    AlbumCoverView(songId: album.coverId, size: 120)
                    VStack(alignment: .leading) {
                        Text(album.name)
                            .font(.title3)
                            .fontWeight(.bold)
                        Text(album.artist)
                            .foregroundStyle(.secondary)
                    }
                }
                .listRowSeparator(.hidden)
                .padding(.vertical, 8)
            }
            Section {
                ForEach(Array(shown.enumerated()), id: \.element.id) { index, song in
                    PlayableSongRow(
                        song: song,
                        songs: shown,
                        index: index,
                        context: PlaybackContext(type: .album, name: album.name, artistName: album.artist, songId: song.id)
                    ) { addingSong = $0 }
                }
            }
        }
        .listStyle(.plain)
        .refreshable { await library.load() }
        .navigationTitle(album.name)
        .searchable(text: $search, prompt: "Search in album")
        .sheet(item: $addingSong) { song in
            AddToPlaylistSheet(song: song)
        }
    }
}
