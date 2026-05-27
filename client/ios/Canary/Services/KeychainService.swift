import Foundation
import Security

struct Credentials: Sendable {
    let serverURL: String
    let password: String
}

enum KeychainService {
    private static let service = "org.woong.canary"
    private static let accountURL = "serverURL"
    private static let accountPassword = "password"

    static func save(_ credentials: Credentials) {
        set(key: accountURL, value: credentials.serverURL)
        set(key: accountPassword, value: credentials.password)
    }

    static func load() -> Credentials? {
        guard let url = get(key: accountURL),
              let password = get(key: accountPassword) else {
            return nil
        }
        return Credentials(serverURL: url, password: password)
    }

    static func delete() {
        remove(key: accountURL)
        remove(key: accountPassword)
    }

    @discardableResult
    private static func set(key: String, value: String) -> Bool {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let status = SecItemAdd(add as CFDictionary, nil)
        return status == errSecSuccess
    }

    private static func get(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func remove(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
