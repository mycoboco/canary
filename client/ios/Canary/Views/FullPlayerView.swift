import SwiftUI

struct FullPlayerView: View {
    @Environment(AudioPlayer.self) private var player
    @Environment(\.dismiss) private var dismiss

    @State private var addingSong: Song?
    @State private var scrubbing = false
    @State private var scrubTime: TimeInterval = 0
    @GestureState private var dragOffset: CGFloat = 0

    private let dismissDistance: CGFloat = 100
    private let directionRatio: CGFloat = 1.5

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
                        value: Binding(
                            get: { scrubbing ? scrubTime : currentTime },
                            set: { scrubbing = true; scrubTime = $0 }
                        ),
                        in: 0...(duration > 0 ? duration : 1),
                        onEditingChanged: { editing in
                            if !editing {
                                player.seek(to: scrubTime)
                                scrubbing = false
                            }
                        }
                    )
                    .tint(.primary)
                    .id(song.id)

                    HStack {
                        Text(TimeFormatter.sec(scrubbing ? scrubTime : currentTime))
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

                    Button { player.prev() } label: {
                        Image(systemName: "backward.fill")
                            .font(.title2)
                    }

                    Button { player.togglePlay() } label: {
                        Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                            .font(.system(size: 56))
                    }

                    Button { player.next() } label: {
                        Image(systemName: "forward.fill")
                            .font(.title2)
                    }

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
        .offset(y: dragOffset)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: dragOffset)
        .simultaneousGesture(
            DragGesture(minimumDistance: 30)
                .updating($dragOffset) { value, state, _ in
                    if isVerticalSwipe(value) && value.translation.height > 0 {
                        state = value.translation.height
                    }
                }
                .onEnded { value in
                    if value.translation.height > dismissDistance && isVerticalSwipe(value) {
                        dismiss()
                    }
                }
        )
        .accessibilityAction(.escape) { dismiss() }
        .presentationBackground(.ultraThinMaterial)
        .sheet(item: $addingSong) { song in
            AddToPlaylistSheet(song: song)
        }
        .onChange(of: player.currentSong?.id) {
            scrubbing = false
            scrubTime = 0
        }
    }

    private func isVerticalSwipe(_ value: DragGesture.Value) -> Bool {
        abs(value.translation.height) > abs(value.translation.width) * directionRatio
    }
}
