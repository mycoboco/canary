import Foundation
import Observation

struct GroupedItem: Identifiable {
    let name: String
    let count: Int
    let songs: [Song]
    var id: String { name }
}

struct AlbumItem: Identifiable {
    let name: String
    let artist: String
    let songs: [Song]
    let coverId: Int?
    var id: String { "\(name)::\(artist)" }
}

@Observable
@MainActor
final class LibraryViewModel {
    var songs: [Song] = [] { didSet { rebuildGroups() } }
    var playlists: [Playlist] = []
    var serverName: String = ""
    var loading = true
    var error: String?
    var authError = false
    private var knownDbVersion: Int?

    private(set) var genres: [GroupedItem] = []
    private(set) var artists: [GroupedItem] = []
    private(set) var albums: [AlbumItem] = []

    private static let cacheURL: URL = FileManager.default
        .urls(for: .cachesDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("songs.json")

    private struct SongCache: Codable {
        let dbVersion: Int
        let songs: [Song]
    }

    private func rebuildGroups() {
        genres = Self.groupByKey(songs, key: \.genre)
        artists = Self.groupByKey(songs, key: \.artist)
        albums = Self.buildAlbums(songs)
    }

    private var apiClient: APIClient?

    func configure(apiClient: APIClient) {
        self.apiClient = apiClient
        loadFromDisk()
        if !songs.isEmpty { loading = false }
    }

    private func loadFromDisk() {
        guard let data = try? Data(contentsOf: Self.cacheURL),
              let cached = try? JSONDecoder().decode(SongCache.self, from: data) else { return }
        knownDbVersion = cached.dbVersion
        songs = cached.songs
    }

    func clearSongCache() {
        knownDbVersion = nil
        try? FileManager.default.removeItem(at: Self.cacheURL)
    }

    private func saveToDisk() {
        guard let version = knownDbVersion else { return }
        let cache = SongCache(dbVersion: version, songs: songs)
        if let data = try? JSONEncoder().encode(cache) {
            try? data.write(to: Self.cacheURL)
        }
    }

    func load() async {
        guard let api = apiClient else { return }
        let isInitialLoad = songs.isEmpty
        if isInitialLoad { loading = true }
        error = nil
        authError = false

        do {
            let server = try await api.fetchServer()
            serverName = server.name

            if server.dbVersion == nil || server.dbVersion != knownDbVersion {
                async let s = api.fetchSongs()
                async let p = api.fetchPlaylists()
                let (fetchedSongs, fetchedPlaylists) = try await (s, p)
                songs = fetchedSongs
                playlists = fetchedPlaylists
                knownDbVersion = server.dbVersion
                saveToDisk()
            } else {
                playlists = try await api.fetchPlaylists()
            }
        } catch let err as APIClient.APIError {
            if case .unauthorized = err {
                authError = true
            } else if isInitialLoad {
                error = "\(err)"
            }
        } catch {
            if isInitialLoad {
                self.error = error.localizedDescription
            }
        }
        loading = false
    }

    func reloadPlaylists() async {
        guard let api = apiClient else { return }
        do {
            playlists = try await api.fetchPlaylists()
        } catch let err as APIClient.APIError {
            if case .unauthorized = err { authError = true }
            else { error = "\(err)" }
        } catch {
            self.error = error.localizedDescription
        }
    }

    static func groupByKey(_ songs: [Song], key: KeyPath<Song, String>) -> [GroupedItem] {
        var map: [String: [Song]] = [:]
        for song in songs {
            map[song[keyPath: key], default: []].append(song)
        }
        return map.map { GroupedItem(name: $0.key, count: $0.value.count, songs: $0.value) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    static func buildAlbums(_ songs: [Song]) -> [AlbumItem] {
        var map: [String: (name: String, artist: String, songs: [Song])] = [:]
        for song in songs {
            let key = "\(song.album)::\(song.artist)"
            if map[key] == nil {
                map[key] = (name: song.album, artist: song.artist, songs: [])
            }
            map[key]!.songs.append(song)
        }
        return map.values.map { entry in
            let sorted = entry.songs.sorted { $0.track < $1.track }
            return AlbumItem(
                name: entry.name,
                artist: entry.artist,
                songs: sorted,
                coverId: sorted.first?.id
            )
        }
        .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }
}

extension GroupedItem: Hashable {
    static func == (lhs: GroupedItem, rhs: GroupedItem) -> Bool {
        lhs.id == rhs.id && lhs.count == rhs.count
    }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

extension AlbumItem: Hashable {
    static func == (lhs: AlbumItem, rhs: AlbumItem) -> Bool {
        lhs.id == rhs.id && lhs.songs.map(\.id) == rhs.songs.map(\.id)
    }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
