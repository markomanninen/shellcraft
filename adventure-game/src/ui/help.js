import React from 'react';
import { Screen, Panel, ScrollView, Box, Text, useTerminalSize, textProps, wrapText } from '@shellcraft/ui';
import { APP_NAME, SCROLL_HINTS, useBackKeys, gameMeta } from './components.js';

const h = React.createElement;

const KEYS = [
  ['↑↓ ⏎', 'move and select in lists'],
  ['1-9', 'take a suggested action at once (room), jump (menu)'],
  ['tab', 'ask the Game Master in your own words; tab, esc or ⏎ go back'],
  ['pgup pgdn', 'scroll the story (room)'],
  ['i', 'inventory'],
  ['j', 'journal'],
  ['m', 'map in place of the status panels (room)'],
  ['r', 'retry after the Game Master failed'],
  ['h', 'menu'],
  ['b esc', 'back'],
  ['q', 'quit (ctrl-c always quits, q not while typing)']
];

const GAMEPLAY = [
  'Deterministic rules resolve inventory, quests and faction reputation.',
  'Combat encounters are deterministic and resolve with skill checks.',
  'Skill checks decide the outcome: success, partial or fail.',
  'NPCs remember your interactions and track their trust in you.',
  'The director paces tone and tension as you play.',
  'The Game Master (an LLM) only narrates what the rules decided.'
];

const TIPS = [
  'Check the journal for objectives and faction standing.',
  'Talk to NPCs to unlock better quest paths.',
  'Defeat guardians before reaching for high-value objectives.',
  'Use key items where they matter, especially in the temple.',
  'Balance exploration and caution as tension rises.',
  'Your game is saved for the SSH key you sign in with; without a key it is gone when you leave.'
];

const KEY_WIDTH = 12;

/** Help as one-row nodes: headings, wrapped paragraphs and key rows. */
export function helpRows(width) {
  const rows = [];
  const heading = (text) => rows.push(h(Text, { bold: true, wrap: 'truncate-end' }, text));
  const blank = () => rows.push(h(Text, null, ' '));
  const paragraph = (text, indent = 2, hanging = 0) => {
    for (const line of wrapText(' '.repeat(indent) + text, width, { hangingIndent: hanging })) {
      rows.push(h(Text, { wrap: 'truncate-end' }, line));
    }
  };

  heading('Objective');
  paragraph('Earn the Elder Seal, recover the temple amulet and claim the treasure beyond the vault sentinel.');
  blank();
  heading('Keys');
  for (const [keys, text] of KEYS) {
    const lines = wrapText(text, Math.max(width - 2 - KEY_WIDTH, 1));
    lines.forEach((line, i) => {
      rows.push(
        h(
          Box,
          { width: '100%' },
          h(
            Box,
            { width: 2 + KEY_WIDTH, flexShrink: 0, paddingLeft: 2 },
            i === 0 ? h(Text, { bold: true, ...textProps('accent') }, keys) : null
          ),
          h(Box, { flexGrow: 1, flexShrink: 1, overflow: 'hidden' }, h(Text, { wrap: 'truncate-end' }, line))
        )
      );
    });
  }
  blank();
  heading('Gameplay');
  GAMEPLAY.forEach((text) => paragraph(`- ${text}`, 2, 2));
  blank();
  heading('Tips');
  TIPS.forEach((text) => paragraph(`- ${text}`, 2, 2));
  blank();
  heading('Good luck, adventurer!');
  return rows;
}

export function HelpScreen({ ctx }) {
  const { columns } = useTerminalSize();
  useBackKeys(ctx);
  return h(
    Screen,
    { app: APP_NAME, screen: 'Help', meta: gameMeta(ctx.session), hints: SCROLL_HINTS, message: ctx.message },
    h(Panel, { title: 'How to play', focused: true }, h(ScrollView, { rows: helpRows(Math.max(columns - 4, 10)) }))
  );
}
