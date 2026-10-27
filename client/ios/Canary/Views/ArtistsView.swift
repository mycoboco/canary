import SwiftUI

struct ArtistsView: View {
    @Environment(LibraryViewModel.self) private var library

    @Binding var pendingContext: PlaybackContext?
    @State private var path = NavigationPath()
    @State private var search = ""

    private var filteredArtists: [GroupedItem] {
        library.artists.filtered(by: search) { [$0.name] }
    }

    var body: some View {
        NavigationStack(path: $path) {
            List(filteredArtists) { artist in
                NavigationLink(value: artist) {
                    HStack {
                        Text(artist.name)
                        Spacer()
                        Text("\(artist.count) songs")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .listStyle(.plain)
            .refreshable { await library.load() }
            .navigationTitle("Artists")
            .flushTopHeader()
            .searchable(text: $search, prompt: "Search artists")
            .navigationDestination(for: GroupedItem.self) { artist in
                ArtistDetailView(artist: artist)
            }
            .task(id: pendingContext) { navigateIfNeeded() }
        }
    }

    private func navigateIfNeeded() {
        guard let ctx = pendingContext, ctx.type == .artist,
              let artist = library.artists.first(where: { $0.name == ctx.name }) else { return }
        pendingContext = nil
        path.append(artist)
    }
}

struct ArtistDetailView: View {
    let artist: GroupedItem

    @Environment(LibraryViewModel.self) private var library
    @State private var addingSong: Song?
    @State private var search = ""

    private var artistAlbums: [AlbumItem] { library.albums.filter { $0.artist == artist.name } }
    private var showAlbumSections: Bool { search.isEmpty && !artistAlbums.isEmpty }

    var body: some View {
        List {
            if showAlbumSections {
                ForEach(artistAlbums) { album in
                    Section(album.name) {
                        ForEach(Array(album.songs.enumerated()), id: \.element.id) { index, song in
                            row(song: song, songs: album.songs, index: index)
                        }
                    }
                }
            } else {
                let shown = artist.songs.filtered(by: search)
                ForEach(Array(shown.enumerated()), id: \.element.id) { index, song in
                    row(song: song, songs: shown, index: index)
                }
            }
        }
        .listStyle(.plain)
        .refreshable { await library.load() }
        .navigationTitle(artist.name)
        .flushTopHeader()
        .searchable(text: $search, prompt: "Search songs")
        .sheet(item: $addingSong) { song in
            AddToPlaylistSheet(song: song)
        }
    }

    private func row(song: Song, songs: [Song], index: Int) -> some View {
        PlayableSongRow(
            song: song,
            songs: songs,
            index: index,
            context: PlaybackContext(type: .artist, name: song.artist, songId: song.id)
        ) { addingSong = $0 }
    }
}
