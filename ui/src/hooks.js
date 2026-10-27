import { useEffect, useRef } from 'react';

/**
 * Call `callback` every `ms` milliseconds while the component is mounted
 * (periodic refresh, e.g. live stats). The latest callback is used without
 * restarting the timer; `ms` null or <= 0 pauses it. Cleared on unmount, so
 * a closed session leaves no timer behind.
 *
 * For animation frames prefer Ink's useAnimation (one shared timer for all
 * animated components).
 */
export function useInterval(callback, ms) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (ms === null || ms === undefined || !(ms > 0)) return undefined;
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}
