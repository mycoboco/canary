import {formatTime} from '../utils.js';

export default function SongTable({
  songs, onPlay, currentSongId, onAddToPlaylist, onRemove, sortKey, sortDir, onSort,
}) {
  const showActions = !!(onAddToPlaylist || onRemove);

  const sortableHeader = (key, label, extra) => {
    if (!onSort) {
      return <th className={`py-2 px-3 font-medium ${extra}`}>{label}</th>;
    }
    const active = sortKey === key;
    const arrow = active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';
    return (
      <th
        onClick={() => onSort(key)}
        className={`py-2 px-3 font-medium cursor-pointer select-none hover:text-gray-600 ${
          active ? 'text-gray-700' : ''
        } ${extra}`}
      >
        {label}{arrow}
      </th>
    );
  };

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-400 border-b border-gray-100">
          {sortableHeader('title', 'Title', '')}
          {sortableHeader('artist', 'Artist', 'hidden sm:table-cell')}
          {sortableHeader('album', 'Album', 'hidden md:table-cell')}
          {sortableHeader('genre', 'Genre', 'hidden lg:table-cell')}
          <th className="py-2 px-3 font-medium text-right">Time</th>
          {showActions && <th className="py-2 px-3 w-px"></th>}
        </tr>
      </thead>
      <tbody>
        {songs.map((song, i) => (
          <tr
            key={song.id}
            onClick={() => onPlay(songs, i)}
            className={`group cursor-pointer hover:bg-gray-50 ${
              currentSongId === song.id ? 'text-blue-600 font-medium' : ''
            }`}
          >
            <td className="py-2 px-3">
              <div>{song.title}</div>
              <div className="text-gray-400 text-xs sm:hidden">{song.artist}</div>
            </td>
            <td className="py-2 px-3 hidden sm:table-cell text-gray-600">{song.artist}</td>
            <td className="py-2 px-3 hidden md:table-cell text-gray-600">{song.album}</td>
            <td className="py-2 px-3 hidden lg:table-cell text-gray-600">{song.genre}</td>
            <td className="py-2 px-3 text-right text-gray-400">{formatTime(song.time)}</td>
            {showActions && (
              <td
                className="py-1 px-2 text-right whitespace-nowrap"
                onClick={(e) => e.stopPropagation()}
              >
                {onAddToPlaylist && (
                  <button
                    onClick={() => onAddToPlaylist(song)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full text-base leading-none text-gray-400 hover:text-blue-600 hover:bg-blue-50 sm:opacity-60 sm:group-hover:opacity-100 focus:opacity-100"
                    title="Add to playlist"
                    aria-label="Add to playlist"
                  >+</button>
                )}
                {onRemove && (
                  <button
                    onClick={() => onRemove(song.id)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full text-base leading-none text-gray-400 hover:text-red-500 hover:bg-red-50 sm:opacity-60 sm:group-hover:opacity-100 focus:opacity-100"
                    title="Remove"
                    aria-label="Remove"
                  >−</button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
