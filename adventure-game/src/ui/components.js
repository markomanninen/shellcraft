// Small pieces the adventure screens share, built from @shellcraft/ui.
import React from 'react';
import { EmptyState, useInput, textWidth } from '@shellcraft/ui';
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

const PREFIX_WIDTH = 4; // "T12 "

/**
 * Journal entries as ScrollView lines: `T1  Arrived at …` with the turn
 * muted and wrapped lines under the text (hanging indent).
 */
export function logLines(entries) {
  return entries.map((entry) => {
    const prefix = `${entry.prefix.padEnd(PREFIX_WIDTH - 1)} `;
    return {
      segments: [{ text: prefix, tone: 'muted' }, { text: entry.text }],
      hangingIndent: textWidth(prefix),
      keepIndent: false
    };
  });
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
