import UIKit

final class CoverImageCache: @unchecked Sendable {
    static let shared = CoverImageCache()

    private let memoryCache: NSCache<NSNumber, UIImage> = {
        let cache = NSCache<NSNumber, UIImage>()
        cache.countLimit = 200
        return cache
    }()
    private let directory: URL
    private let tracker = InFlightTracker()

    private init() {
        directory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("covers")
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    private func fileURL(for songId: Int) -> URL {
        directory.appendingPathComponent("\(songId)")
    }

    func image(for songId: Int, fetch: @Sendable () async -> Data?) async -> UIImage? {
        let key = NSNumber(value: songId)

        if let cached = memoryCache.object(forKey: key) {
            return cached
        }

        let url = fileURL(for: songId)
        let diskData: Data? = await Task.detached {
            try? Data(contentsOf: url)
        }.value
        if let diskData, let image = UIImage(data: diskData) {
            memoryCache.setObject(image, forKey: key)
            return image
        }

        let data = await tracker.deduplicated(key: songId, work: fetch)
        guard let data, let image = UIImage(data: data) else { return nil }

        memoryCache.setObject(image, forKey: key)
        Task.detached { try? data.write(to: url) }
        return image
    }

    func clearAll() {
        memoryCache.removeAllObjects()
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) else { return }
        for file in files {
            try? fm.removeItem(at: file)
        }
    }
}

private actor InFlightTracker {
    private var pending: [Int: [CheckedContinuation<Data?, Never>]] = [:]

    func deduplicated(key: Int, work: @Sendable () async -> Data?) async -> Data? {
        if pending[key] != nil {
            return await withCheckedContinuation { continuation in
                pending[key]?.append(continuation)
            }
        }

        pending[key] = []
        let result = await work()
        let waiters = pending.removeValue(forKey: key) ?? []
        for waiter in waiters {
            waiter.resume(returning: result)
        }
        return result
    }
}
