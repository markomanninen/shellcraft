// Small pieces the admin screens share: the screen frame (title, meta,
// b/r keys), label/value rows, meter tones and a data hook for live stats.
import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, Screen, textProps, useInput, useInterval } from '@shellcraft/ui';

const h = React.createElement;

export const APP_NAME = 'Admin';

/** Label column of the full screens (fits "Architecture"). */
export const LABEL_WIDTH = 14;
/** Label column of the home detail panel (Figma: 12 cells). */
export const SUMMARY_LABEL_WIDTH = 12;

/** Meter tone for a percentage: warning from 75 %, danger from 90 %. */
export function meterTone(percent) {
  if (percent >= 90) return 'danger';
  if (percent >= 75) return 'warning';
  return 'default';
}

/**
 * One label/value row: the label muted in a fixed column (with one cell
 * before the value even when it is cut), the value in default text or a
 * tone. Both truncate at the end.
 */
export function InfoRow({ label, value, tone = 'default', labelWidth = LABEL_WIDTH }) {
  return h(
    Box,
    { height: 1, flexShrink: 0, width: '100%', overflow: 'hidden' },
    h(
      Box,
      { width: Math.max(labelWidth - 1, 1), marginRight: 1, flexShrink: 0, overflow: 'hidden' },
      h(Text, { ...textProps('muted'), wrap: 'truncate-end' }, label)
    ),
    h(
      Box,
      { flexGrow: 1, flexShrink: 1, overflow: 'hidden' },
      h(Text, { ...textProps(tone), wrap: 'truncate-end' }, value === undefined || value === null ? '' : String(value))
    )
  );
}

/** An empty row between groups. */
export const Blank = () => h(Box, { height: 1, flexShrink: 0 });

/**
 * Label/value rows from [[label, value, tone?], ...]; null makes a blank
 * row. Returns an array of elements (for a column Box or ScrollView rows).
 */
export function infoRows(rows, labelWidth = LABEL_WIDTH) {
  return rows.map((row, i) =>
    row === null
      ? h(Blank, { key: `blank-${i}` })
      : h(InfoRow, { key: `${row[0]}-${i}`, label: row[0], value: row[1], tone: row[2] ?? 'default', labelWidth })
  );
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
 * refresh }. Sync loaders render with data on the first frame. `interval`
 * (ms) reloads periodically while the component is mounted (live stats);
 * the timer goes away with the component, i.e. on navigation and when the
 * session ends. An async reload still running when the next tick comes is
 * not started twice, and results that arrive after unmount or after a newer
 * reload are dropped.
 *
 * refresh() returns a promise of true when its result was shown.
 */
export function useData(load, { interval = null } = {}) {
  const alive = useRef(true);
  const seq = useRef(0);
  const inFlight = useRef(false);
  const pending = useRef(null);
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
        // Keep what was shown before; the error goes to the status bar.
        return apply(id, (previous) => ({ ...previous, error: errorText(error), loading: false }));
      }
    );
  };

  const refresh = () => {
    const id = ++seq.current;
    const result = attempt(load);
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

/**
 * Keys every screen but home shares: b (or Esc) back to the dashboard, r
 * reload (when the screen has a `refresh`), with "Refreshed" in the status
 * bar once the new data is on screen. q is handled by the app.
 */
export function useScreenKeys(ctx, refresh) {
  useInput((input, key) => {
    if (input === 'b' || key.escape) {
      ctx.navigate('dashboard');
    } else if (input === 'r' && refresh) {
      Promise.resolve(refresh()).then((shown) => {
        if (shown) ctx.notify('success', 'Refreshed');
      });
    }
  });
}

/** Status bar hints of a detail screen. */
export function screenHints({ scroll = false, refresh = false } = {}) {
  return [
    scroll ? ['↑↓', 'scroll'] : null,
    refresh ? ['r', 'refresh'] : null,
    ['b', 'back'],
    ['q', 'quit']
  ].filter(Boolean);
}

/**
 * Screen with the app name and the host name as title bar meta. `message`
 * overrides the app's status message (e.g. a load error).
 */
export function AdminScreen({ ctx, screen, hints, message, children }) {
  return h(
    Screen,
    { app: APP_NAME, screen, meta: ctx.hostname, hints, message: message ?? ctx.message },
    children
  );
}

/** Status bar message while a screen waits for its first data, or failed. */
export function loadMessage({ loading, error, data }, what) {
  if (error) return { tone: 'error', text: error };
  if (loading && data === undefined) return { tone: 'busy', text: `Loading ${what}` };
  return undefined;
}
