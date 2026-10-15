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

extension Array {
    /// Keeps elements where any of the provided strings case-insensitively contains the
    /// query. An empty query returns the whole array. Shared by every searchable list.
    func filtered(by search: String, keys: (Element) -> [String]) -> [Element] {
        guard !search.isEmpty else { return self }
        return filter { element in
            keys(element).contains { $0.localizedCaseInsensitiveContains(search) }
        }
    }
}

extension Array where Element == Song {
    func filtered(by search: String) -> [Song] {
        filtered(by: search) { [$0.title, $0.artist, $0.album] }
    }
}
