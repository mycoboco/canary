import Foundation

struct PlaybackContext: Codable, Sendable, Equatable {
    enum ContextType: String, Codable, Sendable {
        case allSongs, genre, artist, album, playlist
    }

    let type: ContextType
    let name: String
    let artistName: String?
    let playlistId: Int?
    let songId: Int

    init(type: ContextType, name: String = "", artistName: String? = nil, playlistId: Int? = nil, songId: Int) {
        self.type = type
        self.name = name
        self.artistName = artistName
        self.playlistId = playlistId
        self.songId = songId
    }
}
