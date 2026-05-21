import Foundation
import Observation

@Observable
@MainActor
final class PlaylistViewModel {
    private var apiClient: APIClient?
    private var library: LibraryViewModel?

    func configure(apiClient: APIClient, library: LibraryViewModel) {
        self.apiClient = apiClient
        self.library = library
    }

    func createPlaylist(_ data: Playlist) async throws {
        guard let api = apiClient else { return }
        _ = try await api.createPlaylist(data)
        await library?.reloadPlaylists()
    }

    func updatePlaylist(_ id: Int, _ data: Playlist) async throws {
        guard let api = apiClient else { return }
        _ = try await api.updatePlaylist(id, data)
        await library?.reloadPlaylists()
    }

    func deletePlaylist(_ id: Int) async throws {
        guard let api = apiClient else { return }
        try await api.deletePlaylist(id)
        await library?.reloadPlaylists()
    }

    func addSong(playlistId: Int, songId: Int) async throws {
        guard let api = apiClient else { return }
        _ = try await api.addSongToPlaylist(playlistId, songId: songId)
        await library?.reloadPlaylists()
    }

    func removeSong(playlistId: Int, songId: Int) async throws {
        guard let api = apiClient else { return }
        _ = try await api.removeSongFromPlaylist(playlistId, songId: songId)
        await library?.reloadPlaylists()
    }
}
