import Foundation

enum PlaylistType: String, Codable, Sendable {
    case builtin, manual, smart
}

struct PlaylistRule: Codable, Sendable, Equatable {
    var field: String
    var op: String
    var value: String
}

struct Playlist: Codable, Identifiable, Sendable {
    let id: Int
    var name: String
    let type: PlaylistType
    var match: String?
    var rules: [PlaylistRule]?
    var songIds: [Int]?
}

extension Playlist: Hashable {
    static func == (lhs: Playlist, rhs: Playlist) -> Bool {
        lhs.id == rhs.id && lhs.name == rhs.name && lhs.type == rhs.type &&
        lhs.songIds == rhs.songIds && lhs.rules == rhs.rules && lhs.match == rhs.match
    }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
