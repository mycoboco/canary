import AppIntents
import WidgetKit

// Playback transport intents shared by the widget buttons and Siri / App Shortcuts.

struct TogglePlayIntent: AudioPlaybackIntent {
    static let title: LocalizedStringResource = "Play or Pause"
    static let openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult {
        if SharedConstants.clearStateIfAppDead() {
            WidgetCenter.shared.reloadAllTimelines()
            return .result()
        }
        if let np = SharedConstants.nowPlaying {
            SharedConstants.saveNowPlaying(np.toggled())
        }
        WidgetCommand.togglePlay.post()
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

struct NextTrackIntent: AudioPlaybackIntent {
    static let title: LocalizedStringResource = "Next Track"
    static let openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult {
        if SharedConstants.clearStateIfAppDead() {
            WidgetCenter.shared.reloadAllTimelines()
            return .result()
        }
        WidgetCommand.nextTrack.post()
        return .result()
    }
}

struct PreviousTrackIntent: AudioPlaybackIntent {
    static let title: LocalizedStringResource = "Previous Track"
    static let openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult {
        if SharedConstants.clearStateIfAppDead() {
            WidgetCenter.shared.reloadAllTimelines()
            return .result()
        }
        WidgetCommand.prevTrack.post()
        return .result()
    }
}
