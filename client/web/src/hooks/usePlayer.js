import {useState, useRef, useEffect, useLayoutEffect, useCallback} from 'react';
import {streamUrl} from '../api.js';

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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
  const originalQueueRef = useRef([]);

  // refs to avoid stale closures in audio event handlers
  const queueRef = useRef(queue);
  const currentIndexRef = useRef(currentIndex);
  const repeatRef = useRef(repeat);
  const volumeRef = useRef(volume);

  useLayoutEffect(() => {
    queueRef.current = queue;
    currentIndexRef.current = currentIndex;
    repeatRef.current = repeat;
    volumeRef.current = volume;
  });

  function loadAndPlay(song) {
    const audio = audioRef.current;
    if (!audio || !song) return;
    audio.pause();
    audio.src = streamUrl(song.id);
    audio.volume = volumeRef.current;
    audio.play().then(() => setPlaying(true)).catch(() => {});
  }

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => handleEnded();
    const onError = () => handleError();

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.src = '';
    };
  }, []);

  function pickNext(q, idx, rep) {
    if (idx < q.length - 1) return idx + 1;
    if (rep === 'all') return 0;
    return -1;
  }

  const errorCountRef = useRef(0);

  function handleError() {
    const audio = audioRef.current;
    if (audio?.error?.code === MediaError.MEDIA_ERR_ABORTED) return;
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

    if (rep === 'one') {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      return;
    }
    const next = pickNext(q, idx, rep);
    if (next >= 0) {
      setCurrentIndex(next);
      loadAndPlay(q[next]);
    } else {
      setPlaying(false);
    }
  }

  const currentSong = queue[currentIndex] || null;

  const playSong = useCallback((songs, index) => {
    originalQueueRef.current = [...songs];
    if (shuffle) {
      const selected = songs[index];
      const rest = songs.filter((_, i) => i !== index);
      const shuffled = [selected, ...shuffleArray(rest)];
      setQueue(shuffled);
      setCurrentIndex(0);
      loadAndPlay(selected);
    } else {
      setQueue([...songs]);
      setCurrentIndex(index);
      loadAndPlay(songs[index]);
    }
  }, [shuffle]);

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
    const i = pickNext(q, idx, rep);
    if (i >= 0) {
      setCurrentIndex(i);
      loadAndPlay(q[i]);
    }
  }, []);

  const seek = useCallback((time) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((v) => {
    setVolumeState(v);
    const audio = audioRef.current;
    if (audio) audio.volume = v;
  }, []);

  const toggleShuffle = useCallback(() => {
    const q = queueRef.current;
    const idx = currentIndexRef.current;
    const current = q[idx];

    if (!shuffle) {
      originalQueueRef.current = [...q];
      const rest = q.filter((_, i) => i !== idx);
      const shuffled = [current, ...shuffleArray(rest)];
      setQueue(shuffled);
      setCurrentIndex(0);
    } else {
      const orig = originalQueueRef.current;
      const origIdx = current ? orig.findIndex((s) => s.id === current.id) : 0;
      setQueue([...orig]);
      setCurrentIndex(origIdx >= 0 ? origIdx : 0);
    }
    setShuffle((s) => !s);
  }, [shuffle]);

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
