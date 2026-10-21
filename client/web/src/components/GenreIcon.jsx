import {bucketForGenre} from '../genreIcons.js';

// Monochrome genre icon. The SVG is used as a CSS mask so it takes the current
// text color (adapts to theme), with transparent holes preserved.
export default function GenreIcon({genre, size = 40, className = ''}) {
  const url = `/genres/${bucketForGenre(genre)}.svg`;
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flex: 'none',
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url(${url})`,
        maskImage: `url(${url})`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}
