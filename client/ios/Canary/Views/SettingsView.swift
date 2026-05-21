import SwiftUI

struct SettingsView: View {
    @Environment(AudioPlayer.self) private var player
    @Environment(LibraryViewModel.self) private var library
    @Environment(\.dismiss) private var dismiss

    @State private var cacheSizeMB: Double = 1024
    @State private var currentCacheSize: Int64 = 0
    @State private var cacheFileCount: Int = 0
    @State private var confirmClear = false

    var body: some View {
        NavigationStack {
            Form {
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
                            step: 1
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
                    refreshCacheInfo()
                }
            }
            .onAppear {
                cacheSizeMB = Double(player.cache.maxSize) / 1024 / 1024
                refreshCacheInfo()
            }
        }
    }

    private func refreshCacheInfo() {
        currentCacheSize = player.cache.currentSize()
        cacheFileCount = player.cache.fileCount()
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
