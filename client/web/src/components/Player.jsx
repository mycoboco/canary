import {formatSec} from '../utils.js';
import {Icon, icons} from './Icons.jsx';
import useSeekBar from '../hooks/useSeekBar.js';
import AlbumCover from './AlbumCover.jsx';

export default function Player({player, onAddToPlaylist}) {
  const {
    currentSong,
    playing,
    currentTime,
    duration,
    volume,
    shuffle,
    repeat,
    togglePlay,
    prev,
    next,
    seek,
    setVolume,
    toggleShuffle,
    toggleRepeat,
  } = player;
  const {displayTime, inputProps: seekInputProps} = useSeekBar({currentTime, onSeek: seek});

  if (!currentSong) return null;

  return (
    <div className="hidden md:flex items-center h-20 bg-white border-t border-gray-200 px-6 gap-4">
      {/* left: song info */}
      <div className="flex items-center gap-3 w-72 min-w-0">
        <AlbumCover
          coverId={currentSong.id}
          className="w-12 h-12 rounded shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{currentSong.title}</div>
          <div className="text-xs text-gray-400 truncate">{currentSong.artist}</div>
        </div>
        {onAddToPlaylist && (
          <button
            onClick={() => onAddToPlaylist(currentSong)}
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-base leading-none text-gray-400 hover:text-blue-600 hover:bg-blue-50"
            title="Add to playlist"
            aria-label="Add to playlist"
          >+</button>
        )}
      </div>

      {/* center: controls + progress */}
      <div className="flex-1 flex flex-col items-center gap-1">
        <div className="flex items-center gap-5">
          <button
            onClick={toggleShuffle}
            aria-label={shuffle ? 'Shuffle on' : 'Shuffle off'}
            aria-pressed={shuffle}
            title="Shuffle"
            className={`p-1.5 rounded-full transition-colors ${
              shuffle ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Icon d={icons.shuffle} size={18} />
          </button>
          <button
            onClick={prev}
            aria-label="Previous"
            title="Previous"
            className="p-1.5 rounded-full text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
          >
            <Icon d={icons.prev} size={22} />
          </button>
          <button
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="w-10 h-10 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-gray-700 hover:scale-105 transition-all"
          >
            <Icon d={playing ? icons.pause : icons.play} size={22} />
          </button>
          <button
            onClick={next}
            aria-label="Next"
            title="Next"
            className="p-1.5 rounded-full text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
          >
            <Icon d={icons.next} size={22} />
          </button>
          <button
            onClick={toggleRepeat}
            aria-label={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'No repeat'}
            title={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'No repeat'}
            className={`p-1.5 rounded-full transition-colors ${
              repeat !== 'none' ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Icon d={repeat === 'one' ? icons.repeatOne : icons.repeat} size={18} />
          </button>
        </div>
        <div className="w-full max-w-md flex items-center gap-2 text-xs text-gray-400">
          <span className="w-8 text-right">{formatSec(displayTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            {...seekInputProps}
            aria-label="Seek"
            className="flex-1 h-1 accent-gray-800 cursor-pointer"
          />
          <span className="w-8">{formatSec(duration)}</span>
        </div>
      </div>

      {/* right: volume */}
      <div className="flex items-center gap-2 w-36 shrink-0 mr-2">
        <span className="text-gray-400 p-1" aria-hidden="true">
          <Icon d={icons.volume} size={18} />
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(+e.target.value)}
          aria-label="Volume"
          className="flex-1 h-1 accent-gray-800 cursor-pointer"
        />
      </div>
    </div>
  );
}
