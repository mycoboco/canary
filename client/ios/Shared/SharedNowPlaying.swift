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

    static var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }
}

enum WidgetCommand: String, CaseIterable {
    case togglePlay = "org.woong.canary.widget.togglePlay"
    case nextTrack = "org.woong.canary.widget.nextTrack"
    case prevTrack = "org.woong.canary.widget.prevTrack"
    case startPlayback = "org.woong.canary.widget.startPlayback"

    func post() {
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName(rawValue as CFString),
            nil, nil, true
        )
    }
}
