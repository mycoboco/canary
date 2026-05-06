import {useState} from 'react';
import {coverUrl} from '../api.js';

export default function AlbumCover({coverId, className}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`${className} flex items-center justify-center text-4xl text-gray-300 bg-gray-100`}>
        💿
      </div>
    );
  }

  return (
    <img
      src={coverUrl(coverId)}
      alt=""
      loading="lazy"
      decoding="async"
      className={`${className} object-cover bg-gray-100`}
      onError={() => setFailed(true)}
    />
  );
}
