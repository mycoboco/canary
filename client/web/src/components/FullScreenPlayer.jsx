import {useRef} from 'react';
import {coverUrl} from '../api.js';
import {formatSec} from '../utils.js';
import {Icon, icons} from './Icons.jsx';
import useSeekBar from '../hooks/useSeekBar.js';
import useModalAccess from '../hooks/useModalAccess.js';

export default function FullScreenPlayer({player, onClose, onAddToPlaylist}) {
  const rootRef = useRef(null);
  useModalAccess(rootRef, onClose);
  const {
    currentSong,
    playing,
    currentTime,
    duration,
    shuffle,
    repeat,
    togglePlay,
    prev,
    next,
    seek,
    toggleShuffle,
    toggleRepeat,
  } = player;
  const {displayTime, inputProps: seekInputProps} = useSeekBar({currentTime, onSeek: seek});

  if (!currentSong) return null;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-8"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        title="Close"
        className="absolute top-4 left-4 text-gray-400 p-2 rounded-full hover:bg-gray-100"
      >
        <Icon d={icons.chevronDown} size={28} />
      </button>

      {onAddToPlaylist && (
        <button
          onClick={() => onAddToPlaylist(currentSong)}
          className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full text-3xl leading-none text-gray-400 hover:text-blue-600 hover:bg-blue-50"
          title="Add to playlist"
          aria-label="Add to playlist"
        >+</button>
      )}

      <img
        key={currentSong.id}
        src={coverUrl(currentSong.id)}
        alt=""
        className="w-64 h-64 rounded-xl object-cover bg-gray-100 shadow-lg mb-8"
        onError={(e) => { e.target.style.visibility = 'hidden'; }}
      />

      <div className="text-center mb-6 w-full max-w-xs">
        <div className="text-lg font-bold truncate">{currentSong.title}</div>
        <div className="text-gray-500 truncate">{currentSong.artist}</div>
      </div>

      <div className="w-full max-w-xs mb-6">
        <input
          type="range"
          min={0}
          max={duration || 0}
          {...seekInputProps}
          aria-label="Seek"
          className="w-full h-1 accent-gray-800 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{formatSec(displayTime)}</span>
          <span>{formatSec(duration)}</span>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <button
          onClick={toggleShuffle}
          aria-label={shuffle ? 'Shuffle on' : 'Shuffle off'}
          aria-pressed={shuffle}
          title="Shuffle"
          className={`p-2 rounded-full transition-colors ${
            shuffle ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Icon d={icons.shuffle} size={22} />
        </button>
        <button
          onClick={prev}
          aria-label="Previous"
          title="Previous"
          className="p-2 rounded-full text-gray-600 hover:text-gray-800 transition-colors"
        >
          <Icon d={icons.prev} size={28} />
        </button>
        <button
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className="w-14 h-14 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-gray-700 hover:scale-105 transition-all"
        >
          <Icon d={playing ? icons.pause : icons.play} size={28} />
        </button>
        <button
          onClick={next}
          aria-label="Next"
          title="Next"
          className="p-2 rounded-full text-gray-600 hover:text-gray-800 transition-colors"
        >
          <Icon d={icons.next} size={28} />
        </button>
        <button
          onClick={toggleRepeat}
          aria-label={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'No repeat'}
          title={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'No repeat'}
          className={`p-2 rounded-full transition-colors ${
            repeat !== 'none' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Icon d={repeat === 'one' ? icons.repeatOne : icons.repeat} size={22} />
        </button>
      </div>
    </div>
  );
}
