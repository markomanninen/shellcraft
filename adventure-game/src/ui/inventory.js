import React from 'react';
import { Screen, Panel, Table, EmptyState, useTerminalSize } from '@shellcraft/ui';
import { APP_NAME, NoGame, BACK_HINTS, SCROLL_HINTS, useBackKeys, plural } from './components.js';

const h = React.createElement;

const COLUMNS = [
  { label: '#', width: 3, align: 'right' },
  { label: 'Item', width: 20, grow: true }
];

/** Table template: the items in one panel; ↑↓ scroll when they do not fit. */
export function InventoryScreen({ ctx }) {
  const gameState = ctx.session.gameState;
  const { rows } = useTerminalSize();
  useBackKeys(ctx);

  const items = gameState?.inventory ?? [];
  // Body rows: terminal minus title and status bars, panel edges, header.
  const height = Math.max(rows - 5, 1);
  const meta = gameState ? plural(items.length, 'item') : 'no game';
  const hints = items.length > height ? SCROLL_HINTS : BACK_HINTS;

  let body;
  if (!gameState) body = h(NoGame);
  else if (items.length === 0) {
    body = h(EmptyState, { message: 'Your pack is empty.', hint: 'Take what you find in the rooms:', k: 'b', label: 'back' });
  } else {
    body = h(Table, {
      columns: COLUMNS,
      rows: items.map((item, i) => [String(i + 1), item]),
      selectedIndex: -1,
      height
    });
  }

  return h(
    Screen,
    { app: APP_NAME, screen: 'Inventory', meta, hints, message: ctx.message },
    h(Panel, { title: 'Inventory', focused: items.length > 0, padding: items.length > 0 ? 0 : 1 }, body)
  );
}
