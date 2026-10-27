import React from 'react';
import { Text } from 'ink';
import { theme } from '../theme.js';

const h = React.createElement;

/**
 * `[ label ]` for form actions only (navigation is a key hint). Brackets
 * muted; focused = accent fill, onAccent bold text.
 */
export function Button({ label, focused = false }) {
  if (focused) {
    return h(
      Text,
      { backgroundColor: theme.surface.accent, color: theme.text.onAccent, bold: true },
      `[ ${label} ]`
    );
  }
  return h(
    Text,
    null,
    h(Text, { color: theme.text.muted }, '[ '),
    h(Text, { bold: true, color: theme.text.default }, label),
    h(Text, { color: theme.text.muted }, ' ]')
  );
}
