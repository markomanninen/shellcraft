import React from 'react';
import { Box, Text } from 'ink';
import { glyphs, textProps } from '../theme.js';
import { KeyHint } from './key-hint.js';
import { Message, toMessageElement } from './message.js';
import { SizeProvider, useScreenSize, useTerminalSize } from '../size.js';
import { textWidth, truncateToWidth } from '../text.js';

const h = React.createElement;

/**
 * One row: app (bold accent) › screen (bold default), meta (muted) on the
 * right; one cell of padding left and right.
 */
export function TitleBar({ app, screen, meta }) {
  return h(
    Box,
    { height: 1, flexShrink: 0, paddingX: 1, width: '100%', overflow: 'hidden' },
    h(
      Box,
      { flexGrow: 1, flexShrink: 1, overflow: 'hidden' },
      h(
        Text,
        { wrap: 'truncate-end' },
        h(Text, { bold: true, ...textProps('accent') }, app),
        screen ? h(Text, textProps('muted'), ` ${glyphs.separator} `) : null,
        screen ? h(Text, { bold: true, ...textProps('default') }, screen) : null
      )
    ),
    meta
      ? h(Box, { flexShrink: 0, marginLeft: 2 }, h(Text, textProps('muted'), meta))
      : null
  );
}

/** Cells a hint list takes: `k label` joined by two spaces. */
export function hintsWidth(hints = []) {
  return hints.reduce(
    (sum, [k, label], i) => sum + (i > 0 ? 2 : 0) + textWidth(k) + (label ? 1 + textWidth(label) : 0),
    0
  );
}

// A message keeps at least this many cells (or its own width) before the
// hints have to give way.
const MIN_MESSAGE_CELLS = 12;

/**
 * Last row of every screen: key hints separated by two spaces on the left,
 * the latest message right-aligned. When space runs out the message is
 * shortened first (ending in "…"); the hints are cut only when even 12
 * cells of message do not fit next to them.
 *
 * hints: [[key, label], ...]
 * message: null | 'text' | { tone, text } | element (an element is not
 *   measured: it keeps its width and the hints give way)
 */
export function StatusBar({ hints = [], message }) {
  const { columns } = useScreenSize();
  const plain = typeof message === 'string' ? (message ? { tone: 'info', text: message } : null) : message;
  let messageElement;
  let messageBox = { flexShrink: 0, marginLeft: 2, maxWidth: Math.max(columns - 4, 1), overflow: 'hidden' };
  if (plain && !React.isValidElement(plain) && typeof plain === 'object') {
    const inner = Math.max(columns - 2, 1);
    const gap = hints.length > 0 ? 2 : 0;
    const text = String(plain.text ?? '');
    const full = 2 + textWidth(text); // glyph, space, text
    let cells = full;
    if (hintsWidth(hints) + gap + full > inner) {
      cells = Math.min(full, Math.max(inner - gap - hintsWidth(hints), MIN_MESSAGE_CELLS), Math.max(inner - gap, 2));
    }
    messageElement = h(Message, { tone: plain.tone ?? 'info' }, truncateToWidth(text, Math.max(cells - 2, 0)));
    messageBox = { flexShrink: 0, marginLeft: gap, width: cells, overflow: 'hidden' };
  } else {
    messageElement = toMessageElement(message);
  }
  const hintNodes = [];
  hints.forEach(([k, label], i) => {
    if (i > 0) hintNodes.push('  ');
    hintNodes.push(h(KeyHint, { key: `${k}-${i}`, k, label }));
  });
  return h(
    Box,
    { height: 1, flexShrink: 0, paddingX: 1, width: '100%', overflow: 'hidden' },
    h(
      Box,
      { flexGrow: 1, flexShrink: 1, overflow: 'hidden' },
      h(Text, { wrap: 'truncate-end' }, ...hintNodes)
    ),
    messageElement ? h(Box, messageBox, messageElement) : null
  );
}

/**
 * Full terminal: row 0 TitleBar, last row StatusBar, the body fills the
 * rest. Width and height default to the terminal size (stdout columns and
 * rows, updated on 'resize'); pass them to override.
 */
export function Screen({ app, screen, meta, hints, message, width, height, children }) {
  const terminal = useTerminalSize();
  const size = {
    columns: width ?? terminal.columns,
    rows: height ?? terminal.rows
  };
  return h(
    SizeProvider,
    { value: size },
    h(
      Box,
      { flexDirection: 'column', width: size.columns, height: size.rows, overflow: 'hidden' },
      h(TitleBar, { app, screen, meta }),
      h(
        Box,
        { flexDirection: 'column', flexGrow: 1, flexShrink: 1, overflow: 'hidden' },
        children
      ),
      h(StatusBar, { hints, message })
    )
  );
}
