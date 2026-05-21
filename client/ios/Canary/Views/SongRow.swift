import SwiftUI

struct SongRow: View {
    let song: Song
    let isPlaying: Bool

    @Environment(AudioPlayer.self) private var player

    var body: some View {
        HStack(spacing: 12) {
            AlbumCoverView(songId: song.id, size: 44)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(song.title)
                        .font(.subheadline)
                        .lineLimit(1)
                    if player.isCached(song) {
                        Image(systemName: "arrow.down.circle.fill")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                Text("\(song.artist) — \(song.album)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            Text(TimeFormatter.ms(song.time))
                .font(.caption)
                .foregroundStyle(.secondary)
                .monospacedDigit()
        }
        .contentShape(Rectangle())
        .foregroundStyle(isPlaying ? .blue : .primary)
    }
}
