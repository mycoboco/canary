import AppIntents

// MARK: - Playlist entity

struct CanaryPlaylistEntity: AppEntity, Identifiable {
    let id: Int
    let name: String

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Playlist"
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }

    static let defaultQuery = CanaryPlaylistQuery()
}

struct CanaryPlaylistQuery: EntityQuery {
    func entities(for identifiers: [Int]) async throws -> [CanaryPlaylistEntity] {
        SharedConstants.playlists
            .filter { identifiers.contains($0.id) }
            .map { CanaryPlaylistEntity(id: $0.id, name: $0.name) }
    }

    func suggestedEntities() async throws -> [CanaryPlaylistEntity] {
        SharedConstants.playlists.map { CanaryPlaylistEntity(id: $0.id, name: $0.name) }
    }
}

extension CanaryPlaylistQuery: EntityStringQuery {
    func entities(matching string: String) async throws -> [CanaryPlaylistEntity] {
        SharedConstants.playlists
            .filter { $0.name.localizedCaseInsensitiveContains(string) }
            .map { CanaryPlaylistEntity(id: $0.id, name: $0.name) }
    }
}

// MARK: - Play playlist intent

struct PlayPlaylistIntent: AudioPlaybackIntent {
    static let title: LocalizedStringResource = "Play Playlist"
    static let openAppWhenRun = true

    @Parameter(title: "Playlist", requestValueDialog: "어떤 재생목록을 재생할까요?")
    var playlist: CanaryPlaylistEntity

    init() {}
    init(playlist: CanaryPlaylistEntity) { self.playlist = playlist }

    func perform() async throws -> some IntentResult {
        // Hand the request to the app, which starts playback once its library is ready.
        SharedConstants.sharedDefaults?.set(playlist.id, forKey: SharedConstants.pendingPlaylistIdKey)
        // Nudge the app in case it is already foreground-active (no scene/launch transition fires).
        await MainActor.run {
            NotificationCenter.default.post(name: .consumePendingSiri, object: nil)
        }
        return .result()
    }
}

// MARK: - Start playing intent

struct StartPlayingIntent: AudioPlaybackIntent {
    static let title: LocalizedStringResource = "Start Playing"
    static let openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        // Ask the app to resume/start playback once its library is ready.
        SharedConstants.sharedDefaults?.set(true, forKey: SharedConstants.pendingStartKey)
        await MainActor.run {
            NotificationCenter.default.post(name: .consumePendingSiri, object: nil)
        }
        return .result()
    }
}

// MARK: - App Shortcuts

// Phrases are authored here in the development language (English). Localized
// spoken phrases live in <locale>.lproj/AppShortcuts.strings, keyed by these
// source strings with ${applicationName} / ${playlist} placeholders. Siri only
// matches phrases in languages the app is localized for, so every supported
// Siri language needs an AppShortcuts.strings translation.
struct CanaryShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: PlayPlaylistIntent(),
            phrases: [
                // Parameter at the end matches most reliably by voice.
                "Play \(\.$playlist) in \(.applicationName)",
                "Play the \(\.$playlist) playlist in \(.applicationName)",
                "\(.applicationName) playlist \(\.$playlist)",
                // No-parameter phrase: Siri runs the intent and asks which playlist.
                "Play a playlist in \(.applicationName)",
            ],
            shortTitle: "Play Playlist",
            systemImageName: "music.note.list"
        )
        AppShortcut(
            intent: StartPlayingIntent(),
            phrases: [
                "Play in \(.applicationName)",
                "Start playing in \(.applicationName)",
            ],
            shortTitle: "Start Playing",
            systemImageName: "play.fill"
        )
        AppShortcut(
            intent: TogglePlayIntent(),
            phrases: [
                "Pause \(.applicationName)",
                "Resume \(.applicationName)",
            ],
            shortTitle: "Play or Pause",
            systemImageName: "playpause.fill"
        )
        AppShortcut(
            intent: NextTrackIntent(),
            phrases: [
                "Next song in \(.applicationName)",
            ],
            shortTitle: "Next Track",
            systemImageName: "forward.fill"
        )
        AppShortcut(
            intent: PreviousTrackIntent(),
            phrases: [
                "Previous song in \(.applicationName)",
            ],
            shortTitle: "Previous Track",
            systemImageName: "backward.fill"
        )
        AppShortcut(
            intent: ShuffleOnIntent(),
            phrases: [
                "Turn on shuffle in \(.applicationName)",
                "Shuffle on in \(.applicationName)",
            ],
            shortTitle: "Shuffle On",
            systemImageName: "shuffle"
        )
        AppShortcut(
            intent: ShuffleOffIntent(),
            phrases: [
                "Turn off shuffle in \(.applicationName)",
                "Shuffle off in \(.applicationName)",
            ],
            shortTitle: "Shuffle Off",
            systemImageName: "shuffle"
        )
        AppShortcut(
            intent: RepeatAllIntent(),
            phrases: [
                "Repeat all in \(.applicationName)",
                "Repeat everything in \(.applicationName)",
            ],
            shortTitle: "Repeat All",
            systemImageName: "repeat"
        )
        AppShortcut(
            intent: RepeatOneIntent(),
            phrases: [
                "Repeat one in \(.applicationName)",
                "Repeat this song in \(.applicationName)",
            ],
            shortTitle: "Repeat One",
            systemImageName: "repeat.1"
        )
        AppShortcut(
            intent: RepeatOffIntent(),
            phrases: [
                "Turn off repeat in \(.applicationName)",
                "Stop repeating in \(.applicationName)",
            ],
            shortTitle: "Repeat Off",
            systemImageName: "repeat"
        )
    }
}
