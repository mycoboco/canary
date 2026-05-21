import SwiftUI

struct PlaylistEditorView: View {
    enum Mode {
        case createSmart
        case createManual
        case edit(Playlist)
    }

    let mode: Mode

    @Environment(PlaylistViewModel.self) private var playlistVM
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var match: String
    @State private var rules: [EditableRule]
    @State private var error: String?

    private let fields: [(value: String, label: String, type: String)] = [
        ("title", "Title", "string"),
        ("artist", "Artist", "string"),
        ("album", "Album", "string"),
        ("genre", "Genre", "string"),
        ("year", "Year", "number"),
    ]

    private let stringOps = ["is", "contains", "starts_with", "ends_with"]
    private let numberOps = ["is", ">", ">=", "<", "<="]

    struct EditableRule: Identifiable {
        let id = UUID()
        var field: String
        var op: String
        var value: String
    }

    init(mode: Mode) {
        self.mode = mode
        switch mode {
        case .createSmart:
            _name = State(initialValue: "")
            _match = State(initialValue: "all")
            _rules = State(initialValue: [EditableRule(field: "title", op: "contains", value: "")])
        case .createManual:
            _name = State(initialValue: "")
            _match = State(initialValue: "all")
            _rules = State(initialValue: [])
        case .edit(let playlist):
            _name = State(initialValue: playlist.name)
            _match = State(initialValue: playlist.match ?? "all")
            _rules = State(initialValue: playlist.rules?.map {
                EditableRule(field: $0.field, op: $0.op, value: $0.value)
            } ?? [EditableRule(field: "title", op: "contains", value: "")])
        }
    }

    private var isSmart: Bool {
        switch mode {
        case .createSmart: true
        case .createManual: false
        case .edit(let p): p.type == .smart
        }
    }

    var body: some View {
        Form {
            Section("Name") {
                TextField("Playlist name", text: $name)
            }

            if isSmart {
                Section("Match") {
                    Picker("Match", selection: $match) {
                        Text("All rules (AND)").tag("all")
                        Text("Any rule (OR)").tag("any")
                    }
                    .pickerStyle(.segmented)
                }

                Section("Rules") {
                    ForEach($rules) { $rule in
                        ruleRow(rule: $rule)
                    }
                    .onDelete { indices in
                        if rules.count > 1 {
                            rules.remove(atOffsets: indices)
                        }
                    }
                    Button("Add Rule") {
                        rules.append(EditableRule(field: "title", op: "contains", value: ""))
                    }
                }
            }

            if let error {
                Section {
                    Text(error).foregroundStyle(.red).font(.caption)
                }
            }
        }
        .navigationTitle(isCreating ? (isSmart ? "New Smart Playlist" : "New Manual Playlist") : "Edit \(name)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button(isCreating ? "Create" : "Save") { save() }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }

    private var isCreating: Bool {
        switch mode {
        case .createSmart, .createManual: true
        case .edit: false
        }
    }

    @ViewBuilder
    private func ruleRow(rule: Binding<EditableRule>) -> some View {
        let fieldType = fields.first { $0.value == rule.wrappedValue.field }?.type ?? "string"
        let ops = fieldType == "number" ? numberOps : stringOps

        VStack(spacing: 8) {
            HStack {
                Picker("Field", selection: rule.field) {
                    ForEach(fields, id: \.value) { f in
                        Text(f.label).tag(f.value)
                    }
                }
                .pickerStyle(.menu)
                .onChange(of: rule.wrappedValue.field) {
                    let newFieldType = fields.first { $0.value == rule.wrappedValue.field }?.type ?? "string"
                    if newFieldType == "number" {
                        rule.wrappedValue.op = "is"
                        rule.wrappedValue.value = "0"
                    } else {
                        rule.wrappedValue.op = "contains"
                        rule.wrappedValue.value = ""
                    }
                }

                Picker("Op", selection: rule.op) {
                    ForEach(ops, id: \.self) { op in
                        Text(opLabel(op)).tag(op)
                    }
                }
                .pickerStyle(.menu)
            }

            if fieldType == "number" {
                TextField("Value", text: rule.value)
                    .keyboardType(.numberPad)
            } else {
                TextField("Value", text: rule.value)
            }
        }
        .padding(.vertical, 4)
    }

    private func opLabel(_ op: String) -> String {
        switch op {
        case "is": "="
        case "contains": "contains"
        case "starts_with": "starts with"
        case "ends_with": "ends with"
        case ">": ">"
        case ">=": "≥"
        case "<": "<"
        case "<=": "≤"
        default: op
        }
    }

    private func save() {
        error = nil
        Task {
            do {
                switch mode {
                case .createSmart:
                    let cleanRules = rules.map { PlaylistRule(field: $0.field, op: $0.op, value: $0.value) }
                    let data = Playlist(id: 0, name: name.trimmingCharacters(in: .whitespaces), type: .smart, match: match, rules: cleanRules, songIds: nil)
                    try await playlistVM.createPlaylist(data)
                case .createManual:
                    let data = Playlist(id: 0, name: name.trimmingCharacters(in: .whitespaces), type: .manual, match: nil, rules: nil, songIds: [])
                    try await playlistVM.createPlaylist(data)
                case .edit(let playlist):
                    if playlist.type == .smart {
                        let cleanRules = rules.map { PlaylistRule(field: $0.field, op: $0.op, value: $0.value) }
                        let data = Playlist(id: playlist.id, name: name.trimmingCharacters(in: .whitespaces), type: .smart, match: match, rules: cleanRules, songIds: nil)
                        try await playlistVM.updatePlaylist(playlist.id, data)
                    } else {
                        let data = Playlist(id: playlist.id, name: name.trimmingCharacters(in: .whitespaces), type: .manual, match: nil, rules: nil, songIds: playlist.songIds ?? [])
                        try await playlistVM.updatePlaylist(playlist.id, data)
                    }
                }
                dismiss()
            } catch let err as APIClient.APIError {
                if case .serverError(let msg) = err { error = msg }
                else { error = "\(err)" }
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
