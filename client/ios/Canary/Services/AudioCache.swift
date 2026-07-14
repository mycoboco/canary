import Foundation

final class AudioCache: Sendable {
    static let minSize: Int64 = 100 * 1024 * 1024       // 100 MB
    static let maxAllowedSize: Int64 = 4 * 1024 * 1024 * 1024  // 4 GB
    static let defaultSize: Int64 = 1024 * 1024 * 1024   // 1 GB

    private static let sizeKey = "canary.cacheMaxSize"

    let directory: URL
    let pendingDirectory: URL

    var maxSize: Int64 {
        get {
            let stored = UserDefaults.standard.integer(forKey: Self.sizeKey)
            return stored > 0 ? Int64(stored) : Self.defaultSize
        }
        set {
            let clamped = max(Self.minSize, min(newValue, Self.maxAllowedSize))
            UserDefaults.standard.set(Int(clamped), forKey: Self.sizeKey)
        }
    }

    init(
        directory: URL = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("audio")
    ) {
        self.directory = directory
        self.pendingDirectory = directory.deletingLastPathComponent()
            .appendingPathComponent(directory.lastPathComponent + "-pending")
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try? FileManager.default.createDirectory(at: pendingDirectory, withIntermediateDirectories: true)
    }

    private static func sanitize(_ format: String) -> String {
        let allowed = CharacterSet.alphanumerics
        return String(format.unicodeScalars.filter { allowed.contains($0) })
    }

    func fileURL(songId: Int, format: String) -> URL {
        directory.appendingPathComponent("\(songId).\(Self.sanitize(format))")
    }

    func exists(songId: Int, format: String) -> Bool {
        FileManager.default.fileExists(atPath: fileURL(songId: songId, format: format).path)
    }

    func touch(songId: Int, format: String) {
        let url = fileURL(songId: songId, format: format)
        try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: url.path)
    }

    func save(data: Data, songId: Int, format: String) throws {
        let url = fileURL(songId: songId, format: format)
        try data.write(to: url)
    }

    func currentSize() -> Int64 {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.fileSizeKey]) else { return 0 }
        return files.reduce(into: Int64(0)) { total, file in
            let size = (try? file.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0
            total += Int64(size)
        }
    }

    func fileCount() -> Int {
        (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil))?.count ?? 0
    }

    func clearAll() {
        let fm = FileManager.default
        for dir in [directory, pendingDirectory] {
            guard let files = try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) else { continue }
            for file in files {
                try? fm.removeItem(at: file)
            }
        }
    }

    func pendingFileURL(songId: Int, format: String) -> URL {
        pendingDirectory.appendingPathComponent("\(songId).\(Self.sanitize(format))")
    }

    func promotePending(songId: Int, format: String) {
        let src = pendingFileURL(songId: songId, format: format)
        guard FileManager.default.fileExists(atPath: src.path) else { return }
        let dst = fileURL(songId: songId, format: format)
        try? FileManager.default.moveItem(at: src, to: dst)
        evictIfNeeded()
    }

    func clearPending(songId: Int, format: String) {
        try? FileManager.default.removeItem(at: pendingFileURL(songId: songId, format: format))
    }

    func evictIfNeeded() {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.contentModificationDateKey, .fileSizeKey]) else { return }

        var totalSize: Int64 = 0
        var entries: [(url: URL, date: Date, size: Int64)] = []

        for file in files {
            guard let values = try? file.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey]) else { continue }
            let size = Int64(values.fileSize ?? 0)
            let date = values.contentModificationDate ?? .distantPast
            totalSize += size
            entries.append((file, date, size))
        }

        guard totalSize > maxSize else { return }

        entries.sort { $0.date < $1.date }
        for entry in entries {
            try? fm.removeItem(at: entry.url)
            totalSize -= entry.size
            if totalSize <= maxSize { break }
        }
    }
}
