#if canImport(MediaIntents)
import AppIntents
import Foundation
import MediaIntents

// Adopts Apple's audio assistant schema so Siri's media domain routes
// "play <playlist name> in Canary" to the app: the IntentValueQuery answers
// Siri's AudioSearch with matching playlists, and PlayAudioIntent plays the
// chosen one.

// MARK: - Schema enums

@available(iOS 27.0, *)
@AppEnum(schema: .audio.playbackAttributes)
enum CanaryPlaybackAttribute: String {
    case shuffle
    case `repeat`

    static var caseDisplayRepresentations: [CanaryPlaybackAttribute: DisplayRepresentation] {
        [.shuffle: "Shuffle", .repeat: "Repeat"]
    }
}

@available(iOS 27.0, *)
@AppEnum(schema: .audio.queueInsertionLocation)
enum CanaryQueueLocation: String {
    case next
    case tail

    static var caseDisplayRepresentations: [CanaryQueueLocation: DisplayRepresentation] {
        [.next: "Play Next", .tail: "Play Last"]
    }
}

// MARK: - Warmup result (schema entity with no properties)

@AppEntity(schema: .audio.warmupAudioQueueResult)
struct CanaryWarmupResult {
    let id: String

    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "Warmup") }

    static let defaultQuery = CanaryWarmupQuery()

    init(id: String = "warmup") { self.id = id }
}

struct CanaryWarmupQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [CanaryWarmupResult] { [] }
    func entities(matching string: String) async throws -> [CanaryWarmupResult] { [] }
}

// Playlist owner union required by the audio.playlist schema.
@UnionValue
enum CanaryPlaylistOwner {
    case person(IntentPerson)
    case name(String)
}

// MARK: - Playlist entity (audio.playlist schema)

@AppEntity(schema: .audio.playlist)
struct AudioPlaylistEntity {
    let id: Int

    @Property(title: "Title")
    var title: String

    @Property(title: "Owner")
    var owner: CanaryPlaylistOwner?

    @Property(title: "Created By Me")
    var createdByMe: Bool?

    @Property(title: "Curated For Me")
    var curatedForMe: Bool?

    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(title)") }

    static let defaultQuery = AudioPlaylistQuery()

    init(_ playlist: SharedPlaylist) {
        self.id = playlist.id
        self.title = playlist.name
        self.owner = nil
        self.createdByMe = nil
        self.curatedForMe = nil
    }
}

struct AudioPlaylistQuery: EntityQuery, IntentValueQuery {
    func entities(for identifiers: [Int]) async throws -> [AudioPlaylistEntity] {
        SharedConstants.playlists.filter { identifiers.contains($0.id) }.map(AudioPlaylistEntity.init)
    }

    func suggestedEntities() async throws -> [AudioPlaylistEntity] {
        SharedConstants.playlists.map(AudioPlaylistEntity.init)
    }

    // Siri audio search → resolve the spoken term to playlists.
    func values(for input: AudioSearch) async throws -> [AudioPlaylistEntity] {
        switch input.criteria {
        case .searchQuery(let query):
            return SharedConstants.playlists.filter { $0.name.localizedCaseInsensitiveContains(query) }.map(AudioPlaylistEntity.init)
        case .unspecified:
            return SharedConstants.playlists.map(AudioPlaylistEntity.init)
        case .url:
            return []
        @unknown default:
            return []
        }
    }
}

// MARK: - Playable union (subset of the schema's audioEntity union)

@UnionValue
enum CanaryAudioItem {
    case playlist(AudioPlaylistEntity)
}

// MARK: - Play intent (audio.playAudio schema)

@AppIntent(schema: .audio.playAudio)
struct PlayAudioIntent {
    // Only the assistant (Siri) uses this; the user-facing "Play Playlist"
    // shortcut stays PlayPlaylistIntent, so this doesn't duplicate it.
    static let isAssistantOnly = true

    @Parameter(title: "Audio Item")
    var audioEntity: CanaryAudioItem

    @Parameter(title: "Playback Attributes")
    var playbackAttributes: Set<CanaryPlaybackAttribute>

    @Parameter(title: "Warmup Audio Queue Result")
    var warmupAudioQueueResult: CanaryWarmupResult?

    @Parameter(title: "Queue Location")
    var queueLocation: CanaryQueueLocation?

    func perform() async throws -> some IntentResult {
        guard case .playlist(let playlist) = audioEntity else { return .result() }
        // Start playback directly on the shared player so Siri plays without
        // bringing the app to the foreground.
        await AudioPlayer.shared.playPlaylistById(playlist.id)
        // Honor the playback attributes Siri requested (e.g. "shuffle <playlist>").
        // Shuffle must be applied after the queue is populated.
        if playbackAttributes.contains(.shuffle) {
            await AudioPlayer.shared.setShuffle(true)
        }
        if playbackAttributes.contains(.repeat) {
            await AudioPlayer.shared.setRepeatMode(.all)
        }
        return .result()
    }
}
#endif
