import SwiftUI

struct PlaylistsView: View {
    @Environment(LibraryViewModel.self) private var library
    @Environment(PlaylistViewModel.self) private var playlistVM

    @State private var selectedPlaylist: Playlist?
    @State private var creatingSmart = false
    @State private var creatingManual = false

    var body: some View {
        NavigationStack {
            List {
                ForEach(library.playlists) { playlist in
                    Button {
                        selectedPlaylist = playlist
                    } label: {
                        HStack {
                            Text(playlist.name)
                            Spacer()
                            Text(playlist.type.rawValue)
                                .font(.caption2)
                                .textCase(.uppercase)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .foregroundStyle(.primary)
                }
            }
            .listStyle(.plain)
            .refreshable { await library.load() }
            .navigationTitle("Playlists")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("New Smart Playlist") { creatingSmart = true }
                        Button("New Manual Playlist") { creatingManual = true }
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .navigationDestination(item: $selectedPlaylist) { playlist in
                PlaylistDetailView(playlist: playlist)
            }
            .sheet(isPresented: $creatingSmart) {
                NavigationStack {
                    PlaylistEditorView(mode: .createSmart)
                }
            }
            .sheet(isPresented: $creatingManual) {
                NavigationStack {
                    PlaylistEditorView(mode: .createManual)
                }
            }
        }
    }
}
