import {useState, useEffect, useRef, forwardRef} from 'react';
import {TableVirtuoso} from 'react-virtuoso';
import {formatTime} from '../utils.js';

const tableComponents = {
  Table: (props) => (
    <table
      {...props}
      className="w-full text-sm"
      style={{...props.style, width: '100%', tableLayout: 'fixed'}}
    />
  ),
  TableHead: forwardRef((props, ref) => (
    <thead
      {...props}
      ref={ref}
      className="bg-white"
      style={{...props.style, top: 'var(--header-top, 0px)'}}
    />
  )),
  TableRow: ({context, ...props}) => {
    const idx = props['data-index'];
    const song = context?.songs?.[idx];
    if (!song) return <tr {...props} />;
    const isCurrent = context.currentSongId === song.id;
    return (
      <tr
        {...props}
        tabIndex={context.focusedIndex === idx ? 0 : -1}
        onClick={() => {
          context.setFocusedIndex(idx);
          context.onPlay(context.songs, idx);
        }}
        onKeyDown={(e) => context.handleKeyDown(e, idx)}
        onFocus={() => context.setFocusedIndex(idx)}
        className={`group cursor-pointer ${
          isCurrent ? 'text-blue-600 font-medium' : ''
        }`}
      />
    );
  },
};

const renderItem = (_, song, ctx) => (
  <SongCells
    song={song}
    isCurrent={ctx.currentSongId === song.id}
    showActions={ctx.showActions}
    onAddToPlaylist={ctx.onAddToPlaylist}
    onRemove={ctx.onRemove}
  />
);

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

function SongCells({song, isCurrent, showActions, onAddToPlaylist, onRemove}) {
  const cellBg = isCurrent ? 'bg-blue-100' : 'group-hover:bg-gray-100';
  return (
    <>
      <td className={`py-2 px-3 rounded-l-lg ${cellBg}`}>
        <div className="flex items-start gap-2">
          <span
            className={`shrink-0 text-xs leading-5 ${
              isCurrent ? 'text-blue-600' : 'invisible'
            }`}
            aria-hidden="true"
          >▶</span>
          <div className="min-w-0 flex-1">
            <div className="truncate">{song.title}</div>
            <div className="text-gray-400 text-xs sm:hidden truncate">{song.artist}</div>
          </div>
        </div>
      </td>
      <td className={`py-2 px-3 hidden sm:table-cell text-gray-600 truncate ${cellBg}`}>{song.artist}</td>
      <td className={`py-2 px-3 hidden md:table-cell text-gray-600 truncate ${cellBg}`}>{song.album}</td>
      <td className={`py-2 px-3 hidden lg:table-cell text-gray-600 truncate ${cellBg}`}>{song.genre}</td>
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
    </>
  );
}

export default function SongTable({
  songs, onPlay, currentSongId, onAddToPlaylist, onRemove, sortKey, sortDir, onSort, virtualized, stickyOffset = 0,
}) {
  const showActions = !!(onAddToPlaylist || onRemove);
  const thBase = 'py-2 px-3 border-b border-gray-100 bg-white';
  const isDesktop = useIsDesktop();
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [scrollParent, setScrollParent] = useState(null);
  const virtuosoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (songs.length > 0 && focusedIndex >= songs.length) {
      setFocusedIndex(songs.length - 1);
    }
  }, [songs.length, focusedIndex]);

  function focusRowAt(idx) {
    requestAnimationFrame(() => {
      const root = containerRef.current ?? document;
      const row = root.querySelector(`tr[data-index="${idx}"]`);
      if (row) {
        row.focus();
        return;
      }
      // virtuoso may need one more frame to render after scrollToIndex
      requestAnimationFrame(() => {
        (containerRef.current ?? document).querySelector(`tr[data-index="${idx}"]`)?.focus();
      });
    });
  }

  function moveFocus(newIndex) {
    if (newIndex < 0 || newIndex >= songs.length) return;
    setFocusedIndex(newIndex);
    if (virtualized && virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({index: newIndex, behavior: 'auto'});
    }
    focusRowAt(newIndex);
  }

  function handleKeyDown(e, idx) {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(idx + 1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(idx - 1); return; }
    if (e.key === 'Home') { e.preventDefault(); moveFocus(0); return; }
    if (e.key === 'End') { e.preventDefault(); moveFocus(songs.length - 1); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.currentTarget === e.target) {
      e.preventDefault();
      onPlay(songs, idx);
    }
  }

  useEffect(() => {
    if (virtualized && containerRef.current) {
      setScrollParent(containerRef.current.closest('main'));
    }
  }, [virtualized]);

  function handleRangeChanged(range) {
    if (range.startIndex == null) return;
    setFocusedIndex((current) => {
      if (current < range.startIndex || current > range.endIndex) {
        return range.startIndex;
      }
      return current;
    });
  }

  const sortableHeader = (key, label, extra, width) => {
    const style = width ? {width} : undefined;
    if (!onSort) {
      return <th className={`${thBase} font-medium ${extra}`} style={style}>{label}</th>;
    }
    const active = sortKey === key;
    const arrow = active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';
    return (
      <th
        onClick={() => onSort(key)}
        style={style}
        className={`${thBase} font-medium cursor-pointer select-none hover:text-gray-600 ${
          active ? 'text-gray-700' : ''
        } ${extra}`}
      >
        {label}{arrow}
      </th>
    );
  };

  const headerRow = (
    <tr className="text-left text-gray-400">
      {sortableHeader('title', 'Title', '')}
      {sortableHeader('artist', 'Artist', 'hidden sm:table-cell', '20%')}
      {sortableHeader('album', 'Album', 'hidden md:table-cell', '20%')}
      {sortableHeader('genre', 'Genre', 'hidden lg:table-cell', '15%')}
      <th className={`${thBase} font-medium text-right`} style={{width: 80}}>Time</th>
      {showActions && <th className={thBase} style={{width: 90}}></th>}
    </tr>
  );

  const context = {
    songs, currentSongId, onPlay, showActions, onAddToPlaylist, onRemove,
    focusedIndex, setFocusedIndex, handleKeyDown,
  };

  if (virtualized) {
    return (
      <div ref={containerRef} style={{'--header-top': `${stickyOffset}px`}}>
        {scrollParent && (
          <TableVirtuoso
            ref={virtuosoRef}
            key={isDesktop ? 'd' : 'm'}
            customScrollParent={scrollParent}
            data={songs}
            context={context}
            components={tableComponents}
            fixedHeaderContent={() => headerRow}
            itemContent={renderItem}
            rangeChanged={handleRangeChanged}
          />
        )}
      </div>
    );
  }

  return (
    <table ref={containerRef} className="w-full text-sm" style={{tableLayout: 'fixed', borderCollapse: 'collapse'}}>
      <thead>{headerRow}</thead>
      <tbody>
        {songs.map((song, i) => {
          const isCurrent = currentSongId === song.id;
          return (
            <tr
              key={song.id}
              data-index={i}
              tabIndex={focusedIndex === i ? 0 : -1}
              onClick={() => {
                setFocusedIndex(i);
                onPlay(songs, i);
              }}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onFocus={() => setFocusedIndex(i)}
              className={`group cursor-pointer ${
                isCurrent ? 'text-blue-600 font-medium' : ''
              }`}
            >
              <SongCells
                song={song}
                isCurrent={isCurrent}
                showActions={showActions}
                onAddToPlaylist={onAddToPlaylist}
                onRemove={onRemove}
              />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
