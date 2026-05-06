import {useState, useEffect, useMemo, useCallback} from 'react';
import {fetchServer, fetchSongs, fetchPlaylists, AuthError} from '../api.js';

function groupByKey(songs, key) {
  const map = {};
  songs.forEach((s) => { (map[s[key]] ??= []).push(s); });
  return Object.entries(map)
    .map(([name, songs]) => ({name, count: songs.length, songs}))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function useLibrary() {
  const [serverName, setServerName] = useState('');
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [sv, s, p] = await Promise.all([fetchServer(), fetchSongs(), fetchPlaylists()]);
      setServerName(sv.name);
      setSongs(s);
      setPlaylists(p);
      setError(null);
      setAuthError(null);
    } catch (err) {
      if (err instanceof AuthError) {
        setAuthError(err);
        setError(null);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadPlaylists = useCallback(async () => {
    try {
      const p = await fetchPlaylists();
      setPlaylists(p);
    } catch (err) {
      if (err instanceof AuthError) setAuthError(err);
      else setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const genres = useMemo(() => groupByKey(songs, 'genre'), [songs]);
  const artists = useMemo(() => groupByKey(songs, 'artist'), [songs]);

  const albums = useMemo(() => {
    const map = {};
    songs.forEach((s) => {
      const key = `${s.album}::${s.artist}`;
      if (!map[key]) map[key] = {name: s.album, artist: s.artist, songs: []};
      map[key].songs.push(s);
    });
    return Object.values(map)
      .map((a) => ({...a, coverId: a.songs[0]?.id, songs: a.songs.sort((x, y) => x.track - y.track)}))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [songs]);

  return {
    serverName,
    songs,
    playlists,
    genres,
    artists,
    albums,
    loading,
    error,
    authError,
    reload: load,
    reloadPlaylists,
  };
}
