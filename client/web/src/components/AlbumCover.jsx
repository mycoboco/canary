import {useState} from 'react';
import {coverUrl} from '../api.js';

export default function AlbumCover({coverId, className, imgClassName = '', fit = 'cover'}) {
  const [failed, setFailed] = useState(false);
  const [aspect, setAspect] = useState(null);
  const [trackedCoverId, setTrackedCoverId] = useState(coverId);

  if (trackedCoverId !== coverId) {
    setTrackedCoverId(coverId);
    setFailed(false);
    setAspect(null);
  }

  if (!coverId || failed) {
    return (
      <div className={`${className} shrink-0 bg-gray-100 flex items-center justify-center ${imgClassName}`}>
        <span className="text-gray-300 select-none text-3xl" aria-hidden="true">💿</span>
      </div>
    );
  }

  if (fit === 'cover') {
    return (
      <img
        key={coverId}
        src={coverUrl(coverId)}
        alt=""
        loading="lazy"
        decoding="async"
        className={`${className} shrink-0 object-cover ${imgClassName}`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className={`${className} shrink-0 flex items-center justify-center`}>
      <img
        key={coverId}
        src={coverUrl(coverId)}
        alt=""
        loading="lazy"
        decoding="async"
        className={imgClassName}
        style={{...containSize(aspect), minWidth: 0, minHeight: 0, display: 'block'}}
        onLoad={(e) => {
          const {naturalWidth, naturalHeight} = e.target;
          if (naturalWidth && naturalHeight) setAspect(naturalWidth / naturalHeight);
        }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function containSize(aspect) {
  if (!aspect) return {maxWidth: '100%', maxHeight: '100%'};
  return aspect >= 1
    ? {width: '100%', height: `${100 / aspect}%`}
    : {width: `${aspect * 100}%`, height: '100%'};
}
