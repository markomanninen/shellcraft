import React from 'react';
import { Box, Text } from 'ink';
import { textProps } from '../theme.js';

const h = React.createElement;

/** An empty row, e.g. between groups of InfoRows. */
export function BlankRow() {
  return h(Box, { height: 1, flexShrink: 0 });
}

/**
 * One label/value row: the label muted in a fixed column of `labelWidth`
 * cells (one of them always a gap before the value, also when the label is
 * cut), the value in default text or a tone ('muted' for "none", 'warning',
 * ...). Both truncate at the end. bold makes the value bold, except a muted
 * one (bold + dim shows as only one of them on some terminals).
 */
export function InfoRow({ label, value, tone = 'default', bold = false, labelWidth = 11 }) {
  return h(
    Box,
    { height: 1, flexShrink: 0, width: '100%', overflow: 'hidden' },
    h(
      Box,
      { width: Math.max(labelWidth - 1, 1), marginRight: 1, flexShrink: 0, overflow: 'hidden' },
      h(Text, { ...textProps('muted'), wrap: 'truncate-end' }, label)
    ),
    h(
      Box,
      { flexGrow: 1, flexShrink: 1, overflow: 'hidden' },
      h(
        Text,
        { ...textProps(tone), bold: Boolean(bold) && tone !== 'muted', wrap: 'truncate-end' },
        value === undefined || value === null ? '' : String(value)
      )
    )
  );
}

/**
 * InfoRows from [[label, value, tone?], ...]; null makes a BlankRow.
 * Returns an array of elements, for a column Box or ScrollView `rows`.
 */
export function infoRows(rows, labelWidth = 11) {
  return rows.map((row, i) =>
    row === null
      ? h(BlankRow, { key: `blank-${i}` })
      : h(InfoRow, { key: `${row[0]}-${i}`, label: row[0], value: row[1], tone: row[2] ?? 'default', labelWidth })
  );
}
