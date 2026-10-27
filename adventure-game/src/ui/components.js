// Small pieces the adventure screens share, built from @shellcraft/ui.
import React from 'react';
import { Box, Text, EmptyState, ScrollView, useInput, textProps, wrapText, textWidth } from '@shellcraft/ui';
import { GAME_CONFIG } from '../config/game-config.js';

const h = React.createElement;

export const APP_NAME = GAME_CONFIG.app.name;

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Title bar meta: the turn, or that there is no game. */
export const gameMeta = (gameState) => (gameState ? `turn ${gameState.moves}` : 'no game');

/** Hints of the secondary screens (Empty template: h menu, b back, q quit). */
export const BACK_HINTS = Object.freeze([['h', 'menu'], ['b', 'back'], ['q', 'quit']]);
export const SCROLL_HINTS = Object.freeze([['↑↓', 'scroll'], ...BACK_HINTS]);

/** Journal, stats and inventory before a game exists: not an error, no red. */
export function NoGame() {
  return h(EmptyState, {
    message: 'No adventure yet.',
    hint: 'Start one from the menu:',
    k: 'h',
    label: 'menu'
  });
}

/**
 * One label/value row: the label muted in a fixed column (11 cells, as in
 * the Split template), the value truncated at the end. `tone` colors the
 * value ('muted' for none/empty).
 */
export function InfoRow({ label, value, tone = 'default', labelWidth = 11, bold = false }) {
  return h(
    Box,
    { height: 1, flexShrink: 0, width: '100%', overflow: 'hidden' },
    h(
      Box,
      { width: labelWidth, flexShrink: 0, overflow: 'hidden' },
      h(Text, { ...textProps('muted'), wrap: 'truncate-end' }, label)
    ),
    h(
      Box,
      { flexGrow: 1, flexShrink: 1, overflow: 'hidden' },
      h(Text, { ...textProps(tone), bold: bold && tone !== 'muted', wrap: 'truncate-end' }, String(value))
    )
  );
}

export const Blank = () => h(Box, { height: 1, flexShrink: 0 });

const PREFIX_WIDTH = 4; // "T12 "

/**
 * Journal entries as one-row nodes for a ScrollView: `T1  Arrived at …`
 * with the turn muted and wrapped lines under the text (hanging indent).
 * ScrollView `lines` take one tone per line, so the rows are built here.
 */
export function logRows(entries, width) {
  const rows = [];
  entries.forEach((entry, i) => {
    const prefix = entry.prefix.padEnd(PREFIX_WIDTH - 1) + ' ';
    const indent = textWidth(prefix);
    const wrapped = wrapText(prefix + entry.text, Math.max(width, indent + 1), { hangingIndent: indent, keepIndent: false });
    wrapped.forEach((line, j) => {
      rows.push(
        j === 0
          ? h(Text, { key: `${i}-${j}`, wrap: 'truncate-end' }, h(Text, textProps('muted'), line.slice(0, prefix.length)), line.slice(prefix.length))
          : h(Text, { key: `${i}-${j}`, wrap: 'truncate-end' }, line)
      );
    });
  });
  return rows;
}

/** Journal entries in a fixed-size region that follows the newest entry. */
export function LogView({ entries, width, height, isActive = false }) {
  return h(ScrollView, { rows: logRows(entries, width), width, height, follow: true, isActive });
}

/** The largest scroll offset of a ScrollView (same rule as @shellcraft/ui). */
export function maxScrollOffset(total, height) {
  const hgt = Math.max(Math.floor(height) || 0, 0);
  if (total <= hgt || hgt === 0) return 0;
  if (hgt < 3) return total - hgt;
  return total - hgt + 1;
}

/** Number of rows `lines` take in a ScrollView of `width` cells. */
export function wrappedRowCount(lines, width) {
  return lines.reduce((sum, line) => {
    const text = typeof line === 'string' ? line : String(line?.text ?? '');
    return sum + wrapText(text, width, { hangingIndent: line?.hangingIndent ?? 0 }).length;
  }, 0);
}

/** Cut a status message to `cells` cells with an ellipsis. */
export function fitText(text, cells) {
  const value = String(text ?? '');
  if (textWidth(value) <= cells) return value;
  let out = '';
  for (const ch of Array.from(value)) {
    if (textWidth(out + ch) > cells - 1) break;
    out += ch;
  }
  return `${out}…`;
}

/**
 * Keys of the secondary screens: h menu, b / esc back to where the player
 * came from (the room or the menu).
 */
export function useBackKeys(ctx) {
  useInput((input, key) => {
    if (input === 'h') ctx.navigate('game');
    else if (input === 'b' || key.escape) ctx.back();
  });
}

/** Cells a StatusBar hint list takes: `k label` joined by two spaces. */
export function hintsWidth(hints) {
  return hints.reduce((sum, [k, label], i) => sum + (i > 0 ? 2 : 0) + textWidth(k) + (label ? 1 + textWidth(label) : 0), 0);
}
