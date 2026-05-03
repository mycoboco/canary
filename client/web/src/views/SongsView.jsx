import SongTable from '../components/SongTable.jsx';

export default function SongsView({songs, onPlay, currentSongId, onAddToPlaylist}) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Songs</h2>
      <SongTable
        songs={songs}
        onPlay={onPlay}
        currentSongId={currentSongId}
        onAddToPlaylist={onAddToPlaylist}
      />
    </div>
  );
}
