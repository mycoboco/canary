import {useState, useMemo} from 'react';
import SongTable from '../components/SongTable.jsx';

export default function SongsView({songs, onPlay, currentSongId, onAddToPlaylist}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const sorted = useMemo(() => {
    if (!sortKey) return songs;
    const sign = sortDir === 'desc' ? -1 : 1;
    return [...songs].sort((a, b) =>
      sign * (a[sortKey] || '').localeCompare(b[sortKey] || '', undefined, {sensitivity: 'base'}),
    );
  }, [songs, sortKey, sortDir]);

  const onSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Songs</h2>
      <SongTable
        songs={sorted}
        onPlay={onPlay}
        currentSongId={currentSongId}
        onAddToPlaylist={onAddToPlaylist}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        stickyHeader
      />
    </div>
  );
}
