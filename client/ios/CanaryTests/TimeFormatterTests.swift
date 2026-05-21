import Testing
@testable import Canary

@Suite("TimeFormatter")
struct TimeFormatterTests {
    @Test func formatMsZero() {
        #expect(TimeFormatter.ms(0) == "0:00")
    }

    @Test func formatMsSeconds() {
        #expect(TimeFormatter.ms(5000) == "0:05")
    }

    @Test func formatMsMinutes() {
        #expect(TimeFormatter.ms(65000) == "1:05")
    }

    @Test func formatMsPadding() {
        #expect(TimeFormatter.ms(60000) == "1:00")
    }

    @Test func formatMsLarge() {
        #expect(TimeFormatter.ms(3_723_000) == "62:03")
    }

    @Test func formatSecZero() {
        #expect(TimeFormatter.sec(0) == "0:00")
    }

    @Test func formatSecNormal() {
        #expect(TimeFormatter.sec(125) == "2:05")
    }

    @Test func formatSecInfinity() {
        #expect(TimeFormatter.sec(.infinity) == "0:00")
    }

    @Test func formatSecNaN() {
        #expect(TimeFormatter.sec(.nan) == "0:00")
    }

    @Test func formatSecFractional() {
        #expect(TimeFormatter.sec(65.7) == "1:05")
    }
}
