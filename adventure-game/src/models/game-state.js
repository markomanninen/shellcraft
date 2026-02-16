import { GAME_CONFIG } from '../config/game-config.js';

const ACTION_COUNTER_KEYS = [
  'start',
  'move',
  'take',
  'investigate',
  'talk',
  'combat',
  'use',
  'wait',
  'quest',
  'unknown'
];

function createActionCounters() {
  return Object.fromEntries(ACTION_COUNTER_KEYS.map((key) => [key, 0]));
}

function createInitialRoomItems() {
  return Object.fromEntries(
    Object.values(GAME_CONFIG.world.rooms).map((room) => [room.id, [...room.items]])
  );
}

function createInitialQuests() {
  return Object.fromEntries(
    GAME_CONFIG.world.quests.map((quest) => [
      quest.id,
      {
        id: quest.id,
        title: quest.title,
        description: quest.description,
        status: quest.initialStatus,
        progress: 0,
        updatedAtTurn: 0
      }
    ])
  );
}

function createInitialEncounters() {
  return Object.fromEntries(
    Object.values(GAME_CONFIG.world.encounters).map((encounter) => [
      encounter.id,
      {
        id: encounter.id,
        roomId: encounter.roomId,
        name: encounter.name,
        maxHp: encounter.maxHp,
        currentHp: encounter.maxHp,
        defeated: false,
        lastOutcome: null
      }
    ])
  );
}

function createInitialFactions() {
  return Object.fromEntries(
    GAME_CONFIG.systems.factions.map((id) => [id, 0])
  );
}

function createInitialNpcs() {
  return Object.fromEntries(
    Object.values(GAME_CONFIG.world.npcs).map((npc) => [
      npc.id,
      {
        id: npc.id,
        name: npc.name,
        roomId: npc.roomId,
        faction: npc.faction,
        trust: 0,
        memory: []
      }
    ])
  );
}

function createInitialSkills() {
  return Object.fromEntries(
    GAME_CONFIG.systems.skills.map((skill) => [skill, GAME_CONFIG.systems.initialSkillScore])
  );
}

export function createInitialGameState() {
  return {
    currentRoom: GAME_CONFIG.gameplay.initialRoomId,
    inventory: [],
    visitedRooms: new Set([GAME_CONFIG.gameplay.initialRoomId]),
    moves: 0,
    messageHistory: [],
    isFirstTurn: true,
    player: {
      health: GAME_CONFIG.systems.player.initialHealth,
      maxHealth: GAME_CONFIG.systems.player.maxHealth,
      skills: createInitialSkills()
    },
    worldState: {
      roomItems: createInitialRoomItems(),
      quests: createInitialQuests(),
      encounters: createInitialEncounters(),
      factions: createInitialFactions(),
      npcs: createInitialNpcs(),
      time: {
        turn: 0,
        phase: GAME_CONFIG.gameplay.timePhases[0]
      },
      director: {
        style: GAME_CONFIG.systems.defaultDirectorStyle,
        tension: GAME_CONFIG.systems.pacing.initialTension,
        lastBeat: GAME_CONFIG.systems.pacing.beats[0]
      },
      metrics: {
        actionCounts: createActionCounters(),
        checks: {
          passed: 0,
          failed: 0,
          partial: 0
        },
        reputationChanges: 0,
        questCompletions: 0,
        inventoryPeak: 0,
        combatVictories: 0,
        damageDealt: 0,
        damageTaken: 0
      }
    }
  };
}

function normalizeVisitedRooms(value, initialRoomId) {
  if (value instanceof Set) {
    return new Set(value);
  }
  if (Array.isArray(value)) {
    return new Set(value);
  }
  return new Set([initialRoomId]);
}

function normalizeRoomItems(value) {
  const defaults = createInitialRoomItems();
  if (!value || typeof value !== 'object') {
    return defaults;
  }
  const normalized = {};
  for (const roomId of Object.keys(defaults)) {
    normalized[roomId] = Array.isArray(value[roomId]) ? [...value[roomId]] : [...defaults[roomId]];
  }
  return normalized;
}

function normalizeQuests(value) {
  const defaults = createInitialQuests();
  if (!value || typeof value !== 'object') {
    return defaults;
  }
  const normalized = {};
  for (const quest of GAME_CONFIG.world.quests) {
    const existing = value[quest.id] ?? {};
    normalized[quest.id] = {
      ...defaults[quest.id],
      ...existing,
      id: quest.id,
      title: quest.title,
      description: quest.description
    };
  }
  return normalized;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeFactions(value) {
  const defaults = createInitialFactions();
  if (!value || typeof value !== 'object') {
    return defaults;
  }
  const { min, max } = GAME_CONFIG.systems.factionBounds;
  const normalized = {};
  for (const factionId of GAME_CONFIG.systems.factions) {
    const raw = Number(value[factionId]);
    normalized[factionId] = Number.isFinite(raw) ? clamp(raw, min, max) : defaults[factionId];
  }
  return normalized;
}

function normalizeEncounters(value) {
  const defaults = createInitialEncounters();
  if (!value || typeof value !== 'object') {
    return defaults;
  }

  const normalized = {};
  for (const encounterId of Object.keys(defaults)) {
    const existing = value[encounterId] ?? {};
    const maxHp = Number.isFinite(existing.maxHp) ? existing.maxHp : defaults[encounterId].maxHp;
    const currentHp = Number.isFinite(existing.currentHp) ? existing.currentHp : maxHp;
    normalized[encounterId] = {
      ...defaults[encounterId],
      ...existing,
      maxHp,
      currentHp: clamp(currentHp, 0, maxHp),
      defeated: Boolean(existing.defeated)
    };
  }

  return normalized;
}

function normalizeNpcs(value) {
  const defaults = createInitialNpcs();
  if (!value || typeof value !== 'object') {
    return defaults;
  }
  const normalized = {};
  for (const npcId of Object.keys(defaults)) {
    const existing = value[npcId] ?? {};
    normalized[npcId] = {
      ...defaults[npcId],
      ...existing,
      memory: Array.isArray(existing.memory) ? [...existing.memory] : []
    };
  }
  return normalized;
}

function normalizeMetrics(value) {
  const defaults = {
    actionCounts: createActionCounters(),
    checks: {
      passed: 0,
      failed: 0,
      partial: 0
    },
    reputationChanges: 0,
    questCompletions: 0,
    inventoryPeak: 0,
    combatVictories: 0,
    damageDealt: 0,
    damageTaken: 0
  };

  if (!value || typeof value !== 'object') {
    return defaults;
  }

  const counters = {};
  for (const key of ACTION_COUNTER_KEYS) {
    counters[key] = Number.isFinite(value.actionCounts?.[key]) ? value.actionCounts[key] : 0;
  }

  return {
    actionCounts: counters,
    checks: {
      passed: Number.isFinite(value.checks?.passed) ? value.checks.passed : 0,
      failed: Number.isFinite(value.checks?.failed) ? value.checks.failed : 0,
      partial: Number.isFinite(value.checks?.partial) ? value.checks.partial : 0
    },
    reputationChanges: Number.isFinite(value.reputationChanges) ? value.reputationChanges : 0,
    questCompletions: Number.isFinite(value.questCompletions) ? value.questCompletions : 0,
    inventoryPeak: Number.isFinite(value.inventoryPeak) ? value.inventoryPeak : 0,
    combatVictories: Number.isFinite(value.combatVictories) ? value.combatVictories : 0,
    damageDealt: Number.isFinite(value.damageDealt) ? value.damageDealt : 0,
    damageTaken: Number.isFinite(value.damageTaken) ? value.damageTaken : 0
  };
}

function normalizeTime(value) {
  const phases = GAME_CONFIG.gameplay.timePhases;
  if (!value || typeof value !== 'object') {
    return { turn: 0, phase: phases[0] };
  }
  const turn = Number.isFinite(value.turn) ? value.turn : 0;
  const phase = phases.includes(value.phase) ? value.phase : phases[0];
  return { turn, phase };
}

function normalizeDirector(value) {
  const defaults = {
    style: GAME_CONFIG.systems.defaultDirectorStyle,
    tension: GAME_CONFIG.systems.pacing.initialTension,
    lastBeat: GAME_CONFIG.systems.pacing.beats[0]
  };
  if (!value || typeof value !== 'object') {
    return defaults;
  }
  const tension = Number.isFinite(value.tension)
    ? clamp(value.tension, GAME_CONFIG.systems.pacing.minTension, GAME_CONFIG.systems.pacing.maxTension)
    : defaults.tension;
  return {
    style: GAME_CONFIG.systems.directorStyles.includes(value.style)
      ? value.style
      : defaults.style,
    tension,
    lastBeat: GAME_CONFIG.systems.pacing.beats.includes(value.lastBeat)
      ? value.lastBeat
      : defaults.lastBeat
  };
}

function normalizeSkills(value) {
  const defaults = createInitialSkills();
  if (!value || typeof value !== 'object') {
    return defaults;
  }
  const normalized = {};
  for (const skill of GAME_CONFIG.systems.skills) {
    const score = Number(value[skill]);
    normalized[skill] = Number.isFinite(score) ? clamp(Math.round(score), 0, 10) : defaults[skill];
  }
  return normalized;
}

function normalizePlayer(value) {
  const playerConfig = GAME_CONFIG.systems.player;
  const healthRaw = Number(value?.health);
  const maxHealthRaw = Number(value?.maxHealth);
  const maxHealth = Number.isFinite(maxHealthRaw)
    ? clamp(Math.round(maxHealthRaw), playerConfig.minHealth, playerConfig.maxHealth)
    : playerConfig.maxHealth;
  const health = Number.isFinite(healthRaw)
    ? clamp(Math.round(healthRaw), playerConfig.minHealth, maxHealth)
    : playerConfig.initialHealth;

  return {
    health,
    maxHealth,
    skills: normalizeSkills(value?.skills)
  };
}

export function normalizeGameState(gameState) {
  if (!gameState || typeof gameState !== 'object') {
    return createInitialGameState();
  }

  const initial = createInitialGameState();
  const mergedWorldState = gameState.worldState ?? {};

  return {
    ...initial,
    ...gameState,
    currentRoom: gameState.currentRoom || initial.currentRoom,
    inventory: Array.isArray(gameState.inventory) ? [...gameState.inventory] : [],
    visitedRooms: normalizeVisitedRooms(gameState.visitedRooms, initial.currentRoom),
    moves: Number.isFinite(gameState.moves) ? gameState.moves : 0,
    messageHistory: Array.isArray(gameState.messageHistory) ? [...gameState.messageHistory] : [],
    isFirstTurn: Boolean(gameState.isFirstTurn),
    player: normalizePlayer(gameState.player),
    worldState: {
      roomItems: normalizeRoomItems(mergedWorldState.roomItems),
      quests: normalizeQuests(mergedWorldState.quests),
      encounters: normalizeEncounters(mergedWorldState.encounters),
      factions: normalizeFactions(mergedWorldState.factions),
      npcs: normalizeNpcs(mergedWorldState.npcs),
      time: normalizeTime(mergedWorldState.time),
      director: normalizeDirector(mergedWorldState.director),
      metrics: normalizeMetrics(mergedWorldState.metrics)
    }
  };
}
