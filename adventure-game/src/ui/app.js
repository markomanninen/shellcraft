import React, { useRef, useState } from 'react';
import { useApp, useInput } from '@shellcraft/ui';
import { LLMGameEngine } from '../llm/game-engine.js';
import { RulesEngine } from '../models/rules-engine.js';
import { createInitialGameState, normalizeGameState } from '../models/game-state.js';
import { MenuScreen } from './game.js';
import { RoomScreen } from './room.js';
import { InventoryScreen } from './inventory.js';
import { JournalScreen } from './journal.js';
import { StatsScreen } from './stats.js';
import { HelpScreen } from './help.js';
import { appendStory, buildResponse, nextAction, validateRenderableResponse } from './turn.js';

const h = React.createElement;

export const screens = {
  game: MenuScreen,
  room: RoomScreen,
  inventory: InventoryScreen,
  journal: JournalScreen,
  stats: StatsScreen,
  help: HelpScreen
};

/** StatusBar message while the LLM narrates a turn (spinner + text). */
export const BUSY_MESSAGE = Object.freeze({ tone: 'busy', text: 'The Game Master is thinking' });

const errorText = (error) => String(error?.message || error || 'Unknown error').replace(/\s+/g, ' ').trim();

/**
 * The adventure for one SSH session. Holds the current screen, the status
 * bar message and the turn in flight; screens get a `ctx`.
 *
 * A turn runs here, not in the room screen, so it survives a look at the
 * inventory or the journal: the rules engine resolves the action, the LLM
 * narrates it (BUSY_MESSAGE meanwhile), the response is validated and the
 * game saved. A failed narration leaves the resolved turn pending (as
 * before the port) and shows the error in the StatusBar; r retries.
 *
 * session.gameState is mutated in place and saved with saveGame(), like
 * the blessed version. q quits except while a text field is being edited.
 *
 * props: session, saveGame(), llm (narrateTurn), rules (resolveTurn),
 * initialScreen.
 */
export function AdventureApp({ session, saveGame = () => {}, llm, rules, initialScreen = 'game' }) {
  const { exit } = useApp();
  const [engines] = useState(() => ({
    llm: llm ?? new LLMGameEngine(),
    rules: rules ?? new RulesEngine()
  }));
  useState(() => {
    // Saved games are normalized when the sessions file loads; this covers
    // a game handed in some other way. Once, so a turn in flight keeps
    // writing to the same object.
    if (session.gameState) session.gameState = normalizeGameState(session.gameState);
    // A saved response the room cannot render is dropped (as before the
    // port); the room then runs a fresh turn.
    const last = session.gameState?.lastResponse;
    if (last) {
      try {
        validateRenderableResponse(last);
      } catch (error) {
        console.error(`[adventure] Dropping the saved turn: ${error.message}`);
        delete session.gameState.lastResponse;
      }
    }
    return null;
  });
  const [route, setRoute] = useState({ name: screens[initialScreen] ? initialScreen : 'game', from: 'game', visit: 0 });
  const [message, setMessage] = useState(null);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [turnError, setTurnError] = useState(null);
  const [, setVersion] = useState(0);
  const visits = useRef(0);
  const inFlight = useRef(false);
  const routeRef = useRef(route);
  routeRef.current = route;

  const refresh = () => setVersion((v) => v + 1);

  useInput(
    (input, key) => {
      if (input === 'q' && !key.ctrl && !key.meta) exit();
    },
    { isActive: !typing }
  );

  const save = () => {
    try {
      saveGame();
    } catch (error) {
      console.error('[adventure] Failed to save the game:', error.message);
    }
  };

  async function runTurn() {
    const gameState = session.gameState;
    if (!gameState || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setTurnError(null);
    setMessage(null);
    try {
      if (!gameState.pendingTurn) {
        const turn = engines.rules.resolveTurn(gameState, nextAction(gameState));
        delete gameState.pendingActionIsCustom;
        gameState.pendingTurn = turn;
        delete gameState.pendingAction;
        save();
        refresh();
      }

      const narration = await engines.llm.narrateTurn(gameState.pendingTurn, gameState.messageHistory);
      // A new game started meanwhile: this turn belongs to the old one.
      if (session.gameState !== gameState) return;

      const turn = gameState.pendingTurn;
      const response = validateRenderableResponse(buildResponse(turn, narration));
      gameState.messageHistory = narration.messages;
      delete gameState.pendingTurn;
      gameState.lastTurn = turn;
      gameState.lastResponse = response;
      appendStory(gameState, turn, response);
      save();
    } catch (error) {
      if (session.gameState !== gameState) return;
      setTurnError(errorText(error));
      setMessage({ tone: 'error', text: `The Game Master failed: ${errorText(error)}` });
    } finally {
      inFlight.current = false;
      setBusy(false);
      refresh();
    }
  }

  function navigate(name, from = routeRef.current.name) {
    visits.current += 1;
    const next = screens[name] ? name : 'game';
    setRoute({ name: next, from: from === next ? 'game' : from, visit: visits.current });
    setMessage(null);
    setTyping(false);
    // Coming back to the room retries a failed narration, as before.
    setTurnError(null);
  }

  const ctx = {
    session,
    message: busy ? BUSY_MESSAGE : message,
    busy,
    turnError,
    navigate,
    /** Back to the screen this one was opened from (the room or the menu). */
    back() {
      navigate(routeRef.current.from === 'room' && session.gameState ? 'room' : 'game');
    },
    notify(tone, text) {
      setMessage(tone ? { tone, text } : null);
    },
    setTyping,
    startNewGame() {
      session.gameState = createInitialGameState();
      save();
      navigate('room');
    },
    /** Take an action (a suggested one, or free text for the Game Master). */
    act(action, { custom = false } = {}) {
      const gameState = session.gameState;
      if (!gameState || inFlight.current) return;
      gameState.pendingAction = action;
      if (custom) gameState.pendingActionIsCustom = true;
      runTurn();
    },
    runTurn,
    retry() {
      setTurnError(null);
      setMessage(null);
      runTurn();
    },
    quit: exit
  };

  const Current = screens[route.name] ?? MenuScreen;
  return h(Current, { key: `${route.name}-${route.visit}`, ctx });
}
