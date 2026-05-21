import SwiftUI

struct ArtistsView: View {
    @Environment(LibraryViewModel.self) private var library
    @Environment(AudioPlayer.self) private var player

    @State private var addingSong: Song?

    var body: some View {
        NavigationStack {
            List(library.artists) { artist in
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
            .navigationDestination(for: GroupedItem.self) { artist in
                artistDetail(artist)
            }
        }
    }

    @ViewBuilder
    private func artistDetail(_ artist: GroupedItem) -> some View {
        let artistAlbums = library.albums.filter { $0.artist == artist.name }
        List {
            if artistAlbums.isEmpty {
                ForEach(Array(artist.songs.enumerated()), id: \.element.id) { index, song in
                    songRow(song: song, songs: artist.songs, index: index)
                }
            } else {
                ForEach(artistAlbums) { album in
                    Section(album.name) {
                        ForEach(Array(album.songs.enumerated()), id: \.element.id) { index, song in
                            songRow(song: song, songs: album.songs, index: index)
                        }
                    }
                }
            }
        }
        .listStyle(.plain)
        .refreshable { await library.load() }
        .navigationTitle(artist.name)
        .sheet(item: $addingSong) { song in
            AddToPlaylistSheet(song: song)
        }
    }

    private func songRow(song: Song, songs: [Song], index: Int) -> some View {
        SongRow(
            song: song,
            isPlaying: player.currentSong?.id == song.id
        )
        .onTapGesture {
            player.playSong(songs: songs, index: index)
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
