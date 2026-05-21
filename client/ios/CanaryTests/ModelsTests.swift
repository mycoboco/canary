import Testing
import Foundation
@testable import Canary

@Suite("Models")
struct ModelsTests {
    @Test func songDecodable() throws {
        let json = """
        {"id":1,"title":"Test","artist":"Artist","album":"Album","genre":"Rock","year":2024,"track":1,"time":180000,"format":"mp3"}
        """.data(using: .utf8)!
        let song = try JSONDecoder().decode(Song.self, from: json)
        #expect(song.id == 1)
        #expect(song.title == "Test")
        #expect(song.time == 180000)
        #expect(song.format == "mp3")
    }

    @Test func playlistManualDecodable() throws {
        let json = """
        {"id":2,"name":"My List","type":"manual","songIds":[1,2,3]}
        """.data(using: .utf8)!
        let playlist = try JSONDecoder().decode(Playlist.self, from: json)
        #expect(playlist.id == 2)
        #expect(playlist.type == .manual)
        #expect(playlist.songIds == [1, 2, 3])
        #expect(playlist.rules == nil)
    }

    @Test func playlistSmartDecodable() throws {
        let json = """
        {"id":3,"name":"Rock","type":"smart","match":"all","rules":[{"field":"genre","op":"is","value":"Rock"}]}
        """.data(using: .utf8)!
        let playlist = try JSONDecoder().decode(Playlist.self, from: json)
        #expect(playlist.type == .smart)
        #expect(playlist.match == "all")
        #expect(playlist.rules?.count == 1)
        #expect(playlist.rules?[0].field == "genre")
    }

    @Test func playlistBuiltinDecodable() throws {
        let json = """
        {"id":1,"name":"Recently Added","type":"builtin"}
        """.data(using: .utf8)!
        let playlist = try JSONDecoder().decode(Playlist.self, from: json)
        #expect(playlist.type == .builtin)
    }

    @Test func serverInfoDecodable() throws {
        let json = """
        {"name":"canary music","version":"0.5.3","songCount":42}
        """.data(using: .utf8)!
        let info = try JSONDecoder().decode(ServerInfo.self, from: json)
        #expect(info.name == "canary music")
        #expect(info.version == "0.5.3")
        #expect(info.songCount == 42)
    }
}
