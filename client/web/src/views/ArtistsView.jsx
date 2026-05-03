import {useState} from 'react';
import SongTable from '../components/SongTable.jsx';

export default function ArtistsView({artists, albums, onPlay, currentSongId}) {
  const [selected, setSelected] = useState(null);

  if (selected) {
    const artistAlbums = albums.filter((a) => a.artist === selected);
    const artist = artists.find((a) => a.name === selected);
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-blue-600 hover:underline mb-2"
        >← Artists</button>
        <h2 className="text-xl font-bold mb-4">{selected}</h2>
        {artistAlbums.map((album) => (
          <div key={album.name} className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">{album.name}</h3>
            <SongTable songs={album.songs} onPlay={onPlay} currentSongId={currentSongId} />
          </div>
        ))}
        {artistAlbums.length === 0 && artist && (
          <SongTable songs={artist.songs} onPlay={onPlay} currentSongId={currentSongId} />
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Artists</h2>
      <ul className="space-y-1">
        {artists.map((a) => (
          <li key={a.name}>
            <button
              onClick={() => setSelected(a.name)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex justify-between"
            >
              <span>{a.name}</span>
              <span className="text-gray-400 text-sm">{a.count} songs</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
