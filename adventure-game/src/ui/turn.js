// Turn logic shared by the app (which runs turns) and the screens (which
// show them). No React here: rules → narration → response, and the story
// the room screen shows. Moved out of the blessed room screen; room.js
// re-exports the helpers its tests import.
import { GAME_CONFIG } from '../config/game-config.js';

export function validateRenderableResponse(response) {
  if (!response || typeof response !== 'object') {
    throw new Error('[room] Invalid cached response: expected object');
  }

  if (!Array.isArray(response.items_here) || !Array.isArray(response.actions)) {
    throw new Error('[room] Invalid cached response: "items_here" and "actions" must be arrays');
  }

  if (typeof response.room_name !== 'string' || typeof response.description !== 'string') {
    throw new Error('[room] Invalid cached response: missing room metadata');
  }

  if (response.actions.length === 0) {
    throw new Error('[room] Invalid cached response: "actions" must not be empty');
  }

  if (typeof response.message !== 'string') {
    throw new Error('[room] Invalid cached response: "message" must be a string');
  }

  if (!response.director || typeof response.director !== 'object') {
    throw new Error('[room] Invalid cached response: missing "director"');
  }

  if (typeof response.director.style !== 'string' || typeof response.director.lastBeat !== 'string') {
    throw new Error('[room] Invalid cached response: invalid "director" payload');
  }

  if (!Number.isFinite(response.director.tension)) {
    throw new Error('[room] Invalid cached response: "director.tension" must be numeric');
  }

  if (typeof response.phase !== 'string' || !GAME_CONFIG.gameplay.timePhases.includes(response.phase)) {
    throw new Error('[room] Invalid cached response: invalid "phase"');
  }

  if (!response.player || typeof response.player !== 'object') {
    throw new Error('[room] Invalid cached response: missing "player"');
  }

  if (!Number.isFinite(response.player.health) || !Number.isFinite(response.player.maxHealth)) {
    throw new Error('[room] Invalid cached response: invalid "player" payload');
  }

  if (response.active_encounter !== null && response.active_encounter !== undefined) {
    if (typeof response.active_encounter !== 'object') {
      throw new Error('[room] Invalid cached response: "active_encounter" must be object or null');
    }
    if (
      typeof response.active_encounter.name !== 'string' ||
      !Number.isFinite(response.active_encounter.currentHp) ||
      !Number.isFinite(response.active_encounter.maxHp)
    ) {
      throw new Error('[room] Invalid cached response: invalid "active_encounter" payload');
    }
  }

  return response;
}

export function buildMeterBar(value, max, width = 18) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0 || width < 1) {
    throw new Error('[room] Invalid meter values');
  }

  const clamped = Math.min(Math.max(value, 0), max);
  const filled = Math.round((clamped / max) * width);
  return `${'='.repeat(filled)}${'-'.repeat(width - filled)}`;
}

export function classifyAction(action) {
  if (typeof action !== 'string' || !action.trim()) {
    return 'ACTION';
  }

  const text = action.toLowerCase();
  if (text.includes('back to menu')) return 'SYSTEM';
  if (text.includes('game master')) return 'CUSTOM';

  if (/(^go\b|north|south|east|west|travel|retreat|enter|leave|return)/.test(text)) return 'MOVE';
  if (/(attack|strike|fight|combat|defend|slay|guardian|sentinel|wolf)/.test(text)) return 'COMBAT';
  if (/(talk|speak|ask|persuade|negotiate|elder|ranger|keeper)/.test(text)) return 'SOCIAL';
  if (/(look|investigate|inspect|search|examine|scout|read)/.test(text)) return 'LOOK';
  if (/(take|pick|grab|loot|collect|recover|claim|use)/.test(text)) return 'USE';

  return 'ACTION';
}

function normalizeMessage(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
}

function canonicalMessage(value) {
  return normalizeMessage(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

export function combineOutcomeMessage(deterministicMessage, narrationMessage) {
  const deterministic = normalizeMessage(deterministicMessage);
  const narration = normalizeMessage(narrationMessage);

  if (!deterministic) return narration;
  if (!narration) return deterministic;

  const deterministicCanonical = canonicalMessage(deterministic);
  const narrationCanonical = canonicalMessage(narration);

  // Exact match
  if (deterministicCanonical === narrationCanonical) {
    return deterministic;
  }

  // Cross inclusion
  if (narrationCanonical.includes(deterministicCanonical)) {
    return narration;
  }

  if (deterministicCanonical.includes(narrationCanonical)) {
    return deterministic;
  }

  // Fuzzy match: check if they are "close enough" (e.g., share > 70% of words)
  // This helps when LLM rephrases slightly but keeps the meaning, preventing "You took the sword. You pick up the sword."
  const detWords = new Set(deterministicCanonical.split(' '));
  const narWords = new Set(narrationCanonical.split(' '));
  let intersection = 0;
  for (const word of detWords) {
    if (narWords.has(word)) intersection++;
  }
  const overlap = intersection / Math.min(detWords.size, narWords.size);

  if (overlap > 0.6) {
    // If significant overlap, prefer narration as it's likely more flavorful
    return narration;
  }

  return `${deterministic} ${narration}`.trim();
}

/**
 * Whether the room has to run a turn before it can show the game: the
 * first turn, an action waiting for the rules, a resolved turn waiting for
 * its narration (also after a crash or a failed narration), or no
 * narrated turn at all.
 */
export function needsTurn(gameState) {
  if (!gameState) return false;
  return Boolean(
    gameState.pendingTurn ||
    gameState.pendingAction ||
    gameState.isFirstTurn ||
    !gameState.lastResponse
  );
}

/** The action the rules engine resolves next (as before the port). */
export function nextAction(gameState) {
  return gameState.isFirstTurn
    ? '__start__'
    : (gameState.pendingAction || GAME_CONFIG.gameplay.genericActions[0]);
}

/**
 * The room response the screens render, from a resolved turn and its
 * narration. With the game state, the response also keeps the inventory
 * and objective after the turn, so the Status panel does not run ahead
 * of the story while the next turn is being narrated.
 */
export function buildResponse(turn, narration, gameState = null) {
  return {
    ...(gameState
      ? { inventory: [...gameState.inventory], objective: objectiveText(gameState) }
      : {}),
    room_name: turn.room.name,
    description: narration.response.description,
    items_here: turn.itemsHere,
    actions: turn.actions,
    message: combineOutcomeMessage(turn.outcome.message, narration.response.message),
    game_over: turn.gameOver,
    director: turn.director,
    phase: turn.phase,
    player: turn.player,
    active_encounter: turn.activeEncounter,
    action_outcome: turn.outcome.status,
    deterministic_message: turn.outcome.message
  };
}

// The story keeps the last turns for the narrative and the journal; it is
// saved with the game state (session persistence stores the whole object).
export const STORY_LIMIT = 50;

export function appendStory(gameState, turn, response) {
  const entry = {
    turn: turn.turn,
    action: turn.action.type === 'start' ? null : String(turn.action.raw ?? ''),
    roomId: turn.room.id,
    roomName: turn.room.name,
    description: response.description,
    message: response.message,
    status: response.action_outcome
  };
  const story = Array.isArray(gameState.story) ? gameState.story : [];
  gameState.story = [...story, entry].slice(-STORY_LIMIT);
  return entry;
}

/**
 * The story to show. Games saved before the story existed get one entry
 * from their last response.
 */
export function storyOf(gameState) {
  if (!gameState) return [];
  if (Array.isArray(gameState.story) && gameState.story.length > 0) return gameState.story;
  const last = gameState.lastResponse;
  if (!last || typeof last.description !== 'string') return [];
  return [{
    turn: gameState.moves,
    action: null,
    roomId: gameState.currentRoom,
    roomName: last.room_name,
    description: last.description,
    message: last.message,
    status: last.action_outcome
  }];
}

const OUTCOMES = Object.freeze({
  success: Object.freeze({ glyph: '✓', tone: 'success' }),
  partial: Object.freeze({ glyph: '!', tone: 'warning' }),
  fail: Object.freeze({ glyph: '✗', tone: 'danger' })
});

export const outcomeStyle = (status) => OUTCOMES[status] ?? OUTCOMES.success;

/**
 * ScrollView lines for the narrative: per turn the player's action
 * (muted, `› `), the narration, a blank line and the outcome in its tone.
 * Action and outcome lines wrap under their text (hangingIndent 2).
 */
export function narrativeLines(story) {
  const lines = [];
  story.forEach((entry, i) => {
    if (i > 0) lines.push('');
    if (entry.action) lines.push({ text: `› ${entry.action}`, tone: 'muted', hangingIndent: 2 });
    if (entry.description) lines.push(entry.description);
    if (entry.message) {
      const { glyph, tone } = outcomeStyle(entry.status);
      if (entry.description) lines.push('');
      lines.push({ text: `${glyph} ${entry.message}`, tone, hangingIndent: 2 });
    }
  });
  return lines;
}

/**
 * Journal entries: `T3  Go north`, and `T3  Arrived at Dark Forest` when
 * the turn ended in another room (the first turn too).
 */
export function journalEntries(story) {
  const entries = [];
  let room = null;
  for (const entry of story) {
    const prefix = `T${entry.turn}`;
    if (entry.action) entries.push({ prefix, text: entry.action, status: entry.status });
    if (entry.roomId !== room) entries.push({ prefix, text: `Arrived at ${entry.roomName}` });
    room = entry.roomId;
  }
  return entries;
}

/** HP meter tone by the share left: default, warning at half, danger at a quarter. */
export function healthTone(health, maxHealth) {
  const ratio = maxHealth > 0 ? health / maxHealth : 0;
  if (ratio > 0.5) return 'default';
  if (ratio > 0.25) return 'warning';
  return 'danger';
}

/** Tension is drawn in warning; danger from three quarters up. */
export function tensionTone(tension, maxTension = GAME_CONFIG.systems.pacing.maxTension) {
  return tension >= maxTension * 0.75 ? 'danger' : 'warning';
}

export function activeQuest(gameState) {
  return Object.values(gameState?.worldState?.quests ?? {}).find((quest) => quest.status === 'active') ?? null;
}

export function objectiveText(gameState) {
  const quest = activeQuest(gameState);
  return quest ? `${quest.title} ${Math.round(quest.progress)}%` : null;
}

/**
 * The room's numbers: the last narrated response (so a turn waiting for
 * its narration does not show its result early), else the game state.
 */
export function roomStatus(gameState) {
  const response = gameState?.lastResponse;
  const room = GAME_CONFIG.world.rooms[gameState.currentRoom];
  if (response) {
    return {
      roomName: response.room_name,
      player: response.player,
      director: response.director,
      encounter: response.active_encounter ?? null,
      itemsHere: response.items_here,
      phase: response.phase,
      // Responses saved before the port have no snapshot: live values.
      inventory: Array.isArray(response.inventory) ? response.inventory : gameState.inventory,
      objective: 'objective' in response ? response.objective : objectiveText(gameState)
    };
  }
  const encounter = Object.values(gameState.worldState.encounters)
    .find((e) => e.roomId === gameState.currentRoom && !e.defeated) ?? null;
  return {
    roomName: room?.name ?? gameState.currentRoom,
    player: gameState.player,
    director: gameState.worldState.director,
    encounter,
    itemsHere: gameState.worldState.roomItems[gameState.currentRoom] ?? [],
    phase: gameState.worldState.time.phase,
    inventory: gameState.inventory,
    objective: objectiveText(gameState)
  };
}
