import SwiftUI

struct PlaylistDetailView: View {
    let playlist: Playlist

    @Environment(APIClient.self) private var api
    @Environment(AudioPlayer.self) private var player
    @Environment(LibraryViewModel.self) private var library
    @Environment(PlaylistViewModel.self) private var playlistVM
    @Environment(\.dismiss) private var dismiss

    @State private var songs: [Song] = []
    @State private var loading = true
    @State private var editing = false
    @State private var confirmDelete = false
    @State private var deleteError: String?
    @State private var search = ""

    private var filteredSongs: [Song] { songs.filtered(by: search) }

    var body: some View {
        List {
            ForEach(Array(filteredSongs.enumerated()), id: \.element.id) { index, song in
                SongRow(
                    song: song,
                    isPlaying: player.currentSong?.id == song.id
                )
                .onTapGesture {
                    player.playSong(songs: filteredSongs, index: index, context: PlaybackContext(type: .playlist, name: playlist.name, playlistId: playlist.id, songId: song.id))
                }
                .swipeActions(edge: .trailing) {
                    if playlist.type == .manual {
                        Button(role: .destructive) {
                            removeSong(songId: song.id)
                        } label: {
                            Label("Remove", systemImage: "trash")
                        }
                        .tint(.red)
                    }
                }
            }
        }
        .listStyle(.plain)
        .refreshable { await loadSongs() }
        .overlay {
            if loading {
                ProgressView()
            } else if songs.isEmpty && playlist.type == .manual {
                ContentUnavailableView(
                    "No Songs",
                    systemImage: "music.note",
                    description: Text("Add songs from Songs, Albums, Artists, or Genres.")
                )
            }
        }
        .navigationTitle(playlist.name)
        .flushTopHeader()
        .searchable(text: $search, prompt: "Search songs")
        .toolbar {
            if playlist.type != .builtin {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Edit") { editing = true }
                        Button("Delete", role: .destructive) { confirmDelete = true }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .task(id: playlist.id) {
            await loadSongs()
        }
        .onChange(of: library.playlists) {
            Task { await loadSongs() }
        }
        .sheet(isPresented: $editing) {
            NavigationStack {
                PlaylistEditorView(mode: .edit(playlist))
            }
        }
        .alert("Delete \"\(playlist.name)\"?", isPresented: $confirmDelete) {
            Button("Delete", role: .destructive) {
                Task {
                    do {
                        try await playlistVM.deletePlaylist(playlist.id)
                        dismiss()
                    } catch {
                        deleteError = error.localizedDescription
                    }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This can't be undone.")
        }
        .alert("Failed to Delete", isPresented: Binding(get: { deleteError != nil }, set: { if !$0 { deleteError = nil } })) {
        } message: {
            Text(deleteError ?? "")
        }
    }

    private func loadSongs() async {
        let isInitialLoad = songs.isEmpty
        if isInitialLoad { loading = true }
        do {
            songs = try await api.fetchPlaylistSongs(playlist.id)
        } catch {
            if isInitialLoad { songs = [] }
        }
        loading = false
    }

    private func removeSong(songId: Int) {
        songs.removeAll { $0.id == songId }
        Task {
            do {
                try await playlistVM.removeSong(playlistId: playlist.id, songId: songId)
            } catch {
                await loadSongs()
            }
        }
    }
}
