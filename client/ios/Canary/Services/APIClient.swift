import Foundation
import Observation

@Observable
final class APIClient: @unchecked Sendable {
    enum APIError: LocalizedError {
        case unauthorized
        case serverError(String)
        case connectionFailed

        var errorDescription: String? {
            switch self {
            case .unauthorized: "Invalid password"
            case .serverError(let msg): msg
            case .connectionFailed: "Cannot connect to server"
            }
        }
    }

    let baseURL: String
    private let authHeader: String
    private let session: URLSession

    init(baseURL: String, password: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        let credentials = Data("web:\(password)".utf8).base64EncodedString()
        self.authHeader = "Basic \(credentials)"
        self.session = session
    }

    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    private func perform(_ method: String = "GET", _ path: String, body: Data? = nil) async throws -> Data {
        guard let url = URL(string: "\(baseURL)/api\(path)") else {
            throw APIError.connectionFailed
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue(authHeader, forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = body
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.connectionFailed
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.connectionFailed
        }
        if http.statusCode == 401 { throw APIError.unauthorized }
        if http.statusCode < 200 || http.statusCode >= 300 {
            let body = try? decoder.decode([String: String].self, from: data)
            throw APIError.serverError(body?["error"] ?? "HTTP \(http.statusCode)")
        }
        return data
    }

    private func fetch<T: Decodable>(_ path: String) async throws -> T {
        try decoder.decode(T.self, from: try await perform("GET", path))
    }

    func fetchServer() async throws -> ServerInfo { try await fetch("/server") }
    func fetchSongs() async throws -> [Song] { try await fetch("/songs") }
    func fetchPlaylists() async throws -> [Playlist] { try await fetch("/playlists") }
    func fetchPlaylistSongs(_ id: Int) async throws -> [Song] { try await fetch("/playlists/\(id)/songs") }

    func createPlaylist(_ data: Playlist) async throws -> Playlist {
        let responseData = try await perform("POST", "/playlists", body: encoder.encode(data))
        return try decoder.decode(Playlist.self, from: responseData)
    }

    func updatePlaylist(_ id: Int, _ data: Playlist) async throws -> Playlist {
        let responseData = try await perform("PUT", "/playlists/\(id)", body: encoder.encode(data))
        return try decoder.decode(Playlist.self, from: responseData)
    }

    func deletePlaylist(_ id: Int) async throws {
        _ = try await perform("DELETE", "/playlists/\(id)")
    }

    func addSongToPlaylist(_ playlistId: Int, songId: Int) async throws -> Playlist {
        let responseData = try await perform("POST", "/playlists/\(playlistId)/songs", body: encoder.encode(["songId": songId]))
        return try decoder.decode(Playlist.self, from: responseData)
    }

    func removeSongFromPlaylist(_ playlistId: Int, songId: Int) async throws -> Playlist {
        let responseData = try await perform("DELETE", "/playlists/\(playlistId)/songs/\(songId)")
        return try decoder.decode(Playlist.self, from: responseData)
    }

    func streamURL(for songId: Int) -> URL? {
        URL(string: "\(baseURL)/api/songs/\(songId)/stream")
    }

    func coverURL(for songId: Int) -> URL? {
        URL(string: "\(baseURL)/api/songs/\(songId)/cover")
    }

    func fetchCoverImage(for songId: Int) async -> Data? {
        guard let url = coverURL(for: songId) else { return nil }
        guard let (data, response) = try? await session.data(from: url),
              let http = response as? HTTPURLResponse,
              http.statusCode == 200 else { return nil }
        return data
    }
}
