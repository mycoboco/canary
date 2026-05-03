import {useState, useRef, useEffect, useCallback} from 'react';
import {streamUrl} from '../api.js';

export default function usePlayer() {
  const audioRef = useRef(null);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('none'); // 'none', 'all', 'one'

  // refs to avoid stale closures in audio event handlers
  const queueRef = useRef(queue);
  const currentIndexRef = useRef(currentIndex);
  const repeatRef = useRef(repeat);
  const volumeRef = useRef(volume);
  const shuffleRef = useRef(shuffle);

  queueRef.current = queue;
  currentIndexRef.current = currentIndex;
  repeatRef.current = repeat;
  volumeRef.current = volume;
  shuffleRef.current = shuffle;

  function loadAndPlay(song) {
    const audio = audioRef.current;
    if (!audio || !song) return;
    audio.src = streamUrl(song.id);
    audio.volume = volumeRef.current;
    audio.play().then(() => setPlaying(true)).catch(() => {});
  }

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('durationchange', () => setDuration(audio.duration || 0));
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  function pickNext(q, idx, rep, shuf) {
    if (rep === 'one') return idx;
    if (shuf) {
      if (q.length <= 1) return rep === 'all' ? 0 : -1;
      const candidates = q.map((_, i) => i).filter((i) => i !== idx);
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    if (idx < q.length - 1) return idx + 1;
    if (rep === 'all') return 0;
    return -1;
  }

  const errorCountRef = useRef(0);

  function handleError() {
    errorCountRef.current++;
    if (errorCountRef.current > 3) {
      setPlaying(false);
      errorCountRef.current = 0;
      return;
    }
    handleEnded();
  }

  function handleEnded() {
    errorCountRef.current = 0;
    const q = queueRef.current;
    const idx = currentIndexRef.current;
    const rep = repeatRef.current;
    const shuf = shuffleRef.current;

    if (rep === 'one') {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      return;
    }
    const next = pickNext(q, idx, rep, shuf);
    if (next >= 0) {
      setCurrentIndex(next);
      loadAndPlay(q[next]);
    } else {
      setPlaying(false);
    }
  }

  const currentSong = queue[currentIndex] || null;

  function playSong(songs, index) {
    setQueue([...songs]);
    setCurrentIndex(index);
    loadAndPlay(songs[index]);
  }

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [playing]);

  const prev = useCallback(() => {
    const q = queueRef.current;
    const idx = currentIndexRef.current;
    if (idx > 0) {
      const i = idx - 1;
      setCurrentIndex(i);
      loadAndPlay(q[i]);
    }
  }, []);

  const next = useCallback(() => {
    const q = queueRef.current;
    const idx = currentIndexRef.current;
    const rep = repeatRef.current;
    const shuf = shuffleRef.current;
    const i = pickNext(q, idx, rep, shuf);
    if (i >= 0) {
      setCurrentIndex(i);
      loadAndPlay(q[i]);
    }
  }, []);

  const seek = useCallback((time) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = time;
  }, []);

  const setVolume = useCallback((v) => {
    setVolumeState(v);
    const audio = audioRef.current;
    if (audio) audio.volume = v;
  }, []);

  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);

  const toggleRepeat = useCallback(() => {
    setRepeat((r) => {
      if (r === 'none') return 'all';
      if (r === 'all') return 'one';
      return 'none';
    });
  }, []);

  return {
    currentSong,
    playing,
    currentTime,
    duration,
    volume,
    shuffle,
    repeat,
    queue,
    currentIndex,
    playSong,
    togglePlay,
    prev,
    next,
    seek,
    setVolume,
    toggleShuffle,
    toggleRepeat,
  };
}
