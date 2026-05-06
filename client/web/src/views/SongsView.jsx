import {useMemo} from 'react';
import SearchBar from '../components/SearchBar.jsx';
import SongTable from '../components/SongTable.jsx';

export default function SongsView({
  songs, onPlay, currentSongId, onAddToPlaylist,
  search, onSearchChange, sortKey, sortDir, onSortChange
}) {
  const filtered = useMemo(() => {
    if (!search) return songs;
    const q = search.toLowerCase();
    return songs.filter((s) =>
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      s.album.toLowerCase().includes(q));
  }, [search, songs]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const sign = sortDir === 'desc' ? -1 : 1;
    return [...filtered].sort((a, b) =>
      sign * (a[sortKey] || '').localeCompare(b[sortKey] || '', undefined, {sensitivity: 'base'}),
    );
  }, [filtered, sortKey, sortDir]);

  const onSort = (key) => {
    if (key === sortKey) {
      onSortChange(key, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(key, 'asc');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <SearchBar value={search} onChange={onSearchChange} />
      <h2 className="text-xl font-bold mb-4">Songs</h2>
      <div className="flex-1 min-h-0">
        <SongTable
          virtualized
          songs={sorted}
          onPlay={onPlay}
          currentSongId={currentSongId}
          onAddToPlaylist={onAddToPlaylist}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
        />
      </div>
    </div>
  );
}
