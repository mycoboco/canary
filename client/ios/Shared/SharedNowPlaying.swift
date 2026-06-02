import Foundation

struct SharedNowPlaying: Codable, Sendable {
    let songId: Int
    let title: String
    let artist: String
    let album: String
    let isPlaying: Bool
}

enum SharedConstants {
    static let appGroupId = "group.org.woong.canary"
    static let nowPlayingKey = "nowPlaying"
    static let coverDataKey = "coverData"
    static let defaultPlaylistIdKey = "defaultPlaylistId"
    static let heartbeatKey = "heartbeat"
    static let lastContextKey = "lastContext"

    static var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    static func clearStateIfAppDead() -> Bool {
        guard let defaults = sharedDefaults,
              let data = defaults.data(forKey: nowPlayingKey),
              let np = try? JSONDecoder().decode(SharedNowPlaying.self, from: data),
              np.isPlaying,
              let heartbeat = defaults.object(forKey: heartbeatKey) as? Date,
              Date().timeIntervalSince(heartbeat) > 5 else {
            return false
        }
        defaults.removeObject(forKey: nowPlayingKey)
        defaults.removeObject(forKey: coverDataKey)
        defaults.removeObject(forKey: heartbeatKey)
        return true
    }
}

enum WidgetCommand: String, CaseIterable {
    case togglePlay = "org.woong.canary.widget.togglePlay"
    case nextTrack = "org.woong.canary.widget.nextTrack"
    case prevTrack = "org.woong.canary.widget.prevTrack"

    func post() {
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName(rawValue as CFString),
            nil, nil, true
        )
    }
}
