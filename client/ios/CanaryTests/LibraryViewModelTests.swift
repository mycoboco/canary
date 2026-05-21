import Testing
import Foundation
@testable import Canary

@Suite("LibraryViewModel Grouping")
struct LibraryViewModelTests {
    let songs = [
        Song(id: 1, title: "A", artist: "X", album: "Alpha", genre: "Rock", year: 2024, track: 2, time: 180000, format: "mp3"),
        Song(id: 2, title: "B", artist: "X", album: "Alpha", genre: "Rock", year: 2024, track: 1, time: 200000, format: "mp3"),
        Song(id: 3, title: "C", artist: "Y", album: "Beta", genre: "Pop", year: 2023, track: 1, time: 150000, format: "mp3"),
    ]

    @Test func groupGenres() {
        let genres = LibraryViewModel.groupByKey(songs, key: \.genre)
        #expect(genres.count == 2)
        let pop = genres.first { $0.name == "Pop" }
        #expect(pop?.count == 1)
        let rock = genres.first { $0.name == "Rock" }
        #expect(rock?.count == 2)
    }

    @Test func groupArtists() {
        let artists = LibraryViewModel.groupByKey(songs, key: \.artist)
        #expect(artists.count == 2)
        #expect(artists[0].name == "X")
        #expect(artists[0].count == 2)
    }

    @Test func groupAlbums() {
        let albums = LibraryViewModel.buildAlbums(songs)
        #expect(albums.count == 2)
        let alpha = albums.first { $0.name == "Alpha" }!
        #expect(alpha.artist == "X")
        #expect(alpha.songs[0].track == 1)
        #expect(alpha.songs[1].track == 2)
        #expect(alpha.coverId == 2)
    }

    @Test func genresSortedAlphabetically() {
        let genres = LibraryViewModel.groupByKey(songs, key: \.genre)
        #expect(genres[0].name == "Pop")
        #expect(genres[1].name == "Rock")
    }

    @Test func albumsSortedAlphabetically() {
        let albums = LibraryViewModel.buildAlbums(songs)
        #expect(albums[0].name == "Alpha")
        #expect(albums[1].name == "Beta")
    }
}
