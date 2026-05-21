import Foundation

struct Song: Codable, Identifiable, Sendable, Equatable {
    let id: Int
    let title: String
    let artist: String
    let album: String
    let genre: String
    let year: Int
    let track: Int
    let time: Int
    let format: String
}
