import React, { useRef, useState } from 'react';
import { Box, Text, useInput, useBoxMetrics } from 'ink';
import { textProps } from '../theme.js';
import { wrapSegments } from '../text.js';
import { scrollLayout, maxScrollOffset } from '../selection.js';

const h = React.createElement;

/**
 * The "↑ N more" / "↓ N more" row of a scrolled region, dim. No colored
 * scrollbar: the count says how much is hidden and which way.
 */
export function MoreIndicator({ direction = 'down', count = 0, indent = 0 }) {
  return h(
    Box,
    { height: 1, flexShrink: 0, paddingLeft: indent, overflow: 'hidden' },
    h(Text, { ...textProps('muted'), wrap: 'truncate-end' }, `${direction === 'up' ? '↑' : '↓'} ${count} more`)
  );
}

/** A line as styled segments: string | { text, tone, bold } | { segments }. */
function segmentsOf(line) {
  if (typeof line === 'string') return [{ text: line }];
  if (Array.isArray(line?.segments)) return line.segments;
  return [{ text: String(line?.text ?? ''), tone: line?.tone, bold: line?.bold }];
}

/**
 * Text props of a segment. Muted is never bold as well: bold and dim show
 * as only one of them on some terminals (see theme.js).
 */
function segmentProps(segment) {
  const tone = segment?.tone ?? 'default';
  return { ...textProps(tone), bold: Boolean(segment?.bold) && tone !== 'muted' };
}

/**
 * The visual rows `lines` take at `width` cells, as ScrollView lays them
 * out: [[{ text, style }]] (style: the segment, null for indent).
 */
export function layoutLines(lines, width, { hangingIndent = 0, keepIndent = true } = {}) {
  return (lines ?? []).flatMap((line) =>
    wrapSegments(segmentsOf(line), width, {
      hangingIndent: line?.hangingIndent ?? hangingIndent,
      keepIndent: line?.keepIndent ?? keepIndent
    })
  );
}

/**
 * Number of rows `lines` (or a `text` string) take in a ScrollView of
 * `width` cells. With maxScrollOffset(rows, height) a screen can drive a
 * controlled ScrollView, e.g. to start at the end.
 */
export function wrappedRowCount(lines, width, options = {}) {
  const source = typeof lines === 'string' ? [lines] : lines;
  return layoutLines(source, width, options).length;
}

const KEY_MODES = new Set(['all', 'page', 'none']);

/**
 * A fixed-height region that scrolls: wrapped text, styled lines, or
 * arbitrary one-row nodes. When content is hidden, the first and last rows
 * say so: `↑ 3 more`, `↓ 12 more` (dim).
 *
 * Content (one of):
 *   text: a string; "\n" separates paragraphs, each is word-wrapped.
 *   lines: each wrapped, one of
 *     string
 *     { text, tone, bold, hangingIndent, keepIndent }  (tone: a theme text
 *       token, 'muted', 'success', ...)
 *     { segments: [{ text, tone, bold }], hangingIndent, keepIndent }:
 *       several styles in one line, e.g. a muted "T1  " and the entry.
 *   rows: [node]: one row each, not wrapped (tables, custom rows).
 * Wrapping keeps a paragraph's leading spaces on its wrapped lines
 * (keepIndent, default true) plus hangingIndent more cells.
 *
 * Size: height and width in cells; without them the view fills its parent
 * (flexGrow) and measures itself, which costs one extra render on mount.
 *
 * Scrolling: offset + onOffsetChange (controlled, in wrapped rows), or the
 * view keeps its own. follow: stay at the end as content grows, until the
 * user scrolls up (logs, narrative); give the view a new `key` to start
 * following again. Keys while isActive:
 *   keys 'all' (default): ↑↓ / k j one row, PgUp PgDn a page, Home End.
 *   keys 'page': only PgUp PgDn Home End, so ↑↓ can belong to a list.
 *   keys 'none': no keys (same as isActive false).
 */
export function ScrollView({
  text,
  lines,
  rows,
  height,
  width,
  hangingIndent = 0,
  keepIndent = true,
  offset,
  onOffsetChange,
  follow = false,
  isActive = true,
  keys = 'all'
}) {
  const ref = useRef(null);
  const metrics = useBoxMetrics(ref);
  const H = height ?? (metrics.hasMeasured ? metrics.height : 0);
  const W = width ?? (metrics.hasMeasured ? metrics.width : 0);
  const keyMode = KEY_MODES.has(keys) ? keys : 'all';

  // Visual rows: lists of styled pieces for text/lines, or the given nodes.
  let items;
  if (rows) {
    items = rows;
  } else if (W > 0) {
    const source = lines ?? (text === undefined || text === null ? [] : [String(text)]);
    items = layoutLines(source, W, { hangingIndent, keepIndent });
  } else {
    items = [];
  }

  const total = items.length;
  const max = maxScrollOffset(total, H);
  const controlled = typeof offset === 'number' && typeof onOffsetChange === 'function';
  const [own, setOwn] = useState({ offset: 0, pinned: true });
  let current = controlled ? offset : follow && own.pinned ? max : own.offset;
  current = Math.min(Math.max(current, 0), max);
  const currentRef = useRef(current);
  currentRef.current = current;

  const scrollTo = (next) => {
    const o = Math.min(Math.max(next, 0), max);
    if (o === currentRef.current) return;
    currentRef.current = o;
    if (!controlled) setOwn({ offset: o, pinned: o >= max });
    if (typeof onOffsetChange === 'function') onOffsetChange(o);
  };

  useInput(
    (input, key) => {
      const page = Math.max(H - 2, 1);
      const o = currentRef.current;
      if (keyMode === 'all' && (key.upArrow || input === 'k')) scrollTo(o - 1);
      else if (keyMode === 'all' && (key.downArrow || input === 'j')) scrollTo(o + 1);
      else if (key.pageUp) scrollTo(o - page);
      else if (key.pageDown) scrollTo(o + page);
      else if (key.home) scrollTo(0);
      else if (key.end) scrollTo(max);
    },
    { isActive: isActive && keyMode !== 'none' && total > 0 }
  );

  const layout = scrollLayout(total, H, current);
  const visible = items.slice(layout.offset, layout.offset + layout.count);
  const children = [];
  if (layout.top) children.push(h(MoreIndicator, { key: 'up', direction: 'up', count: layout.above }));
  visible.forEach((item, i) => {
    const key = `r${layout.offset + i}`;
    if (rows) {
      children.push(h(Box, { key, height: 1, flexShrink: 0, overflow: 'hidden' }, item));
    } else if (item.length === 0) {
      children.push(h(Text, { key }, ' '));
    } else {
      children.push(
        h(
          Text,
          { key, wrap: 'truncate-end' },
          ...item.map((piece, j) => h(Text, { key: `${j}`, ...segmentProps(piece.style) }, piece.text))
        )
      );
    }
  });
  if (layout.bottom) children.push(h(MoreIndicator, { key: 'down', direction: 'down', count: layout.below }));

  return h(
    Box,
    {
      ref,
      flexDirection: 'column',
      overflow: 'hidden',
      ...(height === undefined ? { flexGrow: 1, flexShrink: 1, flexBasis: 0 } : { height, flexShrink: 0 }),
      ...(width === undefined ? {} : { width })
    },
    ...children
  );
}
