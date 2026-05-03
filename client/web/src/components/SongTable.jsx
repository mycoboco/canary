import {formatTime} from '../utils.js';

export default function SongTable({songs, onPlay, currentSongId}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-400 border-b border-gray-100">
          <th className="py-2 px-3 font-medium">Title</th>
          <th className="py-2 px-3 font-medium hidden sm:table-cell">Artist</th>
          <th className="py-2 px-3 font-medium hidden md:table-cell">Album</th>
          <th className="py-2 px-3 font-medium hidden lg:table-cell">Genre</th>
          <th className="py-2 px-3 font-medium text-right">Time</th>
        </tr>
      </thead>
      <tbody>
        {songs.map((song, i) => (
          <tr
            key={song.id}
            onClick={() => onPlay(songs, i)}
            className={`cursor-pointer hover:bg-gray-50 ${
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
          </tr>
        ))}
      </tbody>
    </table>
  );
}
