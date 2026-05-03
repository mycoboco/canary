import SongTable from '../components/SongTable.jsx';

export default function SongsView({songs, onPlay, currentSongId}) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Songs</h2>
      <SongTable songs={songs} onPlay={onPlay} currentSongId={currentSongId} />
    </div>
  );
}
