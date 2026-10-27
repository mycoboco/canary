import {useState, useRef, useEffect, useLayoutEffect} from 'react';
import SongTable from '../components/SongTable.jsx';
import GenreIcon from '../components/GenreIcon.jsx';
import {findScrollParent} from '../utils.js';

export default function GenresView({genres, onPlay, currentSongId, onAddToPlaylist, resetKey}) {
  const [selected, setSelected] = useState(null);
  const rootRef = useRef(null);
  const savedScroll = useRef(0);
  const initialResetKey = useRef(resetKey);

  useEffect(() => {
    if (resetKey !== initialResetKey.current) {
      setSelected(null);
      savedScroll.current = 0;
    }
  }, [resetKey]);

  function getScrollParent() {
    return rootRef.current ? findScrollParent(rootRef.current) : null;
  }

  function handleSelect(name) {
    const sp = getScrollParent();
    if (sp) savedScroll.current = sp.scrollTop;
    setSelected(name);
  }

  useLayoutEffect(() => {
    const sp = getScrollParent();
    if (!sp) return;
    if (selected) {
      sp.scrollTop = 0;
    } else if (savedScroll.current > 0) {
      sp.scrollTop = savedScroll.current;
    }
  }, [selected]);

  if (selected) {
    const genre = genres.find((g) => g.name === selected);
    return (
      <div ref={rootRef}>
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2"
        >← Genres</button>
        <div className="flex items-center gap-3 mb-4">
          <GenreIcon genre={selected} size={40} className="text-gray-700 dark:text-gray-200" />
          <h2 className="text-xl font-bold">{selected}</h2>
        </div>
        <SongTable
          songs={genre?.songs || []}
          onPlay={onPlay}
          currentSongId={currentSongId}
          onAddToPlaylist={onAddToPlaylist}
        />
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <h2 className="text-xl font-bold mb-4">Genres</h2>
      <ul className="space-y-1">
        {genres.map((g) => (
          <li key={g.name}>
            <button
              onClick={() => handleSelect(g.name)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center gap-3"
            >
              <GenreIcon genre={g.name} size={32} className="text-gray-600 dark:text-gray-300" />
              <span className="flex-1">{g.name}</span>
              <span className="text-gray-400 dark:text-neutral-500 text-sm">{g.count} songs</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
