import Foundation

enum TimeFormatter {
    static func ms(_ ms: Int) -> String {
        let s = ms / 1000
        let min = s / 60
        let sec = s % 60
        return "\(min):\(String(format: "%02d", sec))"
    }

    static func sec(_ sec: Double) -> String {
        guard sec.isFinite else { return "0:00" }
        let total = Int(sec)
        let m = total / 60
        let s = total % 60
        return "\(m):\(String(format: "%02d", s))"
    }
}
