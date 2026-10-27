import React, { useEffect, useState } from 'react';
import {
  Screen,
  Panel,
  SelectList,
  ListItem,
  TextField,
  ScrollView,
  Meter,
  EmptyState,
  Box,
  Text,
  useInput,
  useTerminalSize,
  textProps
} from '@shellcraft/ui';
import { GAME_CONFIG } from '../config/game-config.js';
import {
  APP_NAME,
  InfoRow,
  Blank,
  LogView,
  NoGame,
  BACK_HINTS,
  gameMeta,
  maxScrollOffset,
  wrappedRowCount,
  fitText,
  hintsWidth
} from './components.js';
import { MapView } from './map-view.js';
import {
  storyOf,
  narrativeLines,
  journalEntries,
  roomStatus,
  healthTone,
  tensionTone,
  needsTurn
} from './turn.js';

// The room's pure helpers moved to turn.js; re-exported for their tests.
export { validateRenderableResponse, buildMeterBar, classifyAction, combineOutcomeMessage } from './turn.js';

const h = React.createElement;

/**
 * Split template: two rows of panels between the title and status bars,
 * the left column 42 of 80 cells (52.5%), rows split evenly (11 + 11 at
 * 80×24).
 */
export function roomLayout(columns, rows) {
  const body = Math.max(rows - 2, 2);
  const top = Math.ceil(body / 2);
  const bottom = body - top;
  const left = Math.min(Math.max(Math.round(columns * 0.525), 1), columns);
  return { body, top, bottom, left, right: columns - left };
}

function StatusPanel({ status, height }) {
  const { player, director, encounter, itemsHere, inventory, objective } = status;
  const maxTension = GAME_CONFIG.systems.pacing.maxTension;
  return h(
    Panel,
    { title: 'Status', height, paddingX: 0, paddingY: 1 },
    h(Meter, {
      label: 'HP',
      value: player.health,
      max: player.maxHealth,
      display: `${player.health}/${player.maxHealth}`,
      tone: healthTone(player.health, player.maxHealth)
    }),
    h(Meter, {
      label: 'Tension',
      value: director.tension,
      max: maxTension,
      display: `${director.tension}/${maxTension}`,
      tone: tensionTone(director.tension, maxTension)
    }),
    h(Blank),
    h(
      Box,
      { flexDirection: 'column', paddingLeft: 1 },
      h(InfoRow, {
        label: 'Threat',
        value: encounter ? `${encounter.name} ${encounter.currentHp}/${encounter.maxHp} HP` : 'none',
        tone: encounter ? 'warning' : 'default'
      }),
      h(InfoRow, { label: 'Objective', value: objective ?? 'none', tone: objective ? 'default' : 'muted' }),
      h(InfoRow, {
        label: 'Visible',
        value: itemsHere.length ? itemsHere.join(', ') : 'nothing',
        tone: itemsHere.length ? 'default' : 'muted'
      }),
      h(InfoRow, {
        label: 'Inventory',
        value: inventory.length ? inventory.join(', ') : 'empty',
        tone: inventory.length ? 'default' : 'muted'
      })
    )
  );
}

/** Action rows without a selection: while waiting, or while typing. */
function StaticActions({ items, disabled, height }) {
  return h(
    Box,
    { flexDirection: 'column', flexShrink: 0, width: '100%' },
    ...items.slice(0, height).map((item, i) =>
      h(ListItem, { key: `${i}`, label: item.label, hint: item.hint, disabled, selected: false })
    )
  );
}

/**
 * The room (Split template): narrative top left, status top right, the
 * suggested actions with a free-text prompt bottom left (focused), the
 * journal bottom right; m swaps the right column for the map.
 *
 * Focus: the action list or the free-text field, never both. Tab (or /)
 * goes to the field; tab, esc or ⏎ come back. While the Game Master is
 * thinking the actions are muted and take no keys; i, j, m, h and q still
 * work. PgUp/PgDn scroll the story.
 */
export function RoomScreen({ ctx }) {
  const gameState = ctx.session.gameState;
  const { columns, rows } = useTerminalSize();
  const layout = roomLayout(columns, rows);
  const [focus, setFocus] = useState('actions');
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [scroll, setScroll] = useState(null); // null: follow the end

  const { busy, turnError } = ctx;
  const pending = needsTurn(gameState);

  // Enter the room → run the turn it is waiting for (first turn, a chosen
  // action, a narration that failed or was interrupted).
  useEffect(() => {
    if (gameState && pending && !busy && !turnError) ctx.runTurn();
  }, [gameState, pending, busy, turnError]);

  const story = storyOf(gameState);
  const last = story.at(-1);
  const storyKey = last ? `${last.turn}:${story.length}` : '';
  // A new turn: back to the end of the story and the first action.
  useEffect(() => {
    setScroll(null);
    setSelected(0);
  }, [storyKey, gameState]);

  const response = gameState?.lastResponse ?? null;
  const gameOver = Boolean(response?.game_over) && !pending;
  const actions = response && !gameOver && !pending ? response.actions : [];
  const previousActions = response && !gameOver ? response.actions : [];
  const canAct = Boolean(gameState) && !busy && !turnError && !pending && !gameOver && actions.length > 0;
  const asking = focus === 'ask' && canAct;

  const toActions = () => {
    setFocus('actions');
    ctx.setTyping(false);
  };
  const toAsk = () => {
    setFocus('ask');
    ctx.setTyping(true);
  };
  const act = (text, custom = false) => {
    setDraft('');
    toActions();
    ctx.act(text, { custom });
  };

  // Narrative: the story so far, or the room's description before the
  // first narration arrives.
  const room = gameState ? GAME_CONFIG.world.rooms[gameState.currentRoom] : null;
  const lines = story.length > 0
    ? narrativeLines(story)
    : room ? [{ text: room.description, tone: 'muted' }] : [];
  if (gameOver) lines.push('', { text: 'Victory: the quest is complete.', tone: 'success', bold: true });

  const storyWidth = Math.max(layout.left - 4, 1);
  const storyHeight = Math.max(layout.top - 2, 1);
  const maxOffset = maxScrollOffset(wrappedRowCount(lines, storyWidth), storyHeight);
  const offset = scroll === null ? maxOffset : Math.min(scroll, maxOffset);
  const page = Math.max(storyHeight - 2, 1);

  useInput((input, key) => {
    if (asking) {
      // The field takes the text; tab leaves it with the draft kept.
      if (key.tab) toActions();
      return;
    }
    if (key.pageUp) {
      setScroll(Math.max(offset - page, 0));
      return;
    }
    if (key.pageDown) {
      const next = offset + page;
      setScroll(next >= maxOffset ? null : next);
      return;
    }
    if (gameOver && key.return) {
      ctx.navigate('game');
      return;
    }
    if (input === 'h' || input === 'b' || key.escape) {
      ctx.navigate('game');
    } else if (input === 'i') {
      ctx.navigate('inventory');
    } else if (input === 'j') {
      ctx.navigate('journal');
    } else if (input === 'm' && gameState) {
      setShowMap((v) => !v);
    } else if (input === 'r' && turnError && !busy) {
      ctx.retry();
    } else if (canAct && (key.tab || input === '/')) {
      toAsk();
    } else if (canAct && /^[1-9]$/.test(input)) {
      const index = Number(input) - 1;
      if (index < actions.length) {
        setSelected(index);
        act(actions[index]);
      }
    }
  });

  if (!gameState) {
    return h(
      Screen,
      { app: APP_NAME, screen: 'Room', meta: gameMeta(null), hints: BACK_HINTS, message: ctx.message },
      h(Panel, { title: 'Room' }, h(NoGame))
    );
  }

  const status = roomStatus(gameState);
  const mapHint = ['m', showMap ? 'status' : 'map'];
  let hints;
  if (asking) hints = [['⏎', 'send'], ['esc', 'cancel'], ['tab', 'actions']];
  else if (gameOver) hints = [['⏎', 'menu'], ['i', 'items'], ['j', 'journal'], mapHint, ['q', 'quit']];
  else if (turnError && !busy) hints = [['r', 'retry'], ['h', 'menu'], ['q', 'quit']];
  else if (!canAct) hints = [['i', 'items'], ['j', 'journal'], mapHint, ['h', 'menu'], ['q', 'quit']];
  else {
    hints = [
      [actions.length > 1 ? `1-${Math.min(actions.length, 9)}` : '1', 'act'],
      ['tab', 'ask'],
      ['i', 'items'],
      ['j', 'journal'],
      mapHint,
      ['h', 'menu'],
      ['q', 'quit']
    ];
  }

  let message = ctx.message;
  if (turnError && !busy) {
    // Fit the error next to the hints: padding 2, gap 2, glyph + space 2.
    const space = Math.max(columns - 6 - hintsWidth(hints), 12);
    message = { tone: 'error', text: fitText(`The Game Master failed: ${turnError}`, space) };
  } else if (gameOver && !message) {
    message = { tone: 'success', text: 'Victory! Quest complete' };
  }

  const items = (canAct ? actions : previousActions).map((label, i) => ({ label, hint: String(i + 1) }));
  // Panel rows minus its edges and the prompt row.
  const listHeight = Math.max(layout.bottom - 3, 1);
  let actionsBody;
  if (gameOver) {
    actionsBody = h(EmptyState, { message: 'The quest is complete.', hint: 'Back to the menu:', k: '⏎', label: 'menu' });
  } else if (items.length === 0) {
    actionsBody = h(
      Box,
      { height: 1, paddingLeft: 3, overflow: 'hidden' },
      h(Text, { ...textProps('muted'), wrap: 'truncate-end' }, 'Waiting for the first turn')
    );
  } else if (canAct && !asking) {
    actionsBody = h(SelectList, {
      items,
      selectedIndex: selected,
      onChange: setSelected,
      onSelect: (_i, item) => act(item.label),
      numberKeys: false,
      height: listHeight
    });
  } else {
    actionsBody = h(StaticActions, { items, disabled: !canAct, height: listHeight });
  }

  const actionsPanel = h(
    Panel,
    { title: 'Actions', focused: true, padding: 0 },
    actionsBody,
    gameOver ? null : h(Box, { flexGrow: 1 }),
    gameOver
      ? null
      : h(
          Box,
          { height: 1, flexShrink: 0, paddingX: 1 },
          h(TextField, {
            label: '>',
            labelWidth: 2,
            valueWidth: 'fill',
            value: draft,
            focused: asking,
            placeholder: 'Ask the Game Master…',
            onChange: setDraft,
            onSubmit: (value) => {
              const text = value.trim();
              if (text) act(text, true);
              else toActions();
            },
            onCancel: () => {
              setDraft('');
              toActions();
            }
          })
        )
  );

  const right = showMap
    ? h(Panel, { title: 'Map' }, h(MapView, { gameState }))
    : h(
        Box,
        { flexDirection: 'column', flexGrow: 1 },
        h(StatusPanel, { status, height: layout.top }),
        h(
          Panel,
          { title: 'Journal' },
          h(LogView, {
            entries: journalEntries(story),
            width: Math.max(layout.right - 4, 1),
            height: Math.max(layout.bottom - 4, 1)
          })
        )
      );

  return h(
    Screen,
    { app: APP_NAME, screen: status.roomName, meta: gameMeta(gameState), hints, message },
    h(
      Box,
      { flexGrow: 1 },
      h(
        Box,
        { flexDirection: 'column', width: layout.left, flexShrink: 0 },
        h(
          Panel,
          { title: status.roomName, height: layout.top, paddingY: 0 },
          h(ScrollView, {
            lines,
            width: storyWidth,
            height: storyHeight,
            offset,
            onOffsetChange: setScroll,
            isActive: false
          })
        ),
        actionsPanel
      ),
      right
    )
  );
}
