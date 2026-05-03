import {useState} from 'react';
import SongTable from '../components/SongTable.jsx';

export default function GenresView({genres, onPlay, currentSongId}) {
  const [selected, setSelected] = useState(null);

  if (selected) {
    const genre = genres.find((g) => g.name === selected);
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-blue-600 hover:underline mb-2"
        >← Genres</button>
        <h2 className="text-xl font-bold mb-4">{selected}</h2>
        <SongTable songs={genre?.songs || []} onPlay={onPlay} currentSongId={currentSongId} />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Genres</h2>
      <ul className="space-y-1">
        {genres.map((g) => (
          <li key={g.name}>
            <button
              onClick={() => setSelected(g.name)}
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
