import SwiftUI

struct MiniPlayerView: View {
    @Environment(AudioPlayer.self) private var player

    var progress: CGFloat
    var onExpand: () -> Void

    var body: some View {
        if let song = player.currentSong {
            HStack(spacing: 12) {
                // The album art itself is drawn by the shared flying overlay; this
                // clear slot just reports where the mini art should sit.
                Color.clear
                    .frame(width: 40, height: 40)
                    .anchorPreference(key: PlayerArtAnchor.self, value: .bounds) { ["mini": $0] }

                VStack(alignment: .leading, spacing: 2) {
                    Text(song.title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .lineLimit(1)
                    Text(song.artist)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                Button {
                    player.togglePlay()
                } label: {
                    Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                        .font(.title3)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .glassEffect(in: RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 8)
            .padding(.bottom, 8)
            .contentShape(Rectangle())
            .onTapGesture { onExpand() }
            .opacity(1 - progress)
        }
    }
}
