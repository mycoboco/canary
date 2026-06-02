import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Timeline

struct PlayerEntry: TimelineEntry {
    let date: Date
    let nowPlaying: SharedNowPlaying?
    let coverData: Data?
}

struct PlayerProvider: TimelineProvider {
    func placeholder(in context: Context) -> PlayerEntry {
        PlayerEntry(
            date: .now,
            nowPlaying: SharedNowPlaying(songId: 0, title: "Song Title", artist: "Artist", album: "Album", isPlaying: true),
            coverData: nil
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (PlayerEntry) -> Void) {
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PlayerEntry>) -> Void) {
        completion(Timeline(entries: [currentEntry()], policy: .never))
    }

    private func currentEntry() -> PlayerEntry {
        let defaults = SharedConstants.sharedDefaults
        var nowPlaying: SharedNowPlaying?
        if let data = defaults?.data(forKey: SharedConstants.nowPlayingKey) {
            nowPlaying = try? JSONDecoder().decode(SharedNowPlaying.self, from: data)
        }
        let coverData = defaults?.data(forKey: SharedConstants.coverDataKey)
        return PlayerEntry(date: .now, nowPlaying: nowPlaying, coverData: coverData)
    }
}

// MARK: - Intents

struct TogglePlayIntent: AppIntent {
    static let title: LocalizedStringResource = "Toggle Play"
    static let openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult {
        if SharedConstants.clearStateIfAppDead() {
            WidgetCenter.shared.reloadAllTimelines()
            return .result()
        }
        if let defaults = SharedConstants.sharedDefaults,
           let data = defaults.data(forKey: SharedConstants.nowPlayingKey),
           let np = try? JSONDecoder().decode(SharedNowPlaying.self, from: data) {
            let toggled = SharedNowPlaying(
                songId: np.songId, title: np.title, artist: np.artist,
                album: np.album, isPlaying: !np.isPlaying
            )
            if let encoded = try? JSONEncoder().encode(toggled) {
                defaults.set(encoded, forKey: SharedConstants.nowPlayingKey)
            }
        }
        WidgetCommand.togglePlay.post()
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

struct NextTrackIntent: AppIntent {
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

struct PreviousTrackIntent: AppIntent {
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

// MARK: - Views

struct PlayerWidgetView: View {
    let entry: PlayerEntry
    @Environment(\.widgetFamily) var family

    private var np: SharedNowPlaying? { entry.nowPlaying }
    private var hasNowPlaying: Bool { np != nil }

    var body: some View {
        switch family {
        case .systemSmall: smallView
        default: mediumView
        }
    }

    private var smallView: some View {
        ZStack(alignment: .bottom) {
            GeometryReader { geo in
                let side = min(geo.size.width, geo.size.height)
                coverImage
                    .frame(width: side, height: side)
                    .clipped()
                    .frame(width: geo.size.width, height: geo.size.height)
            }
            .clipShape(ContainerRelativeShape())

            VStack(spacing: 6) {
                if hasNowPlaying {
                    Button(intent: TogglePlayIntent()) {
                        playPauseCircle
                    }
                    .buttonStyle(.plain)
                } else {
                    Link(destination: URL(string: "canary://play")!) {
                        playPauseCircle
                    }
                }

                Text(np?.title ?? "Canary")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .lineLimit(1)
                Text(np?.artist ?? "Not Playing")
                    .font(.caption2)
                    .lineLimit(1)
                    .opacity(0.8)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 8)
            .padding(.bottom, 10)
            .frame(maxWidth: .infinity)
            .background(
                LinearGradient(colors: [.clear, .black.opacity(0.6)], startPoint: .top, endPoint: .bottom)
                    .clipShape(ContainerRelativeShape())
            )
        }
        .containerBackground(.black, for: .widget)
    }

    private var playPauseCircle: some View {
        Image(systemName: np?.isPlaying == true ? "pause.fill" : "play.fill")
            .font(.title2)
            .foregroundStyle(.white)
            .frame(width: 40, height: 40)
            .background(.ultraThinMaterial, in: Circle())
    }

    private var mediumView: some View {
        HStack(spacing: 12) {
            GeometryReader { geo in
                let size = geo.size.height
                coverImage
                    .frame(width: size, height: size)
                    .clipped()
            }
            .aspectRatio(1, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.vertical, 4)

            VStack(spacing: 0) {
                Spacer()

                VStack(spacing: 2) {
                    Text(np?.title ?? "Not Playing")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .lineLimit(1)
                    Text(np?.artist ?? "Tap play to start")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity)

                Spacer()

                HStack(spacing: 0) {
                    if hasNowPlaying {
                        Button(intent: PreviousTrackIntent()) {
                            Image(systemName: "backward.fill")
                                .font(.body)
                                .frame(maxWidth: .infinity)
                        }
                        Button(intent: TogglePlayIntent()) {
                            Image(systemName: np?.isPlaying == true ? "pause.fill" : "play.fill")
                                .font(.title2)
                                .frame(maxWidth: .infinity)
                        }
                        Button(intent: NextTrackIntent()) {
                            Image(systemName: "forward.fill")
                                .font(.body)
                                .frame(maxWidth: .infinity)
                        }
                    } else {
                        Link(destination: URL(string: "canary://play")!) {
                            Image(systemName: "play.fill")
                                .font(.title2)
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
                .buttonStyle(.plain)

                Spacer()
            }
            .padding(.horizontal, 8)
        }
        .containerBackground(.fill.tertiary, for: .widget)
    }

    @ViewBuilder
    private var coverImage: some View {
        if let data = entry.coverData, let uiImage = UIImage(data: data) {
            Image(uiImage: uiImage)
                .resizable()
                .aspectRatio(contentMode: .fill)
        } else {
            Color.gray.opacity(0.2)
                .overlay {
                    Image(systemName: "music.note")
                        .foregroundStyle(.gray)
                }
        }
    }

}

// MARK: - Widget

struct PlayerWidget: Widget {
    let kind = "PlayerWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PlayerProvider()) { entry in
            PlayerWidgetView(entry: entry)
        }
        .configurationDisplayName("Now Playing")
        .description("Control music playback")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct CanaryWidgetBundle: WidgetBundle {
    var body: some Widget {
        PlayerWidget()
    }
}
