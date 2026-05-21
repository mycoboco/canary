import Testing
import Foundation
@testable import Canary

final class MockURLProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: ((URLRequest) -> (Data, HTTPURLResponse))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else { return }
        let (data, response) = handler(request)
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

@Suite("APIClient")
struct APIClientTests {
    func makeClient() -> APIClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        return APIClient(
            baseURL: "http://test.local",
            password: "secret",
            session: URLSession(configuration: config)
        )
    }

    @Test func fetchServerInfo() async throws {
        MockURLProtocol.handler = { request in
            #expect(request.url?.path == "/api/server")
            let auth = request.value(forHTTPHeaderField: "Authorization")!
            let expected = "Basic " + Data("web:secret".utf8).base64EncodedString()
            #expect(auth == expected)
            let json = #"{"name":"canary","version":"0.5.3","songCount":10}"#
            return (Data(json.utf8), HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        }
        let info = try await makeClient().fetchServer()
        #expect(info.name == "canary")
        #expect(info.songCount == 10)
    }

    @Test func fetchSongs() async throws {
        MockURLProtocol.handler = { request in
            #expect(request.url?.path == "/api/songs")
            let json = #"[{"id":1,"title":"Song","artist":"Art","album":"Alb","genre":"Rock","year":2024,"track":1,"time":180000,"format":"mp3"}]"#
            return (Data(json.utf8), HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        }
        let songs = try await makeClient().fetchSongs()
        #expect(songs.count == 1)
        #expect(songs[0].title == "Song")
    }

    @Test func authError() async {
        MockURLProtocol.handler = { request in
            return (Data(), HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!)
        }
        do {
            _ = try await makeClient().fetchServer()
            Issue.record("Expected AuthError")
        } catch let error as APIClient.APIError {
            if case .unauthorized = error {} else {
                Issue.record("Expected unauthorized, got \(error)")
            }
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }
}
