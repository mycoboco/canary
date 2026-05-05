import {useState} from 'react';
import {addSongToPlaylist, createPlaylist} from '../api.js';

export default function AddToPlaylistMenu({song, playlists, onClose, onChange}) {
  const manualLists = playlists.filter((p) => p.type === 'manual');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function addExisting(playlistId) {
    if (busy) return;
    try {
      setBusy(true);
      setError(null);
      await addSongToPlaylist(playlistId, song.id);
      await onChange?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function createAndAdd() {
    if (busy || !name.trim()) return;
    try {
      setBusy(true);
      setError(null);
      const pls = await createPlaylist({name, type: 'manual', songIds: [song.id]});
      await onChange?.();
      onClose(pls);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b">
          <div className="text-sm font-semibold truncate">Add to playlist</div>
          <div className="text-xs text-gray-500 truncate">{song.title}</div>
        </div>

        <ul className="max-h-72 overflow-y-auto px-2 py-1">
          {manualLists.length === 0 && !creating && (
            <li className="px-4 py-3 text-sm text-gray-400">No manual playlists yet.</li>
          )}
          {manualLists.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => addExisting(p.id)}
                disabled={busy}
                className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-100 disabled:opacity-50 truncate"
              >{p.name}</button>
            </li>
          ))}
        </ul>

        <div className="border-t">
          {creating ? (
            <div className="p-3 space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createAndAdd()}
                placeholder="New playlist name"
                autoFocus
                className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <div className="flex gap-2">
                <button
                  onClick={createAndAdd}
                  disabled={busy || !name.trim()}
                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >Create &amp; add</button>
                <button
                  onClick={() => { setCreating(false); setName(''); }}
                  className="px-3 py-1.5 border rounded text-sm hover:bg-gray-100"
                >Cancel</button>
              </div>
            </div>
          ) : (
            <div className="p-2">
              <button
                onClick={() => setCreating(true)}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 rounded-lg hover:bg-gray-100"
              >+ New manual playlist</button>
            </div>
          )}
        </div>

        {error && <div className="px-4 py-2 text-xs text-red-500">{error}</div>}
      </div>
    </div>
  );
}
