import React from 'react';
import { Box, Text } from 'ink';
import { glyphs, textProps } from '../theme.js';
import { KeyHint } from './key-hint.js';
import { toMessageElement } from './message.js';
import { SizeProvider, useScreenSize, useTerminalSize } from '../size.js';

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

/**
 * Last row of every screen: key hints separated by two spaces on the left,
 * the latest message right-aligned. When space runs out the hints are
 * truncated first, then the message.
 *
 * hints: [[key, label], ...]
 * message: null | 'text' | { tone, text } | element
 */
export function StatusBar({ hints = [], message }) {
  const { columns } = useScreenSize();
  const messageElement = toMessageElement(message);
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
    messageElement
      ? h(
          Box,
          { flexShrink: 0, marginLeft: 2, maxWidth: Math.max(columns - 4, 1), overflow: 'hidden' },
          messageElement
        )
      : null
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
