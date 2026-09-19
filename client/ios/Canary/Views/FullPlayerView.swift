import SwiftUI

struct FullPlayerView: View {
    @Environment(AudioPlayer.self) private var player
    @Environment(\.dismiss) private var dismiss

    @State private var addingSong: Song?
    @State private var scrubbing = false
    @State private var sliderValue: TimeInterval = 0

    var body: some View {
        let currentTime = player.currentTime
        let duration = player.duration
        let isPlaying = player.isPlaying
        let shuffleMode = player.shuffleMode
        let repeatMode = player.repeatMode
        @Bindable var player = player

        VStack(spacing: 0) {
            Capsule()
                .fill(.secondary.opacity(0.3))
                .frame(width: 36, height: 5)
                .padding(.top, 8)

            Spacer()

            if let song = player.currentSong {
                AlbumCoverView(songId: song.id, size: 280)
                    .padding(.bottom, 32)

                VStack(spacing: 4) {
                    Text(song.title)
                        .font(.title2)
                        .fontWeight(.bold)
                        .lineLimit(1)
                    Text(song.artist)
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .padding(.horizontal, 24)

                VStack(spacing: 4) {
                    Slider(
                        value: $sliderValue,
                        in: 0...(duration > 0 ? duration : 1),
                        onEditingChanged: { editing in
                            scrubbing = editing
                            if !editing {
                                player.seek(to: sliderValue)
                            }
                        }
                    )
                    .tint(.primary)
                    .onChange(of: currentTime, initial: true) {
                        if !scrubbing { sliderValue = currentTime }
                    }

                    HStack {
                        Text(TimeFormatter.sec(sliderValue))
                            .monospacedDigit()
                        Spacer()
                        Text(TimeFormatter.sec(duration))
                            .monospacedDigit()
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 24)
                .padding(.top, 24)

                HStack(spacing: 32) {
                    Button { player.toggleShuffle() } label: {
                        Image(systemName: "shuffle")
                            .font(.title3)
                            .foregroundStyle(shuffleMode ? .blue : .secondary)
                    }

                    SeekButton(systemImage: "backward.fill", forward: false, player: player)

                    Button { player.togglePlay() } label: {
                        Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                            .font(.system(size: 56))
                    }

                    SeekButton(systemImage: "forward.fill", forward: true, player: player)

                    Button { player.toggleRepeat() } label: {
                        Image(systemName: repeatMode == .one ? "repeat.1" : "repeat")
                            .font(.title3)
                            .foregroundStyle(repeatMode != .none ? .blue : .secondary)
                    }
                }
                .buttonStyle(.plain)
                .padding(.top, 24)

                HStack(spacing: 8) {
                    Image(systemName: "speaker.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Slider(value: $player.volume, in: 0...1)
                        .tint(.secondary)
                    Image(systemName: "speaker.wave.3.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 24)
                .padding(.top, 20)

                Button {
                    addingSong = song
                } label: {
                    Image(systemName: "plus.circle")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .padding(.top, 16)
            }

            Spacer()
        }
        .presentationBackground(.ultraThinMaterial)
        .sheet(item: $addingSong) { song in
            AddToPlaylistSheet(song: song)
        }
        .onChange(of: player.currentSong?.id) {
            scrubbing = false
            sliderValue = 0
        }
    }

}

private struct SeekButton: View {
    let systemImage: String
    let forward: Bool
    let player: AudioPlayer

    private static let holdDelay: TimeInterval = 0.35

    @State private var seeking = false
    @State private var holdWork: DispatchWorkItem?

    var body: some View {
        Image(systemName: systemImage)
            .font(.title2)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        guard holdWork == nil, !seeking else { return }
                        let work = DispatchWorkItem {
                            seeking = true
                            player.beginSeek(forward: forward)
                        }
                        holdWork = work
                        DispatchQueue.main.asyncAfter(deadline: .now() + Self.holdDelay, execute: work)
                    }
                    .onEnded { _ in
                        holdWork?.cancel()
                        holdWork = nil
                        if seeking {
                            seeking = false
                            player.endSeek()
                        } else {
                            forward ? player.next() : player.prev()
                        }
                    }
            )
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel(forward ? "Next" : "Previous")
            .accessibilityAction { forward ? player.next() : player.prev() }
    }
}
