import {useState, useEffect} from 'react';
import SongTable from '../components/SongTable.jsx';
import {
  fetchPlaylistSongs,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  removeSongFromPlaylist,
} from '../api.js';

const stringOps = [
  {value: 'is', label: 'is'},
  {value: 'contains', label: 'contains'},
  {value: 'starts_with', label: 'starts with'},
  {value: 'ends_with', label: 'ends with'},
];
const numberOps = [
  {value: 'is', label: '='},
  {value: '>', label: '>'},
  {value: '>=', label: '≥'},
  {value: '<', label: '<'},
  {value: '<=', label: '≤'},
];
const fields = [
  {value: 'title', label: 'Title', type: 'string'},
  {value: 'artist', label: 'Artist', type: 'string'},
  {value: 'album', label: 'Album', type: 'string'},
  {value: 'genre', label: 'Genre', type: 'string'},
  {value: 'year', label: 'Year', type: 'number'},
];

let ruleId = 0;
function emptyRule() {
  return {_key: ++ruleId, field: 'title', op: 'contains', value: ''};
}

function RuleEditor({rules, onChange}) {
  function updateRule(i, key, val) {
    const next = rules.map((r, j) => {
      if (j !== i) return r;
      const updated = {...r, [key]: val};
      if (key === 'field') {
        const f = fields.find((f) => f.value === val);
        if (f.type === 'number') {
          updated.op = 'is';
          updated.value = 0;
        } else {
          updated.op = 'contains';
          updated.value = '';
        }
      }
      return updated;
    });
    onChange(next);
  }

  function addRule() {
    onChange([...rules, emptyRule()]);
  }

  function removeRule(i) {
    if (rules.length <= 1) return;
    onChange(rules.filter((_, j) => j !== i));
  }

  return (
    <div className="space-y-2">
      {rules.map((rule, i) => {
        const f = fields.find((f) => f.value === rule.field);
        const ops = f?.type === 'number' ? numberOps : stringOps;
        return (
          <div key={rule._key || i} className="flex items-center gap-2 flex-wrap">
            <select
              value={rule.field}
              onChange={(e) => updateRule(i, 'field', e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              {fields.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <select
              value={rule.op}
              onChange={(e) => updateRule(i, 'op', e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {f?.type === 'number' ? (
              <input
                type="number"
                value={rule.value}
                onChange={(e) => updateRule(i, 'value', +e.target.value)}
                className="border rounded px-2 py-1 text-sm w-24"
              />
            ) : (
              <input
                type="text"
                value={rule.value}
                onChange={(e) => updateRule(i, 'value', e.target.value)}
                className="border rounded px-2 py-1 text-sm flex-1 min-w-32"
                placeholder="Value"
              />
            )}
            <button
              onClick={() => removeRule(i)}
              className="text-gray-400 hover:text-red-500 text-sm"
              title="Delete"
            >✕</button>
          </div>
        );
      })}
      <button onClick={addRule} className="text-sm text-blue-600 hover:underline">+ Add rule</button>
    </div>
  );
}

function SmartPlaylistEditor({playlist, onSave, onCancel}) {
  const isNew = !playlist;
  const [name, setName] = useState(playlist?.name || '');
  const [match, setMatch] = useState(playlist?.match || 'all');
  const [rules, setRules] = useState(playlist?.rules || [emptyRule()]);
  const [error, setError] = useState(null);

  async function handleSave() {
    try {
      setError(null);
      const cleanRules = rules.map(({field, op, value}) => ({field, op, value}));
      const data = {
        name,
        type: 'smart',
        match,
        rules: cleanRules
      };
      if (isNew) await createPlaylist(data);
      else await updatePlaylist(playlist.id, data);
      onSave();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm w-full max-w-xs"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Match</label>
        <select
          value={match}
          onChange={(e) => setMatch(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="all">All rules (AND)</option>
          <option value="any">Any rule (OR)</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Rules</label>
        <RuleEditor rules={rules} onChange={setRules} />
      </div>
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >{isNew ? 'Create' : 'Save'}</button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 border rounded text-sm hover:bg-gray-100"
        >Cancel</button>
      </div>
    </div>
  );
}

function ManualPlaylistEditor({playlist, onSave, onCancel}) {
  const isNew = !playlist;
  const [name, setName] = useState(playlist?.name || '');
  const [error, setError] = useState(null);

  async function handleSave() {
    try {
      setError(null);
      if (isNew) {
        await createPlaylist({name, type: 'manual', songIds: []});
      } else {
        await updatePlaylist(playlist.id, {
          name,
          type: 'manual',
          songIds: playlist.songIds ?? [],
        });
      }
      onSave();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="border rounded px-3 py-1.5 text-sm w-full max-w-xs"
        />
      </div>
      {isNew && (
        <p className="text-xs text-gray-500">
          Add songs from the Songs, Albums, Artists, or Genres views using the + button on each row.
        </p>
      )}
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >{isNew ? 'Create' : 'Save'}</button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 border rounded text-sm hover:bg-gray-100"
        >Cancel</button>
      </div>
    </div>
  );
}

export default function PlaylistView({
  playlistId,
  playlists,
  onPlay,
  currentSongId,
  onReload,
  onSelectPlaylist,
  onAddToPlaylist,
}) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(null);

  const playlist = playlists.find((p) => p.id === playlistId);
  const isBuiltIn = playlist?.type === 'builtin';
  const isManual = playlist?.type === 'manual';

  useEffect(() => {
    setEditing(false);
    setCreating(null);
    if (!playlistId) return;
    setLoading(true);
    fetchPlaylistSongs(playlistId)
      .then(setSongs)
      .catch(() => setSongs([]))
      .finally(() => setLoading(false));
  }, [playlistId]);

  async function handleDelete() {
    if (!confirm(`Delete playlist "${playlist?.name}"?`)) return;
    try {
      await deletePlaylist(playlistId);
      await onReload();
      onSelectPlaylist(null);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSaved() {
    setEditing(false);
    setCreating(null);
    await onReload();
    if (playlistId) {
      const s = await fetchPlaylistSongs(playlistId);
      setSongs(s);
    }
  }

  async function handleRemoveSong(songId) {
    try {
      await removeSongFromPlaylist(playlistId, songId);
      const s = await fetchPlaylistSongs(playlistId);
      setSongs(s);
      await onReload();
    } catch (err) {
      alert(err.message);
    }
  }

  if (creating === 'smart') {
    return (
      <div>
        <h2 className="text-xl font-bold mb-4">New Smart Playlist</h2>
        <SmartPlaylistEditor onSave={handleSaved} onCancel={() => setCreating(null)} />
      </div>
    );
  }
  if (creating === 'manual') {
    return (
      <div>
        <h2 className="text-xl font-bold mb-4">New Manual Playlist</h2>
        <ManualPlaylistEditor onSave={handleSaved} onCancel={() => setCreating(null)} />
      </div>
    );
  }

  if (editing && playlist) {
    const Editor = playlist.type === 'manual' ? ManualPlaylistEditor : SmartPlaylistEditor;
    return (
      <div>
        <h2 className="text-xl font-bold mb-4">Edit {playlist.name}</h2>
        <Editor playlist={playlist} onSave={handleSaved} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        {playlists.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelectPlaylist(p.id)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
              playlistId === p.id
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={() => setCreating('smart')}
          className="px-3 py-1.5 rounded-full text-sm whitespace-nowrap bg-blue-50 text-blue-600 hover:bg-blue-100"
        >+ New Smart</button>
        <button
          onClick={() => setCreating('manual')}
          className="px-3 py-1.5 rounded-full text-sm whitespace-nowrap bg-blue-50 text-blue-600 hover:bg-blue-100"
        >+ New Manual</button>
      </div>

      {playlist ? (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-bold">{playlist.name}</h2>
            {playlist.type && (
              <span className="text-xs uppercase tracking-wider text-gray-400">{playlist.type}</span>
            )}
            {!isBuiltIn && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-blue-600 hover:underline"
                >Edit</button>
                <button
                  onClick={handleDelete}
                  className="text-sm text-red-500 hover:underline"
                >Delete</button>
              </>
            )}
          </div>
          {loading ? (
            <div className="text-gray-400 text-sm">Loading...</div>
          ) : (
            <SongTable
              songs={songs}
              onPlay={onPlay}
              currentSongId={currentSongId}
              onAddToPlaylist={onAddToPlaylist}
              onRemove={isManual ? handleRemoveSong : undefined}
            />
          )}
          {isManual && songs.length === 0 && !loading && (
            <div className="text-gray-400 text-sm mt-4">
              No songs yet. Add some from the Songs, Albums, Artists, or Genres views.
            </div>
          )}
        </div>
      ) : (
        <div className="text-gray-400 text-sm">Select a playlist</div>
      )}
    </div>
  );
}
