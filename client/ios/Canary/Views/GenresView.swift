import SwiftUI

struct GenresView: View {
    @Environment(LibraryViewModel.self) private var library
    @Environment(AudioPlayer.self) private var player

    @State private var addingSong: Song?

    var body: some View {
        NavigationStack {
            List(library.genres) { genre in
                NavigationLink(value: genre) {
                    HStack {
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
            .navigationDestination(for: GroupedItem.self) { genre in
                List {
                    ForEach(Array(genre.songs.enumerated()), id: \.element.id) { index, song in
                        SongRow(
                            song: song,
                            isPlaying: player.currentSong?.id == song.id
                        )
                        .onTapGesture {
                            player.playSong(songs: genre.songs, index: index)
                        }
                        .swipeActions(edge: .trailing) {
                            Button {
                                addingSong = song
                            } label: {
                                Label("Add to Playlist", systemImage: "text.badge.plus")
                            }
                            .tint(.blue)
                        }
                    }
                }
                .listStyle(.plain)
                .refreshable { await library.load() }
                .navigationTitle(genre.name)
                .sheet(item: $addingSong) { song in
                    AddToPlaylistSheet(song: song)
                }
            }
        }
    }

}
