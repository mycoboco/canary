import {formatTime} from '../utils.js';

export default function SongTable({
  songs, onPlay, currentSongId, onAddToPlaylist, onRemove, sortKey, sortDir, onSort, stickyHeader,
}) {
  const showActions = !!(onAddToPlaylist || onRemove);
  const thBase = `py-2 px-3 border-b border-gray-100 ${
    stickyHeader ? 'sticky top-[54px] bg-white z-10' : ''
  }`;

  const sortableHeader = (key, label, extra) => {
    if (!onSort) {
      return <th className={`${thBase} font-medium ${extra}`}>{label}</th>;
    }
    const active = sortKey === key;
    const arrow = active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';
    return (
      <th
        onClick={() => onSort(key)}
        className={`${thBase} font-medium cursor-pointer select-none hover:text-gray-600 ${
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
        <tr className="text-left text-gray-400">
          {sortableHeader('title', 'Title', '')}
          {sortableHeader('artist', 'Artist', 'hidden sm:table-cell')}
          {sortableHeader('album', 'Album', 'hidden md:table-cell')}
          {sortableHeader('genre', 'Genre', 'hidden lg:table-cell')}
          <th className={`${thBase} font-medium text-right`}>Time</th>
          {showActions && <th className={`${thBase} w-px`}></th>}
        </tr>
      </thead>
      <tbody>
        {songs.map((song, i) => {
          const isCurrent = currentSongId === song.id;
          const cellBg = isCurrent ? 'bg-blue-100' : 'group-hover:bg-gray-100';
          return (
            <tr
              key={song.id}
              onClick={() => onPlay(songs, i)}
              className={`group cursor-pointer ${
                isCurrent ? 'text-blue-600 font-medium' : ''
              }`}
            >
              <td className={`py-2 px-3 rounded-l-lg ${cellBg}`}>
                <div className="flex items-start gap-2">
                  <span
                    className={`shrink-0 text-xs leading-5 ${
                      isCurrent ? 'text-blue-600' : 'invisible'
                    }`}
                    aria-hidden="true"
                  >▶</span>
                  <div className="min-w-0">
                    <div>{song.title}</div>
                    <div className="text-gray-400 text-xs sm:hidden">{song.artist}</div>
                  </div>
                </div>
              </td>
              <td className={`py-2 px-3 hidden sm:table-cell text-gray-600 ${cellBg}`}>{song.artist}</td>
              <td className={`py-2 px-3 hidden md:table-cell text-gray-600 ${cellBg}`}>{song.album}</td>
              <td className={`py-2 px-3 hidden lg:table-cell text-gray-600 ${cellBg}`}>{song.genre}</td>
              <td className={`py-2 px-3 text-right text-gray-400 ${
                !showActions ? 'rounded-r-lg' : ''
              } ${cellBg}`}>{formatTime(song.time)}</td>
              {showActions && (
                <td
                  className={`py-1 px-2 text-right whitespace-nowrap rounded-r-lg ${cellBg}`}
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
          );
        })}
      </tbody>
    </table>
  );
}
