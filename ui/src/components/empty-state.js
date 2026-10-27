import React from 'react';
import { Box, Text } from 'ink';
import { textProps } from '../theme.js';
import { KeyHint } from './key-hint.js';

const h = React.createElement;

/**
 * Centered in its parent: the message in default text, then the hint in
 * muted followed by a key hint for the next step. No box, no red: an empty
 * list is not an error.
 */
export function EmptyState({ message, hint, k, label }) {
  return h(
    Box,
    { flexDirection: 'column', flexGrow: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
    h(Text, { ...textProps('default'), wrap: 'truncate-end' }, message),
    hint || k
      ? h(
          Text,
          { wrap: 'truncate-end' },
          hint ? h(Text, textProps('muted'), hint) : null,
          hint && k ? ' ' : null,
          k ? h(KeyHint, { k, label }) : null
        )
      : null
  );
}
