import React, { useState } from 'react';
import { Screen, Panel, SelectList, EmptyState, Meter, Box } from '@shellcraft/ui';
import { GAME_CONFIG } from '../config/game-config.js';
import { APP_NAME, InfoRow, Blank, gameMeta, plural } from './components.js';
import { objectiveText, healthTone, tensionTone } from './turn.js';

const h = React.createElement;

/** Menu items; "Continue" only with a game. No Exit item: q quits. */
export function menuItems(hasGame) {
  const items = [
    ...(hasGame ? [{ label: 'Continue adventure', action: 'continue' }] : []),
    { label: 'Start new adventure', action: 'new' },
    { label: 'Inventory', action: 'inventory' },
    { label: 'Journal', action: 'journal' },
    { label: 'Stats', action: 'stats' },
    { label: 'Help', action: 'help' }
  ];
  return items.map((item, i) => ({ ...item, hint: String(i + 1) }));
}

/** The campaign snapshot next to the menu. */
function Campaign({ gameState }) {
  const quests = Object.values(gameState.worldState.quests);
  const completed = quests.filter((quest) => quest.status === 'completed').length;
  const room = GAME_CONFIG.world.rooms[gameState.currentRoom];
  const objective = objectiveText(gameState);
  const { health, maxHealth } = gameState.player;
  const { tension } = gameState.worldState.director;
  const maxTension = GAME_CONFIG.systems.pacing.maxTension;
  return h(
    Box,
    { flexDirection: 'column' },
    h(InfoRow, { label: 'Location', value: room?.name ?? gameState.currentRoom }),
    h(InfoRow, { label: 'Turn', value: gameState.moves }),
    h(InfoRow, { label: 'Objective', value: objective ?? 'none', tone: objective ? 'default' : 'muted' }),
    h(InfoRow, { label: 'Quests', value: `${completed}/${quests.length} completed` }),
    h(InfoRow, {
      label: 'Inventory',
      value: gameState.inventory.length ? plural(gameState.inventory.length, 'item') : 'empty',
      tone: gameState.inventory.length ? 'default' : 'muted'
    }),
    h(Blank),
    h(Meter, { label: 'HP', value: health, max: maxHealth, display: `${health}/${maxHealth}`, tone: healthTone(health, maxHealth) }),
    h(Meter, { label: 'Tension', value: tension, max: maxTension, display: `${tension}/${maxTension}`, tone: tensionTone(tension, maxTension) })
  );
}

/**
 * Menu + detail: the menu has focus, the campaign snapshot sits next to
 * it. ↑↓ move, ⏎ select, number keys jump.
 */
export function MenuScreen({ ctx }) {
  const gameState = ctx.session.gameState;
  const items = menuItems(Boolean(gameState));
  const [index, setIndex] = useState(0);

  const select = (_i, item) => {
    if (item.action === 'continue') ctx.navigate('room');
    else if (item.action === 'new') ctx.startNewGame();
    else ctx.navigate(item.action);
  };

  return h(
    Screen,
    {
      app: APP_NAME,
      screen: 'Menu',
      meta: gameMeta(gameState),
      hints: [['↑↓', 'move'], ['⏎', 'select'], [`1-${items.length}`, 'jump'], ['q', 'quit']],
      message: ctx.message
    },
    h(
      Box,
      { flexGrow: 1 },
      h(
        Panel,
        { title: 'Menu', focused: true, width: 30, padding: 0 },
        h(SelectList, { items, selectedIndex: index, onChange: setIndex, onSelect: select })
      ),
      h(
        Panel,
        { title: 'Campaign' },
        gameState
          ? h(Campaign, { gameState })
          : h(EmptyState, { message: 'No adventure yet.', hint: 'Pick Start new adventure:', k: '⏎', label: 'select' })
      )
    )
  );
}
