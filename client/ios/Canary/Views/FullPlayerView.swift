import SwiftUI
import UIKit

struct FullPlayerView: View {
    @Environment(AudioPlayer.self) private var player
    @Environment(APIClient.self) private var api

    @Binding var progress: CGFloat
    var onCollapse: () -> Void

    @State private var addingSong: Song?
    @State private var scrubbing = false
    @State private var sliderValue: TimeInterval = 0
    @State private var artColors: [Color] = []

    private let artSize: CGFloat = 300
    private static let dragRange: CGFloat = 420

    var body: some View {
        let currentTime = player.currentTime
        let duration = player.duration
        let isPlaying = player.isPlaying
        let shuffleMode = player.shuffleMode
        let repeatMode = player.repeatMode
        @Bindable var player = player

        ZStack {
            meshBackground.ignoresSafeArea()

            VStack(spacing: 0) {
                Capsule()
                    .fill(.white.opacity(0.4))
                    .frame(width: 36, height: 5)
                    .padding(.top, 8)
                    .contentShape(Rectangle())
                    .onTapGesture { onCollapse() }

                Spacer(minLength: 0)

                if let song = player.currentSong {
                    // Art is drawn by the shared flying overlay; this clear slot reports
                    // where the expanded art should sit.
                    Color.clear
                        .frame(width: artSize, height: artSize)
                        .anchorPreference(key: PlayerArtAnchor.self, value: .bounds) { ["full": $0] }

                    VStack(spacing: 4) {
                        Text(song.title)
                            .font(.title2)
                            .fontWeight(.bold)
                            .lineLimit(1)
                        Text(song.artist)
                            .font(.body)
                            .foregroundStyle(.white.opacity(0.75))
                            .lineLimit(1)
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 28)

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
                        .tint(.white)
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
                        .foregroundStyle(.white.opacity(0.7))
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 22)

                    HStack(spacing: 32) {
                        Button { player.toggleShuffle() } label: {
                            Image(systemName: "shuffle")
                                .font(.title3)
                                .foregroundStyle(shuffleMode ? .white : .white.opacity(0.45))
                        }

                        SeekButton(systemImage: "backward.fill", forward: false, player: player)

                        Button { player.togglePlay() } label: {
                            Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                                .font(.system(size: 60))
                        }

                        SeekButton(systemImage: "forward.fill", forward: true, player: player)

                        Button { player.toggleRepeat() } label: {
                            Image(systemName: repeatMode == .one ? "repeat.1" : "repeat")
                                .font(.title3)
                                .foregroundStyle(repeatMode != .none ? .white : .white.opacity(0.45))
                        }
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 24)

                    HStack(spacing: 8) {
                        Image(systemName: "speaker.fill")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.6))
                        Slider(value: $player.volume, in: 0...1)
                            .tint(.white.opacity(0.85))
                        Image(systemName: "speaker.wave.3.fill")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.6))
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 20)

                    Button {
                        addingSong = song
                    } label: {
                        Image(systemName: "plus.circle")
                            .font(.title2)
                            .foregroundStyle(.white.opacity(0.8))
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 14)
                }

                Spacer(minLength: 0)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
            .gesture(collapseDrag)
        }
        .opacity(progress)
        .sheet(item: $addingSong) { song in
            AddToPlaylistSheet(song: song)
        }
        .onChange(of: player.currentSong?.id) {
            scrubbing = false
            sliderValue = 0
        }
        .task(id: player.currentSong?.id) {
            await loadArtColors()
        }
    }

    // Drag down to shrink toward the mini player, following the finger via `progress`.
    private var collapseDrag: some Gesture {
        DragGesture(minimumDistance: 10)
            .onChanged { value in
                let p = 1 - max(0, value.translation.height) / Self.dragRange
                progress = min(max(p, 0), 1)
            }
            .onEnded { value in
                let collapse = value.translation.height > 110 || value.predictedEndTranslation.height > 260
                withAnimation(.spring(response: 0.45, dampingFraction: 0.9)) {
                    progress = collapse ? 0 : 1
                }
            }
    }

    // MARK: - Album-art mesh background

    private var meshBackground: some View {
        let colors = artColors.count == 9 ? artColors : Self.defaultMesh
        return MeshGradient(width: 3, height: 3, points: Self.meshPoints, colors: colors)
            .overlay(Color.black.opacity(0.2))
    }

    private func loadArtColors() async {
        guard let songId = player.currentSong?.id else {
            withAnimation(.easeInOut(duration: 0.4)) { artColors = [] }
            return
        }
        let api = self.api
        let image = await CoverImageCache.shared.image(for: songId, fetch: {
            await api.fetchCoverImage(for: songId)
        })
        guard player.currentSong?.id == songId else { return }
        // Always reflect the current song: fall back to the default mesh when the
        // cover is missing or can't be sampled (never keep the previous song's palette).
        let colors = image.map { Self.meshColors(from: $0) } ?? []
        withAnimation(.easeInOut(duration: 0.5)) { artColors = colors.count == 9 ? colors : [] }
    }

    private static let meshPoints: [SIMD2<Float>] = [
        [0, 0], [0.5, 0], [1, 0],
        [0, 0.5], [0.5, 0.5], [1, 0.5],
        [0, 1], [0.5, 1], [1, 1],
    ]

    private static let defaultMesh: [Color] = [
        Color(red: 0.16, green: 0.14, blue: 0.24), Color(red: 0.24, green: 0.16, blue: 0.30), Color(red: 0.13, green: 0.15, blue: 0.27),
        Color(red: 0.28, green: 0.17, blue: 0.31), Color(red: 0.18, green: 0.16, blue: 0.30), Color(red: 0.14, green: 0.18, blue: 0.33),
        Color(red: 0.20, green: 0.14, blue: 0.27), Color(red: 0.24, green: 0.18, blue: 0.35), Color(red: 0.12, green: 0.13, blue: 0.24),
    ]

    private static func meshColors(from image: UIImage, grid n: Int = 3) -> [Color] {
        guard let cg = image.cgImage, let space = CGColorSpace(name: CGColorSpace.sRGB) else { return [] }
        var data = [UInt8](repeating: 0, count: n * n * 4)
        guard let ctx = CGContext(
            data: &data, width: n, height: n, bitsPerComponent: 8, bytesPerRow: n * 4,
            space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return [] }
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: n, height: n))
        var colors: [Color] = []
        for i in 0..<(n * n) {
            let r = Double(data[i * 4]) / 255
            let g = Double(data[i * 4 + 1]) / 255
            let b = Double(data[i * 4 + 2]) / 255
            colors.append(Color(red: r * 0.78, green: g * 0.78, blue: b * 0.78))
        }
        return colors
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
            .onDisappear {
                holdWork?.cancel()
                holdWork = nil
                if seeking {
                    seeking = false
                    player.endSeek()
                }
            }
    }
}
