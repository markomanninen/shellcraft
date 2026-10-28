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

// Scrolling with "↑ N more" / "↓ N more" rows. A window of `height` rows
// over `total` items starting at item `offset`: when items are hidden above,
// the first row is the "↑" indicator; when items are hidden below, the last
// row is the "↓" indicator. Windows under 3 rows get no indicators.

/** { offset, count, above, below, top, bottom } for a window. */
export function scrollLayout(total, height, offset = 0) {
  const h = Math.max(Math.floor(height) || 0, 0);
  if (total <= h || h === 0) return { offset: 0, count: Math.min(total, h), above: 0, below: Math.max(total - h, 0), top: false, bottom: false };
  const o = Math.min(Math.max(Math.floor(offset) || 0, 0), maxScrollOffset(total, h));
  if (h < 3) {
    return { offset: o, count: h, above: o, below: total - o - h, top: false, bottom: false };
  }
  const top = o > 0;
  const rest = h - (top ? 1 : 0);
  const bottom = o + rest < total;
  const count = rest - (bottom ? 1 : 0);
  return { offset: o, count, above: o, below: total - o - count, top, bottom };
}

/** The largest useful offset: the last item sits on the last row. */
export function maxScrollOffset(total, height) {
  const h = Math.max(Math.floor(height) || 0, 0);
  if (total <= h || h === 0) return 0;
  if (h < 3) return total - h;
  return total - h + 1; // the "↑" row takes one row at the end
}

/** Smallest change to `offset` that keeps item `index` in the window. */
export function scrollToVisible(total, height, offset, index) {
  const max = maxScrollOffset(total, height);
  let o = Math.min(Math.max(Math.floor(offset) || 0, 0), max);
  if (index < 0 || index >= total) return o;
  if (index < o) return index;
  while (o < max && index >= o + scrollLayout(total, height, o).count) o++;
  return o;
}

/**
 * Window offset for a list or table of `total` rows shown `height` at a
 * time that keeps `index` visible, moving as little as possible from the
 * previous render's offset (so the selection does not jump to the middle).
 */
export function useFollowSelection(total, height, index) {
  const previous = useRef(0);
  const offset = height ? scrollToVisible(total, height, previous.current, index) : 0;
  previous.current = offset;
  return offset;
}
