import {coverUrl} from '../api.js';
import {Icon, icons} from './Icons.jsx';

export default function MiniPlayer({player, onExpand}) {
  const {currentSong, playing, togglePlay} = player;

  if (!currentSong) return null;

  return (
    <div
      className="md:hidden flex items-center h-14 bg-white border-t border-gray-200 px-3 gap-3"
      onClick={onExpand}
    >
      <img
        key={currentSong.id}
        src={coverUrl(currentSong.id)}
        alt=""
        className="w-10 h-10 rounded object-cover bg-gray-100"
        onError={(e) => { e.target.style.visibility = 'hidden'; }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{currentSong.title}</div>
        <div className="text-xs text-gray-400 truncate">{currentSong.artist}</div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
        aria-label={playing ? 'Pause' : 'Play'}
        className="w-8 h-8 flex items-center justify-center text-gray-600"
      >
        <Icon d={playing ? icons.pause : icons.play} size={20} />
      </button>
    </div>
  );
}
