import React from 'react';
import { Screen, Panel, ScrollView, Box, Text, InfoRow, useTerminalSize, textProps } from '@shellcraft/ui';
import { GAME_CONFIG } from '../config/game-config.js';
import { GameModel } from '../models/game.js';
import { APP_NAME, NoGame, BACK_HINTS, SCROLL_HINTS, useBackKeys, gameMeta } from './components.js';

const h = React.createElement;
const gameModel = new GameModel();

const heading = (text) => h(Text, { bold: true, wrap: 'truncate-end' }, text);
const blank = () => h(Text, null, ' ');

/**
 * Stats as one-row nodes for a ScrollView: progress rows across the
 * panel, then skill checks and combat next to the action profile.
 */
export function statsRows(gameState, width) {
  const { director, metrics, quests, time } = gameState.worldState;
  const room = gameModel.getRoom(gameState.currentRoom);
  const questList = Object.values(quests);
  const completed = questList.filter((quest) => quest.status === 'completed').length;
  const checks = metrics.checks;
  const maxTension = GAME_CONFIG.systems.pacing.maxTension;

  const progress = [
    h(InfoRow, { label: 'Health', labelWidth: 12, value: `${gameState.player.health}/${gameState.player.maxHealth}` }),
    h(InfoRow, { label: 'Turns', labelWidth: 12, value: gameState.moves }),
    h(InfoRow, { label: 'Location', labelWidth: 12, value: room?.name ?? gameState.currentRoom }),
    h(InfoRow, { label: 'Items', labelWidth: 12, value: `${gameState.inventory.length} held · peak ${metrics.inventoryPeak}` }),
    h(InfoRow, { label: 'Quests', labelWidth: 12, value: `${completed}/${questList.length} completed` }),
    h(InfoRow, { label: 'Director', labelWidth: 12, value: `${director.style} · ${director.lastBeat}` }),
    h(InfoRow, { label: 'Tension', labelWidth: 12, value: `${director.tension}/${maxTension} · ${time.phase}` })
  ];

  const left = [
    heading('Skill checks'),
    h(InfoRow, { label: 'Total', labelWidth: 14, value: checks.passed + checks.partial + checks.failed }),
    h(InfoRow, { label: 'Passed', labelWidth: 14, value: checks.passed }),
    h(InfoRow, { label: 'Partial', labelWidth: 14, value: checks.partial }),
    h(InfoRow, { label: 'Failed', labelWidth: 14, value: checks.failed }),
    blank(),
    heading('Combat'),
    h(InfoRow, { label: 'Wins', labelWidth: 14, value: metrics.combatVictories }),
    h(InfoRow, { label: 'Damage dealt', labelWidth: 14, value: metrics.damageDealt }),
    h(InfoRow, { label: 'Damage taken', labelWidth: 14, value: metrics.damageTaken })
  ];

  const counted = Object.entries(metrics.actionCounts).filter(([, count]) => count > 0);
  const right = [
    heading('Action profile'),
    ...(counted.length > 0
      ? counted.map(([name, count]) => h(InfoRow, { label: name, labelWidth: 14, value: count }))
      : [h(Text, { ...textProps('muted'), wrap: 'truncate-end' }, 'No actions yet')])
  ];

  const half = Math.max(Math.floor(width / 2), 1);
  const columns = [];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    columns.push(
      h(
        Box,
        { width: '100%' },
        h(Box, { width: half, flexShrink: 0, overflow: 'hidden' }, left[i] ?? null),
        h(Box, { flexGrow: 1, flexShrink: 1, overflow: 'hidden' }, right[i] ?? null)
      )
    );
  }

  return [...progress, blank(), ...columns];
}

export function StatsScreen({ ctx }) {
  const gameState = ctx.session.gameState;
  const { columns, rows } = useTerminalSize();
  useBackKeys(ctx);
  const hasGame = Boolean(gameState?.worldState);
  const content = hasGame ? statsRows(gameState, Math.max(columns - 4, 2)) : null;
  // Inner height: terminal minus bars (2), panel edges (2) and padding (2).
  const fits = !content || content.length <= rows - 6;
  return h(
    Screen,
    {
      app: APP_NAME,
      screen: 'Stats',
      meta: gameMeta(ctx.session),
      hints: fits ? BACK_HINTS : SCROLL_HINTS,
      message: ctx.message
    },
    h(
      Panel,
      { title: 'Stats', focused: hasGame },
      hasGame ? h(ScrollView, { rows: content }) : h(NoGame)
    )
  );
}
