import SwiftUI

struct AlbumsView: View {
    @Environment(LibraryViewModel.self) private var library
    @Environment(AudioPlayer.self) private var player

    @State private var selectedAlbum: AlbumItem?
    @State private var addingSong: Song?

    private let columns = [
        GridItem(.flexible(), spacing: 16),
        GridItem(.flexible(), spacing: 16),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 16) {
                    ForEach(library.albums) { album in
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
            .navigationDestination(item: $selectedAlbum) { album in
                albumDetail(album)
            }
        }
    }

    @ViewBuilder
    private func albumDetail(_ album: AlbumItem) -> some View {
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
                ForEach(Array(album.songs.enumerated()), id: \.element.id) { index, song in
                    SongRow(
                        song: song,
                        isPlaying: player.currentSong?.id == song.id
                    )
                    .onTapGesture {
                        player.playSong(songs: album.songs, index: index)
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
        }
        .listStyle(.plain)
        .refreshable { await library.load() }
        .navigationTitle(album.name)
        .sheet(item: $addingSong) { song in
            AddToPlaylistSheet(song: song)
        }
    }

}
