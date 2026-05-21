import SwiftUI

struct LoginView: View {
    var onLogin: (String, String) -> Void

    @State private var serverURL = ""
    @State private var port = "3689"
    @State private var password = ""
    @State private var error: String?
    @State private var connecting = false

    var body: some View {
        VStack(spacing: 24) {
            Text("canary")
                .font(.title)
                .fontWeight(.bold)

            Text("Enter your server address and password.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            VStack(spacing: 12) {
                HStack(spacing: 8) {
                    TextField("Server URL", text: $serverURL)
                        .textContentType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textFieldStyle(.roundedBorder)

                    TextField("Port", text: $port)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 72)
                }

                SecureField("Password", text: $password)
                    .textFieldStyle(.roundedBorder)
            }

            if let error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            Button {
                connect()
            } label: {
                if connecting {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Text("Connect")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(.primary)
            .disabled(serverURL.isEmpty || password.isEmpty || connecting)
        }
        .padding(32)
        .frame(maxWidth: 360)
    }

    private func connect() {
        connecting = true
        error = nil
        var host = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if !host.hasPrefix("http://") && !host.hasPrefix("https://") {
            host = "http://\(host)"
        }
        let p = port.trimmingCharacters(in: .whitespaces)
        let url = p.isEmpty ? host : "\(host):\(p)"
        let pwd = password.trimmingCharacters(in: .whitespaces)
        let api = APIClient(baseURL: url, password: pwd)

        Task {
            do {
                _ = try await api.fetchServer()
                onLogin(url, pwd)
            } catch let err as APIClient.APIError {
                switch err {
                case .unauthorized: error = "Invalid password"
                case .connectionFailed: error = "Cannot connect to server"
                case .serverError(let msg): error = msg
                }
            } catch {
                self.error = "Cannot connect to server"
            }
            connecting = false
        }
    }
}
