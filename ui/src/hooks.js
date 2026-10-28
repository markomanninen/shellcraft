import { useEffect, useRef, useState } from 'react';

/**
 * Call `callback` every `ms` milliseconds while the component is mounted
 * (periodic refresh, e.g. live stats). The latest callback is used without
 * restarting the timer; `ms` null or <= 0 pauses it. Cleared on unmount, so
 * a closed session leaves no timer behind.
 *
 * For animation frames prefer useAnimation (re-exported from Ink: one
 * shared timer for all animated components).
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

const errorText = (error) => (error instanceof Error ? error.message : String(error ?? 'Unknown error'));

function attempt(load) {
  try {
    const value = load();
    if (value && typeof value.then === 'function') return { promise: value };
    return { state: { data: value, error: null, loading: false } };
  } catch (error) {
    return { state: { data: undefined, error: errorText(error), loading: false } };
  }
}

/**
 * Data for a screen from a sync or async loader: { data, error, loading,
 * refresh }.
 *
 * - A sync loader renders with data on the first frame; an async one has
 *   `loading` true until its first result (reloads keep the old data on
 *   screen and do not set `loading`).
 * - `interval` (ms) reloads periodically while the component is mounted
 *   (live stats); the timer goes with the component, i.e. on navigation and
 *   when the session ends. A tick is skipped while a reload is still
 *   running.
 * - Results that arrive after unmount, or after a newer reload started,
 *   are dropped.
 * - A failed reload keeps the data shown before and sets `error` (a
 *   string), e.g. for the status bar.
 *
 * refresh() reloads now and returns a promise of true when its result was
 * shown (false when it was dropped).
 */
export function useData(load, { interval = null } = {}) {
  const alive = useRef(true);
  const seq = useRef(0);
  const inFlight = useRef(false);
  const pending = useRef(null);
  const loader = useRef(load);
  loader.current = load;

  const [state, setState] = useState(() => {
    const result = attempt(load);
    if (result.promise) {
      pending.current = result.promise;
      return { data: undefined, error: null, loading: true };
    }
    return result.state;
  });

  const apply = (id, update) => {
    if (!alive.current || id !== seq.current) return false;
    setState(update);
    return true;
  };

  const track = (promise, id) => {
    inFlight.current = true;
    return promise.then(
      (data) => {
        if (id === seq.current) inFlight.current = false;
        return apply(id, { data, error: null, loading: false });
      },
      (error) => {
        if (id === seq.current) inFlight.current = false;
        return apply(id, (previous) => ({ ...previous, error: errorText(error), loading: false }));
      }
    );
  };

  const refresh = () => {
    const id = ++seq.current;
    const result = attempt(loader.current);
    if (result.promise) return track(result.promise, id);
    inFlight.current = false;
    return Promise.resolve(apply(id, result.state));
  };

  useEffect(() => {
    alive.current = true;
    if (pending.current) {
      const promise = pending.current;
      pending.current = null;
      track(promise, ++seq.current);
    }
    return () => {
      alive.current = false;
    };
    // Mount only: later loads go through refresh().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useInterval(() => {
    if (!inFlight.current) refresh();
  }, interval);

  return { ...state, refresh };
}
