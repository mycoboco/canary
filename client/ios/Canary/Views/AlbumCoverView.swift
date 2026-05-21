import SwiftUI

struct AlbumCoverView: View {
    let songId: Int?
    var size: CGFloat = 40

    @Environment(APIClient.self) private var api
    @State private var image: UIImage?
    @State private var failed = false

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else {
                fallbackView
            }
        }
        .frame(width: size > 0 ? size : nil, height: size > 0 ? size : nil)
        .clipShape(RoundedRectangle(cornerRadius: size > 60 ? 12 : 6))
        .task(id: songId) {
            await loadImage()
        }
    }

    private var fallbackView: some View {
        Rectangle()
            .fill(.gray.opacity(0.15))
            .overlay {
                Image(systemName: "music.note")
                    .foregroundStyle(.gray.opacity(0.4))
                    .font(.system(size: max(size * 0.4, 16)))
            }
    }

    private func loadImage() async {
        image = nil
        failed = false
        guard let songId else { return }
        let api = api
        if let loaded = await CoverImageCache.shared.image(for: songId, fetch: {
            await api.fetchCoverImage(for: songId)
        }) {
            image = loaded
        } else {
            failed = true
        }
    }
}
