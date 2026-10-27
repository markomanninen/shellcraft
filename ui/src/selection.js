import { useRef, useState } from 'react';

/**
 * Selected index for lists and tables. Controlled when `selectedIndex` is a
 * number and `onChange` is given; otherwise the component keeps its own
 * state starting at `selectedIndex` (or 0).
 *
 * The latest index is also kept in a ref, so several keys arriving in one
 * chunk (fast typing, a test writing "\x1b[B\x1b[B") each move one step
 * instead of all reading the same stale render.
 */
export function useSelection(count, selectedIndex, onChange) {
  const controlled = typeof selectedIndex === 'number' && typeof onChange === 'function';
  const [own, setOwn] = useState(typeof selectedIndex === 'number' ? selectedIndex : 0);
  const current = clampIndex(controlled ? selectedIndex : own, count);
  const ref = useRef(current);
  ref.current = current;

  const select = (next) => {
    const index = clampIndex(next, count);
    if (index === ref.current) return;
    ref.current = index;
    if (!controlled) setOwn(index);
    if (typeof onChange === 'function') onChange(index);
  };

  return { index: current, ref, select };
}

export function clampIndex(index, count) {
  if (count <= 0) return -1;
  if (typeof index !== 'number' || Number.isNaN(index)) return 0;
  return Math.min(Math.max(index, 0), count - 1);
}

/** Next index in `direction` (+1/-1) that is not disabled; stays put at the ends. */
export function stepIndex(items, from, direction) {
  for (let i = from + direction; i >= 0 && i < items.length; i += direction) {
    if (!items[i]?.disabled) return i;
  }
  return from;
}

/** First row of a window of `height` rows that keeps `selected` visible. */
export function windowStart(count, selected, height) {
  if (!height || height <= 0 || count <= height) return 0;
  const sel = Math.max(selected, 0);
  const start = sel - Math.floor(height / 2);
  return Math.min(Math.max(start, 0), count - height);
}
