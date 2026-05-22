import {useState} from 'react';
import useLibrary from './hooks/useLibrary.js';
import usePlayer from './hooks/usePlayer.js';
import Sidebar from './components/Sidebar.jsx';
import Login from './components/Login.jsx';
import Player from './components/Player.jsx';
import MobileTabBar from './components/MobileTabBar.jsx';
import MiniPlayer from './components/MiniPlayer.jsx';
import FullScreenPlayer from './components/FullScreenPlayer.jsx';
import AddToPlaylistMenu from './components/AddToPlaylistMenu.jsx';
import SongsView from './views/SongsView.jsx';
import GenresView from './views/GenresView.jsx';
import ArtistsView from './views/ArtistsView.jsx';
import AlbumsView from './views/AlbumsView.jsx';
import PlaylistView from './views/PlaylistView.jsx';

export default function App() {
  const library = useLibrary();
  const player = usePlayer();
  const [view, setView] = useState('songs');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [addingSong, setAddingSong] = useState(null);

  const [songsSearch, setSongsSearch] = useState('');
  const [songsSortKey, setSongsSortKey] = useState(null);
  const [songsSortDir, setSongsSortDir] = useState('asc');

  function handleNavigate(v) {
    if (v === 'playlist') {
      setView('playlist');
      if (!selectedPlaylistId) {
        setSelectedPlaylistId(library.playlists[0]?.id || null);
      }
    } else {
      setView(v);
    }
  }

  function handleSelectPlaylist(id) {
    setSelectedPlaylistId(id);
    setView('playlist');
  }

  if (library.loading) {
    return <div className="h-dvh flex items-center justify-center text-gray-500">Loading...</div>;
  }
  if (library.authError) {
    return <Login invalid={library.authError.invalid} onLogin={library.reload} />;
  }
  if (library.error) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-4">
        <div className="text-red-500">{library.error || 'Cannot connect to server'}</div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-800 text-white rounded text-sm hover:bg-gray-700"
        >Retry</button>
      </div>
    );
  }

  if (library.songs.length === 0) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-4 text-gray-500">
        <div>No songs</div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-800 text-white rounded text-sm hover:bg-gray-700"
        >Refresh</button>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col bg-white text-gray-800">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          serverName={library.serverName}
          view={view}
          onNavigate={handleNavigate}
          playlists={library.playlists}
          onSelectPlaylist={handleSelectPlaylist}
          selectedPlaylistId={selectedPlaylistId}
        />
        <main className="flex-1 overflow-hidden min-w-0 relative">
          <div
            className={`absolute inset-0 overflow-y-auto overflow-x-hidden p-4${view === 'songs' ? '' : ' invisible pointer-events-none'}`}
          >
            <SongsView
              songs={library.songs}
              onPlay={player.playSong}
              currentSongId={player.currentSong?.id}
              onAddToPlaylist={setAddingSong}
              search={songsSearch}
              onSearchChange={setSongsSearch}
              sortKey={songsSortKey}
              sortDir={songsSortDir}
              onSortChange={(key, dir) => {
                setSongsSortKey(key);
                setSongsSortDir(dir);
              }}
            />
          </div>
          <div
            className={`absolute inset-0 overflow-y-auto overflow-x-hidden p-4${view === 'genres' ? '' : ' invisible pointer-events-none'}`}
          >
            <GenresView
              genres={library.genres}
              onPlay={player.playSong}
              currentSongId={player.currentSong?.id}
              onAddToPlaylist={setAddingSong}
            />
          </div>
          <div
            className={`absolute inset-0 overflow-y-auto overflow-x-hidden p-4${view === 'artists' ? '' : ' invisible pointer-events-none'}`}
          >
            <ArtistsView
              artists={library.artists}
              albums={library.albums}
              onPlay={player.playSong}
              currentSongId={player.currentSong?.id}
              onAddToPlaylist={setAddingSong}
            />
          </div>
          <div
            className={`absolute inset-0 overflow-y-auto overflow-x-hidden p-4${view === 'albums' ? '' : ' invisible pointer-events-none'}`}
          >
            <AlbumsView
              albums={library.albums}
              onPlay={player.playSong}
              currentSongId={player.currentSong?.id}
              onAddToPlaylist={setAddingSong}
            />
          </div>
          {view === 'playlist' && (
            <div className="absolute inset-0 overflow-y-auto overflow-x-hidden p-4">
              <PlaylistView
                playlistId={selectedPlaylistId}
                playlists={library.playlists}
                onPlay={player.playSong}
                currentSongId={player.currentSong?.id}
                onReload={library.reloadPlaylists}
                onSelectPlaylist={handleSelectPlaylist}
                onAddToPlaylist={setAddingSong}
              />
            </div>
          )}
        </main>
      </div>
      <Player player={player} onAddToPlaylist={setAddingSong} />
      <MiniPlayer player={player} onExpand={() => setShowFullPlayer(true)} />
      <MobileTabBar view={view} onNavigate={handleNavigate} />
      {showFullPlayer && (
        <FullScreenPlayer
          player={player}
          onClose={() => setShowFullPlayer(false)}
          onAddToPlaylist={setAddingSong}
        />
      )}
      {addingSong && (
        <AddToPlaylistMenu
          song={addingSong}
          playlists={library.playlists}
          onClose={() => setAddingSong(null)}
          onChange={library.reloadPlaylists}
        />
      )}
    </div>
  );
}
