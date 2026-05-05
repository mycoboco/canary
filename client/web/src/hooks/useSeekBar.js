import {useState} from 'react';

export default function useSeekBar({currentTime, onSeek}) {
  const [scrub, setScrub] = useState(null);
  const displayTime = scrub != null ? scrub : currentTime;

  function commit(e) {
    onSeek(+e.target.value);
    setScrub(null);
  }

  const inputProps = {
    value: displayTime,
    onChange: (e) => setScrub(+e.target.value),
    onPointerUp: commit,
    onKeyUp: commit,
  };

  return {displayTime, inputProps};
}
