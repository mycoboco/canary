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

struct PlayPlaylistIntent: AppIntent {
    static let title: LocalizedStringResource = "Play Playlist"
    static let openAppWhenRun = true

    @Parameter(title: "Playlist")
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

struct StartPlayingIntent: AppIntent {
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

struct CanaryShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: PlayPlaylistIntent(),
            phrases: [
                "Play \(\.$playlist) in \(.applicationName)",
                "\(.applicationName)에서 \(\.$playlist) 재생",
            ],
            shortTitle: "Play Playlist",
            systemImageName: "music.note.list"
        )
        AppShortcut(
            intent: StartPlayingIntent(),
            phrases: [
                "Play in \(.applicationName)",
                "Start playing in \(.applicationName)",
                "\(.applicationName) 재생",
                "\(.applicationName) 재생 시작",
            ],
            shortTitle: "Start Playing",
            systemImageName: "play.fill"
        )
        AppShortcut(
            intent: TogglePlayIntent(),
            phrases: [
                "Pause \(.applicationName)",
                "Resume \(.applicationName)",
                "\(.applicationName) 일시정지",
            ],
            shortTitle: "Play or Pause",
            systemImageName: "playpause.fill"
        )
        AppShortcut(
            intent: NextTrackIntent(),
            phrases: [
                "Next song in \(.applicationName)",
                "\(.applicationName) 다음 곡",
            ],
            shortTitle: "Next Track",
            systemImageName: "forward.fill"
        )
        AppShortcut(
            intent: PreviousTrackIntent(),
            phrases: [
                "Previous song in \(.applicationName)",
                "\(.applicationName) 이전 곡",
            ],
            shortTitle: "Previous Track",
            systemImageName: "backward.fill"
        )
    }
}
