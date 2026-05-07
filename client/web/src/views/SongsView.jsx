import {useMemo, useRef, useState, useEffect} from 'react';
import SearchBar from '../components/SearchBar.jsx';
import SongTable from '../components/SongTable.jsx';

export default function SongsView({
  songs, onPlay, currentSongId, onAddToPlaylist,
  search, onSearchChange, sortKey, sortDir, onSortChange
}) {
  const searchRef = useRef(null);
  const [stickyOffset, setStickyOffset] = useState(0);

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

  useEffect(() => {
    if (searchRef.current) setStickyOffset(searchRef.current.offsetHeight);
  }, []);

  const onSort = (key) => {
    if (key === sortKey) {
      onSortChange(key, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(key, 'asc');
    }
  };

  return (
    <div>
      <div ref={searchRef} className="sticky top-0 z-10 bg-white">
        <SearchBar value={search} onChange={onSearchChange} />
      </div>
      <h2 className="text-xl font-bold mb-4">Songs</h2>
      <SongTable
        virtualized
        stickyOffset={stickyOffset}
        songs={sorted}
        onPlay={onPlay}
        currentSongId={currentSongId}
        onAddToPlaylist={onAddToPlaylist}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
      />
    </div>
  );
}
