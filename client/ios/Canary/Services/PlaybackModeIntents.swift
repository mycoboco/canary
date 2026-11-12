import AppIntents

// Siri shuffle/repeat commands. These drive the shared player directly so they
// work in the background without opening the app. (The MediaSession commands in
// AudioPlayer also expose shuffle/repeat to Control Center and the lock screen.)

struct ShuffleOnIntent: AudioPlaybackIntent {
    static let title: LocalizedStringResource = "Turn On Shuffle"
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        await AudioPlayer.shared.setShuffle(true)
        return .result()
    }
}

struct ShuffleOffIntent: AudioPlaybackIntent {
    static let title: LocalizedStringResource = "Turn Off Shuffle"
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        await AudioPlayer.shared.setShuffle(false)
        return .result()
    }
}

struct RepeatAllIntent: AudioPlaybackIntent {
    static let title: LocalizedStringResource = "Repeat All"
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        await AudioPlayer.shared.setRepeatMode(.all)
        return .result()
    }
}

struct RepeatOneIntent: AudioPlaybackIntent {
    static let title: LocalizedStringResource = "Repeat One"
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        await AudioPlayer.shared.setRepeatMode(.one)
        return .result()
    }
}

struct RepeatOffIntent: AudioPlaybackIntent {
    static let title: LocalizedStringResource = "Turn Off Repeat"
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        await AudioPlayer.shared.setRepeatMode(.none)
        return .result()
    }
}
