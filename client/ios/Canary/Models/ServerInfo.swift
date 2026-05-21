import Foundation

struct ServerInfo: Codable, Sendable {
    let name: String
    let version: String?
    let songCount: Int?
    let dbVersion: Int?
}
