import SwiftUI

struct GenresView: View {
    @Environment(LibraryViewModel.self) private var library

    @Binding var pendingContext: PlaybackContext?
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            List(library.genres) { genre in
                NavigationLink(value: genre) {
                    HStack(spacing: 12) {
                        GenreIcon(genre: genre.name, size: 30)
                            .foregroundStyle(.secondary)
                        Text(genre.name)
                        Spacer()
                        Text("\(genre.count) songs")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .listStyle(.plain)
            .refreshable { await library.load() }
            .navigationTitle("Genres")
            .flushTopHeader()
            .navigationDestination(for: GroupedItem.self) { genre in
                GenreDetailView(genre: genre)
            }
            .task(id: pendingContext) { navigateIfNeeded() }
        }
    }

    private func navigateIfNeeded() {
        guard let ctx = pendingContext, ctx.type == .genre,
              let genre = library.genres.first(where: { $0.name == ctx.name }) else { return }
        pendingContext = nil
        path.append(genre)
    }
}

struct GenreDetailView: View {
    let genre: GroupedItem

    @Environment(LibraryViewModel.self) private var library
    @State private var addingSong: Song?
    @State private var search = ""

    var body: some View {
        let shown = genre.songs.filtered(by: search)
        List {
            HStack(spacing: 14) {
                GenreIcon(genre: genre.name, size: 52)
                    .foregroundStyle(.secondary)
                Text(genre.name)
                    .font(.title3)
                    .fontWeight(.bold)
            }
            .listRowSeparator(.hidden)
            .padding(.vertical, 8)
            ForEach(Array(shown.enumerated()), id: \.element.id) { index, song in
                PlayableSongRow(
                    song: song,
                    songs: shown,
                    index: index,
                    context: PlaybackContext(type: .genre, name: genre.name, songId: song.id)
                ) { addingSong = $0 }
            }
        }
        .listStyle(.plain)
        .refreshable { await library.load() }
        .navigationTitle(genre.name)
        .flushTopHeader()
        .searchable(text: $search, prompt: "Search songs")
        .sheet(item: $addingSong) { song in
            AddToPlaylistSheet(song: song)
        }
    }
}
