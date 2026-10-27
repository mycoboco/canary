import {navItems} from '../navItems.js';

export default function Sidebar(
  {
    serverName,
    view,
    onNavigate,
    playlists,
    onSelectPlaylist,
    selectedPlaylistId,
  }
) {
  return (
    <aside className="hidden md:flex flex-col w-56 bg-gray-50 dark:bg-neutral-800 border-r border-gray-200 dark:border-neutral-700 h-full">
      <div
        className="p-4 font-bold text-lg text-gray-800 dark:text-gray-100 truncate"
        title={serverName}
      >
        {serverName || 'canary'}
      </div>
      <nav className="flex-1 overflow-y-auto">
        <ul className="px-2">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onNavigate(item.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                  view === item.id
                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 px-4">
          <div className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
            Playlists
          </div>
        </div>
        <ul className="px-2">
          {playlists.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => onSelectPlaylist(p.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${
                  view === 'playlist' && selectedPlaylistId === p.id
                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                }`}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
