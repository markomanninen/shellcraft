import React from 'react';
import { Screen, Panel, ScrollView } from '@shellcraft/ui';
import { APP_NAME, NoGame, BACK_HINTS, SCROLL_HINTS, useBackKeys, gameMeta } from './components.js';
import { storyOf, journalEntries } from './turn.js';

const h = React.createElement;

const QUEST_TONES = { completed: 'success', active: 'default', locked: 'muted' };

const signed = (n) => (n > 0 ? `+${n}` : String(n));

/**
 * The journal as ScrollView lines: quests, encounters, factions, NPC
 * memory and the turn log. Headings bold; details indented, and wrapped
 * lines keep their indent.
 */
export function journalLines(gameState) {
  const { quests, encounters, factions, npcs } = gameState.worldState;
  const lines = [{ text: 'Quests', bold: true }];
  for (const quest of Object.values(quests)) {
    lines.push({
      text: `  ${quest.title} · ${quest.status} · ${Math.round(quest.progress)}%`,
      tone: QUEST_TONES[quest.status] ?? 'default'
    });
    lines.push({ text: `    ${quest.description}`, tone: 'muted' });
  }

  lines.push('', { text: 'Encounters', bold: true });
  for (const encounter of Object.values(encounters)) {
    lines.push(encounter.defeated
      ? { text: `  ${encounter.name} · defeated`, tone: 'muted' }
      : `  ${encounter.name} · ${encounter.currentHp}/${encounter.maxHp} HP`);
  }

  lines.push('', { text: 'Factions', bold: true });
  for (const [name, score] of Object.entries(factions)) {
    lines.push(`  ${name.replace(/_/g, ' ')} · ${signed(score)}`);
  }

  lines.push('', { text: 'NPC memory', bold: true });
  for (const npc of Object.values(npcs)) {
    lines.push(`  ${npc.name} · trust ${signed(npc.trust)}`);
    const memory = npc.memory[npc.memory.length - 1];
    lines.push({ text: `    ${memory || 'No interactions yet'}`, tone: 'muted' });
  }

  const log = journalEntries(storyOf(gameState));
  if (log.length > 0) {
    lines.push('', { text: 'Log', bold: true });
    for (const entry of log) {
      lines.push({ text: `  ${entry.prefix.padEnd(3)} ${entry.text}`, hangingIndent: 4 });
    }
  }
  return lines;
}

export function JournalScreen({ ctx }) {
  const gameState = ctx.session.gameState;
  useBackKeys(ctx);
  const hasGame = Boolean(gameState?.worldState);
  return h(
    Screen,
    {
      app: APP_NAME,
      screen: 'Journal',
      meta: gameMeta(ctx.session),
      hints: hasGame ? SCROLL_HINTS : BACK_HINTS,
      message: ctx.message
    },
    h(
      Panel,
      // Empty template: nothing to focus, so the panel keeps the default border.
      { title: 'Journal', focused: hasGame },
      hasGame ? h(ScrollView, { lines: journalLines(gameState) }) : h(NoGame)
    )
  );
}
