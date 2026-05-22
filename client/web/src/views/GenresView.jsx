import {useState, useRef, useLayoutEffect} from 'react';
import SongTable from '../components/SongTable.jsx';
import {findScrollParent} from '../utils.js';

export default function GenresView({genres, onPlay, currentSongId, onAddToPlaylist}) {
  const [selected, setSelected] = useState(null);
  const rootRef = useRef(null);
  const savedScroll = useRef(0);

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
          className="text-sm text-blue-600 hover:underline mb-2"
        >← Genres</button>
        <h2 className="text-xl font-bold mb-4">{selected}</h2>
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
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex justify-between"
            >
              <span>{g.name}</span>
              <span className="text-gray-400 text-sm">{g.count} songs</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
