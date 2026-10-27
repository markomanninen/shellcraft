import React from 'react';
import { Box, Text } from 'ink';
import { theme, glyphs, meterTones } from '../theme.js';

const h = React.createElement;

export const METER_WIDTH = 36;
const LABEL_WIDTH = 8;
const BAR_WIDTH = 20;
const VALUE_WIDTH = 8;

/** Number of filled cells: round(value / max × 20), clamped to 0..20. */
export function meterCells(value, max = 100) {
  const ratio = max > 0 ? Number(value) / Number(max) : 0;
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(Math.max(Math.round(ratio * BAR_WIDTH), 0), BAR_WIDTH);
}

/**
 * 36 cells: label 8 (bold muted), bar 20 (`█` in the tone color, the rest
 * `░` muted), value 8 right-aligned in its own column, so it never wraps.
 * tone: default (accent) | warning | danger.
 */
export function Meter({ label, value = 0, max = 100, display, tone = 'default' }) {
  const filled = meterCells(value, max);
  const shown = display ?? `${Math.round((max > 0 ? Number(value) / Number(max) : 0) * 100)}%`;
  return h(
    Box,
    { width: METER_WIDTH, height: 1, flexShrink: 0, overflow: 'hidden' },
    h(
      Box,
      { width: LABEL_WIDTH, flexShrink: 0, overflow: 'hidden' },
      h(Text, { bold: true, color: theme.text.muted, wrap: 'truncate-end' }, label)
    ),
    h(
      Box,
      { width: BAR_WIDTH, flexShrink: 0 },
      h(
        Text,
        null,
        filled > 0 ? h(Text, { color: meterTones[tone] ?? meterTones.default }, glyphs.barFull.repeat(filled)) : null,
        filled < BAR_WIDTH ? h(Text, { color: theme.text.muted }, glyphs.barEmpty.repeat(BAR_WIDTH - filled)) : null
      )
    ),
    h(
      Box,
      { width: VALUE_WIDTH, flexShrink: 0, justifyContent: 'flex-end', overflow: 'hidden' },
      h(Text, { wrap: 'truncate-end' }, String(shown))
    )
  );
}
