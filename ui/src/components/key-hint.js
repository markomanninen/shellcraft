import React from 'react';
import { Text } from 'ink';
import { textProps } from '../theme.js';

const h = React.createElement;

/**
 * One key hint: the key in bold accent, one space, the lowercase verb in
 * muted. Same syntax everywhere: `q quit`, `↑↓ move`, `⏎ select`, `b back`.
 */
export function KeyHint({ k, label }) {
  return h(
    Text,
    null,
    h(Text, { bold: true, ...textProps('accent') }, k),
    label ? ' ' : null,
    label ? h(Text, textProps('muted'), label) : null
  );
}
