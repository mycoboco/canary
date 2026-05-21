import Testing
import Foundation
@testable import Canary

@Suite("AudioCache")
struct AudioCacheTests {
    let cache: AudioCache = {
        let c = AudioCache(directory: FileManager.default.temporaryDirectory.appendingPathComponent("canary-test-\(UUID().uuidString)"))
        c.maxSize = 1024
        return c
    }()

    @Test func fileURLFormat() {
        let url = cache.fileURL(songId: 42, format: "mp3")
        #expect(url.lastPathComponent == "42.mp3")
    }

    @Test func existsReturnsFalseForMissing() {
        #expect(!cache.exists(songId: 99, format: "mp3"))
    }

    @Test func saveAndExists() throws {
        let data = Data("fake audio".utf8)
        try cache.save(data: data, songId: 1, format: "mp3")
        #expect(cache.exists(songId: 1, format: "mp3"))
    }

    @Test func evictsOldFiles() throws {
        let bigData = Data(repeating: 0, count: 600)
        try cache.save(data: bigData, songId: 1, format: "mp3")
        Thread.sleep(forTimeInterval: 0.1)
        try cache.save(data: bigData, songId: 2, format: "mp3")
        cache.evictIfNeeded()
        #expect(!cache.exists(songId: 1, format: "mp3"))
        #expect(cache.exists(songId: 2, format: "mp3"))
    }
}
