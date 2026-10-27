import React, { useRef, useState } from 'react';
import { Box, Text, useInput, useBoxMetrics } from 'ink';
import { textProps } from '../theme.js';
import { wrapText } from '../text.js';
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

const lineText = (line) => (typeof line === 'string' ? line : String(line?.text ?? ''));

/**
 * A fixed-height region that scrolls: wrapped text, styled lines, or
 * arbitrary one-row nodes. When content is hidden, the first and last rows
 * say so: `↑ 3 more`, `↓ 12 more` (dim).
 *
 * Content (one of):
 *   text: a string; "\n" separates paragraphs, each is word-wrapped.
 *   lines: [string | { text, tone, bold, hangingIndent }]: each wrapped;
 *     tone is a theme text token ('muted', 'success', ...).
 *   rows: [node]: one row each, not wrapped (tables, custom rows).
 * Wrapping keeps a paragraph's leading spaces on its wrapped lines
 * (keepIndent, default true) plus hangingIndent more cells.
 *
 * Size: height and width in cells; without them the view fills its parent
 * (flexGrow) and measures itself, which costs one extra render on mount.
 *
 * Scrolling: offset + onOffsetChange (controlled, in wrapped rows), or the
 * view keeps its own. follow: stay at the end as content grows, until the
 * user scrolls up (logs, narrative). Keys when isActive: ↑↓ / k j one row,
 * PgUp PgDn a page, Home End the ends.
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
  isActive = true
}) {
  const ref = useRef(null);
  const metrics = useBoxMetrics(ref);
  const H = height ?? (metrics.hasMeasured ? metrics.height : 0);
  const W = width ?? (metrics.hasMeasured ? metrics.width : 0);

  // Visual rows: [{ text, props }] for text/lines, or the given nodes.
  let items;
  if (rows) {
    items = rows;
  } else if (W > 0) {
    const source = lines ?? (text === undefined || text === null ? [] : [String(text)]);
    items = source.flatMap((line) => {
      const props = { ...textProps(line?.tone ?? 'default'), bold: Boolean(line?.bold) };
      const hanging = line?.hangingIndent ?? hangingIndent;
      return wrapText(lineText(line), W, { hangingIndent: hanging, keepIndent }).map((t) => ({ text: t, props }));
    });
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
      if (key.upArrow || input === 'k') scrollTo(o - 1);
      else if (key.downArrow || input === 'j') scrollTo(o + 1);
      else if (key.pageUp) scrollTo(o - page);
      else if (key.pageDown) scrollTo(o + page);
      else if (key.home) scrollTo(0);
      else if (key.end) scrollTo(max);
    },
    { isActive: isActive && total > 0 }
  );

  const layout = scrollLayout(total, H, current);
  const visible = items.slice(layout.offset, layout.offset + layout.count);
  const children = [];
  if (layout.top) children.push(h(MoreIndicator, { key: 'up', direction: 'up', count: layout.above }));
  visible.forEach((item, i) => {
    const key = `r${layout.offset + i}`;
    if (rows) children.push(h(Box, { key, height: 1, flexShrink: 0, overflow: 'hidden' }, item));
    else children.push(h(Text, { key, ...item.props, wrap: 'truncate-end' }, item.text === '' ? ' ' : item.text));
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
