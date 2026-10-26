import SwiftUI

enum AppAppearance: String, CaseIterable, Identifiable {
    case system, light, dark

    var id: String { rawValue }

    var label: String {
        switch self {
        case .system: "System"
        case .light: "Light"
        case .dark: "Dark"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

struct SettingsView: View {
    @Environment(AudioPlayer.self) private var player
    @Environment(LibraryViewModel.self) private var library
    @Environment(\.dismiss) private var dismiss

    @AppStorage("appearance") private var appearance = AppAppearance.system

    @State private var cacheSizeMB: Double = 1024
    @State private var currentCacheSize: Int64 = 0
    @State private var cacheFileCount: Int = 0
    @State private var confirmClear = false
    @State private var defaultPlaylistId: Int?

    var body: some View {
        NavigationStack {
            Form {
                Section("Appearance") {
                    Picker("Theme", selection: $appearance) {
                        ForEach(AppAppearance.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section("Widget") {
                    Picker("Default Playlist", selection: $defaultPlaylistId) {
                        Text("All Songs").tag(nil as Int?)
                        ForEach(library.playlists) { playlist in
                            Text(playlist.name).tag(Optional(playlist.id))
                        }
                    }
                    .onChange(of: defaultPlaylistId) {
                        let defaults = SharedConstants.sharedDefaults
                        if let id = defaultPlaylistId {
                            defaults?.set(id, forKey: SharedConstants.defaultPlaylistIdKey)
                        } else {
                            defaults?.removeObject(forKey: SharedConstants.defaultPlaylistIdKey)
                        }
                    }
                }

                Section("Cache") {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Limit")
                            Spacer()
                            Text(formatSize(Int64(cacheSizeMB) * 1024 * 1024))
                                .foregroundStyle(.secondary)
                        }
                        Slider(
                            value: $cacheSizeMB,
                            in: 100...4096,
                            step: 50
                        ) {
                            Text("Cache Limit")
                        } minimumValueLabel: {
                            Text("100M")
                                .font(.caption2)
                        } maximumValueLabel: {
                            Text("4G")
                                .font(.caption2)
                        }
                        .onChange(of: cacheSizeMB) {
                            player.cache.maxSize = Int64(cacheSizeMB) * 1024 * 1024
                        }
                    }

                    HStack {
                        Text("Used")
                        Spacer()
                        Text("\(formatSize(currentCacheSize)) (\(cacheFileCount) files)")
                            .foregroundStyle(.secondary)
                    }

                    Button("Clear Cache", role: .destructive) {
                        confirmClear = true
                    }
                    .disabled(cacheFileCount == 0)
                }

                Section("Server") {
                    Button("Sign Out", role: .destructive) {
                        NotificationCenter.default.post(name: .signOut, object: nil)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog("Clear all cached files?", isPresented: $confirmClear) {
                Button("Clear Cache", role: .destructive) {
                    player.cache.clearAll()
                    CoverImageCache.shared.clearAll()
                    library.clearSongCache()
                    Task { await refreshCacheInfo() }
                }
            }
            .task {
                defaultPlaylistId = SharedConstants.sharedDefaults?.object(forKey: SharedConstants.defaultPlaylistIdKey) as? Int
                cacheSizeMB = Double(player.cache.maxSize) / 1024 / 1024
                await refreshCacheInfo()
            }
        }
    }

    private func refreshCacheInfo() async {
        let cache = player.cache
        let info = await Task.detached { (size: cache.currentSize(), count: cache.fileCount()) }.value
        currentCacheSize = info.size
        cacheFileCount = info.count
    }

    private func formatSize(_ bytes: Int64) -> String {
        if bytes < 1024 * 1024 {
            return "\(bytes / 1024) KB"
        } else if bytes < 1024 * 1024 * 1024 {
            return "\(bytes / 1024 / 1024) MB"
        } else {
            let gb = Double(bytes) / 1024 / 1024 / 1024
            return String(format: "%.1f GB", gb)
        }
    }
}
