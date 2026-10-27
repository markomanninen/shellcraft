import React from 'react';
import { Text } from 'ink';
import { theme, textProps } from '../theme.js';

const h = React.createElement;

/**
 * `[ label ]` for form actions only (navigation is a key hint). Brackets
 * muted; focused = accent fill, onAccent bold text.
 */
export function Button({ label, focused = false }) {
  if (focused) {
    return h(
      Text,
      { backgroundColor: theme.surface.accent, ...textProps('onAccent'), bold: true },
      `[ ${label} ]`
    );
  }
  return h(
    Text,
    null,
    h(Text, textProps('muted'), '[ '),
    h(Text, { bold: true, ...textProps('default') }, label),
    h(Text, textProps('muted'), ' ]')
  );
}
