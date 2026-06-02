import SwiftUI

struct PlaylistsView: View {
    @Environment(LibraryViewModel.self) private var library
    @Environment(PlaylistViewModel.self) private var playlistVM

    @Binding var pendingContext: PlaybackContext?
    @State private var path = NavigationPath()
    @State private var creatingSmart = false
    @State private var creatingManual = false

    var body: some View {
        NavigationStack(path: $path) {
            List {
                ForEach(library.playlists) { playlist in
                    Button {
                        path.append(playlist)
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
            .navigationDestination(for: Playlist.self) { playlist in
                PlaylistDetailView(playlist: playlist)
            }
            .task(id: pendingContext) { navigateIfNeeded() }
            .onChange(of: library.playlists) { navigateIfNeeded() }
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

    private func navigateIfNeeded() {
        guard let ctx = pendingContext, ctx.type == .playlist,
              let playlist = library.playlists.first(where: { $0.id == ctx.playlistId }) else { return }
        pendingContext = nil
        path.append(playlist)
    }
}
