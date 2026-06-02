import SwiftUI

struct SongsView: View {
    @Environment(LibraryViewModel.self) private var library
    @Environment(AudioPlayer.self) private var player

    private enum SortKey: CaseIterable {
        case title, artist, album

        var label: String {
            switch self {
            case .title: "Title"
            case .artist: "Artist"
            case .album: "Album"
            }
        }

        func value(of song: Song) -> String {
            switch self {
            case .title: song.title
            case .artist: song.artist
            case .album: song.album
            }
        }
    }

    @State private var search = ""
    @State private var sortKey: SortKey? = nil
    @State private var sortAscending = true
    @State private var addingSong: Song?
    @State private var showSettings = false
    @State private var cachedSongs: [Song] = []

    var body: some View {
        NavigationStack {
            songList
                .listStyle(.plain)
                .refreshable { await library.load() }
                .navigationTitle("Songs")
                .searchable(text: $search, prompt: "Search songs")
                .toolbar { toolbarItems }
                .sheet(isPresented: $showSettings) { SettingsView() }
                .sheet(item: $addingSong) { song in AddToPlaylistSheet(song: song) }
                .task(id: search) {
                    if !search.isEmpty {
                        try? await Task.sleep(for: .milliseconds(300))
                        guard !Task.isCancelled else { return }
                    }
                    rebuildSongs()
                }
                .onChange(of: sortKey) { rebuildSongs() }
                .onChange(of: sortAscending) { rebuildSongs() }
                .onChange(of: library.songs) { rebuildSongs() }
                .onAppear { rebuildSongs() }
        }
    }

    private var songList: some View {
        List {
            ForEach(Array(cachedSongs.enumerated()), id: \.element.id) { index, song in
                songRow(song: song, index: index)
            }
        }
    }

    private func songRow(song: Song, index: Int) -> some View {
        SongRow(
            song: song,
            isPlaying: player.currentSong?.id == song.id
        )
        .onTapGesture {
            player.playSong(songs: cachedSongs, index: index, context: PlaybackContext(type: .allSongs, songId: song.id))
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

    @ToolbarContentBuilder
    private var toolbarItems: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button { showSettings = true } label: {
                Image(systemName: "gearshape")
            }
        }
        ToolbarItem(placement: .topBarTrailing) {
            sortMenu
        }
    }

    private func rebuildSongs() {
        var result = library.songs
        if !search.isEmpty {
            result = result.filter {
                $0.title.localizedCaseInsensitiveContains(search) ||
                $0.artist.localizedCaseInsensitiveContains(search) ||
                $0.album.localizedCaseInsensitiveContains(search)
            }
        }
        if let key = sortKey {
            let asc = sortAscending
            result.sort { a, b in
                let cmp = key.value(of: a).localizedCaseInsensitiveCompare(key.value(of: b))
                return asc ? cmp == .orderedAscending : cmp == .orderedDescending
            }
        }
        cachedSongs = result
    }

    private var sortMenu: some View {
        Menu {
            ForEach(SortKey.allCases, id: \.self) { key in
                Button {
                    if sortKey == key {
                        sortAscending.toggle()
                    } else {
                        sortKey = key
                        sortAscending = true
                    }
                } label: {
                    let arrow = sortKey == key ? (sortAscending ? " ↑" : " ↓") : ""
                    Text("\(key.label)\(arrow)")
                }
            }
        } label: {
            Image(systemName: "arrow.up.arrow.down")
        }
    }
}
