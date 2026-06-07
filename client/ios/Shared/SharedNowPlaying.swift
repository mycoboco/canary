import Foundation

struct SharedNowPlaying: Codable, Sendable {
    let songId: Int
    let title: String
    let artist: String
    let album: String
    let isPlaying: Bool

    func toggled() -> SharedNowPlaying {
        SharedNowPlaying(songId: songId, title: title, artist: artist, album: album, isPlaying: !isPlaying)
    }
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

    static var nowPlaying: SharedNowPlaying? {
        guard let data = sharedDefaults?.data(forKey: nowPlayingKey) else { return nil }
        return try? JSONDecoder().decode(SharedNowPlaying.self, from: data)
    }

    static func saveNowPlaying(_ np: SharedNowPlaying) {
        if let encoded = try? JSONEncoder().encode(np) {
            sharedDefaults?.set(encoded, forKey: nowPlayingKey)
        }
    }

    static func clearStateIfAppDead() -> Bool {
        guard let defaults = sharedDefaults,
              let np = nowPlaying,
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
