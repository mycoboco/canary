import Foundation

// Resolves a spoken playlist name to playlists, tolerant of speech-recognition
// variance. Exact/substring matches (accent-, case-, width-insensitive) win;
// otherwise it falls back to edit distance over canonically-decomposed scalars
// so near-homophones still resolve — e.g. Siri hearing "캐롤" for a "케롤"
// playlist, which differ by a single Hangul jamo (ㅐ↔ㅔ) once decomposed.
// Language-neutral: the same decomposition splits accented Latin into base
// letters plus marks, so no per-language rules are needed here.
enum PlaylistMatcher {
    static func match(_ spokenName: String, in playlists: [SharedPlaylist], limit: Int = 5) -> [SharedPlaylist] {
        let query = fold(spokenName)
        guard !query.isEmpty else { return playlists }
        let queryScalars = Array(query.unicodeScalars)

        var substringHits: [SharedPlaylist] = []
        var fuzzyHits: [(playlist: SharedPlaylist, distance: Int)] = []

        for playlist in playlists {
            let name = fold(playlist.name)
            if name.contains(query) || query.contains(name) {
                substringHits.append(playlist)
                continue
            }
            let nameScalars = Array(name.unicodeScalars)
            let distance = editDistance(queryScalars, nameScalars)
            // Allow roughly a third of the (longer) length to differ.
            let threshold = max(1, Int((Double(max(queryScalars.count, nameScalars.count)) * 0.34).rounded()))
            if distance <= threshold {
                fuzzyHits.append((playlist, distance))
            }
        }

        if !substringHits.isEmpty {
            // Closest (shortest) names first.
            return Array(substringHits.sorted { fold($0.name).count < fold($1.name).count }.prefix(limit))
        }
        return Array(fuzzyHits.sorted { $0.distance < $1.distance }.map(\.playlist).prefix(limit))
    }

    // Lowercase, canonically decompose (NFD), then drop combining marks and
    // whitespace. For Hangul this yields conjoining jamo, so vowel confusions
    // become single-scalar edits.
    static func fold(_ string: String) -> String {
        var scalars = String.UnicodeScalarView()
        for scalar in string.lowercased().decomposedStringWithCanonicalMapping.unicodeScalars {
            if scalar.properties.generalCategory == .nonspacingMark { continue }
            if scalar.properties.isWhitespace { continue }
            scalars.append(scalar)
        }
        return String(scalars)
    }

    private static func editDistance<Element: Equatable>(_ a: [Element], _ b: [Element]) -> Int {
        if a.isEmpty { return b.count }
        if b.isEmpty { return a.count }
        var previous = Array(0...b.count)
        var current = [Int](repeating: 0, count: b.count + 1)
        for i in 1...a.count {
            current[0] = i
            for j in 1...b.count {
                let cost = a[i - 1] == b[j - 1] ? 0 : 1
                current[j] = min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
            }
            swap(&previous, &current)
        }
        return previous[b.count]
    }
}
