import {useState, useEffect} from 'react';
import {coverUrl} from '../api.js';
import SongTable from '../components/SongTable.jsx';

function AlbumCover({coverId, className}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`${className} flex items-center justify-center text-4xl text-gray-300 bg-gray-100`}>
        💿
      </div>
    );
  }

  return (
    <img
      src={coverUrl(coverId)}
      alt=""
      className={`${className} object-cover bg-gray-100`}
      onError={() => setFailed(true)}
    />
  );
}

export default function AlbumsView({albums, onPlay, currentSongId, onAddToPlaylist}) {
  const [selected, setSelected] = useState(null);

  const album = selected ? albums.find((a) => `${a.name}::${a.artist}` === selected) : null;

  useEffect(() => {
    if (selected && !album) setSelected(null);
  }, [selected, album]);

  if (selected && album) {
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-blue-600 hover:underline mb-2"
        >← Albums</button>
        <div className="flex items-end gap-4 mb-6">
          <AlbumCover coverId={album.coverId} className="w-32 h-32 rounded-lg" />
          <div>
            <h2 className="text-xl font-bold">{album.name}</h2>
            <p className="text-gray-500">{album.artist}</p>
          </div>
        </div>
        <SongTable
          songs={album.songs}
          onPlay={onPlay}
          currentSongId={currentSongId}
          onAddToPlaylist={onAddToPlaylist}
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Albums</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {albums.map((album) => (
          <button
            key={`${album.name}::${album.artist}`}
            onClick={() => setSelected(`${album.name}::${album.artist}`)}
            className="text-left group"
          >
            <div className="aspect-square rounded-lg overflow-hidden mb-2">
              <AlbumCover
                coverId={album.coverId}
                className="w-full h-full group-hover:scale-105 transition-transform"
              />
            </div>
            <div className="text-sm font-medium truncate">{album.name}</div>
            <div className="text-xs text-gray-400 truncate">{album.artist}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
