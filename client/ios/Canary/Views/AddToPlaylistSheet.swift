import SwiftUI

struct AddToPlaylistSheet: View {
    let song: Song

    @Environment(LibraryViewModel.self) private var library
    @Environment(PlaylistViewModel.self) private var playlistVM
    @Environment(\.dismiss) private var dismiss

    @State private var creating = false
    @State private var newName = ""
    @State private var error: String?
    @State private var busy = false

    private var manualPlaylists: [Playlist] {
        library.playlists.filter { $0.type == .manual }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if manualPlaylists.isEmpty && !creating {
                        Text("No manual playlists yet.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(manualPlaylists) { playlist in
                        Button {
                            addToExisting(playlist.id)
                        } label: {
                            Text(playlist.name)
                        }
                        .disabled(busy)
                    }
                }

                Section {
                    if creating {
                        HStack {
                            TextField("Playlist name", text: $newName)
                                .textFieldStyle(.roundedBorder)
                            Button("Add") { createAndAdd() }
                                .disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty || busy)
                            Button("Cancel") {
                                creating = false
                                newName = ""
                            }
                        }
                    } else {
                        Button("New Manual Playlist") {
                            creating = true
                        }
                    }
                }

                if let error {
                    Section {
                        Text(error).foregroundStyle(.red).font(.caption)
                    }
                }
            }
            .navigationTitle("Add to Playlist")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func addToExisting(_ playlistId: Int) {
        busy = true
        error = nil
        Task {
            do {
                try await playlistVM.addSong(playlistId: playlistId, songId: song.id)
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
            busy = false
        }
    }

    private func createAndAdd() {
        busy = true
        error = nil
        let trimmed = newName.trimmingCharacters(in: .whitespaces)
        Task {
            do {
                let data = Playlist(id: 0, name: trimmed, type: .manual, match: nil, rules: nil, songIds: [song.id])
                try await playlistVM.createPlaylist(data)
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
            busy = false
        }
    }
}
