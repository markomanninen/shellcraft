import { GAME_CONFIG } from '../config/game-config.js';
import { GameModel } from './game.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeToken(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function includesToken(haystack, needle) {
  return normalizeToken(haystack).includes(normalizeToken(needle));
}

export class RulesEngine {
  constructor() {
    this.gameModel = new GameModel();
    this.questById = Object.fromEntries(
      GAME_CONFIG.world.quests.map((quest) => [quest.id, quest])
    );
  }

  resolveTurn(gameState, actionText) {
    const parsedAction = this.parseAction(actionText, gameState);
    const outcome = this.applyAction(parsedAction, gameState);
    this.applyInventoryUpdate(gameState, outcome.inventoryUpdate);

    gameState.moves += 1;
    gameState.worldState.time.turn += 1;
    gameState.worldState.time.phase = this.getTimePhase(gameState.worldState.time.turn);

    this.updateQuestProgress(gameState, parsedAction, outcome);
    this.updateDirector(gameState, parsedAction, outcome);
    this.updateMetrics(gameState, parsedAction, outcome);

    const room = this.requireRoom(gameState.currentRoom);
    const activeEncounter = this.getActiveEncounter(gameState, room.id);
    const actions = this.getAvailableActions(gameState);

    return {
      action: parsedAction,
      outcome,
      room: {
        id: room.id,
        name: room.name,
        description: room.description
      },
      itemsHere: [...this.getRoomItems(gameState, room.id)],
      actions,
      director: { ...gameState.worldState.director },
      gameOver: outcome.gameOver,
      turn: gameState.worldState.time.turn,
      phase: gameState.worldState.time.phase,
      player: {
        health: gameState.player.health,
        maxHealth: gameState.player.maxHealth
      },
      activeEncounter: activeEncounter
        ? {
            id: activeEncounter.id,
            name: activeEncounter.name,
            currentHp: activeEncounter.currentHp,
            maxHp: activeEncounter.maxHp
          }
        : null
    };
  }

  parseAction(actionText, gameState) {
    if (gameState.isFirstTurn) {
      return { type: 'start', raw: '__start__' };
    }

    // CRITICAL: Check for explicit custom action flag set by UI FIRST
    // This allows exact strings like "who is temple keeper" to bypass standard rule parsing
    // and go straight to the narrative engine (handleCustom -> LLM).
    if (gameState.pendingActionIsCustom) {
      return { type: 'custom', raw: String(actionText ?? '') };
    }

    const raw = String(actionText ?? '').trim();
    const normalized = normalizeToken(raw);

    if (!normalized) {
      return { type: 'unknown', raw };
    }

    if (normalized === 'claim the treasure' || normalized === 'claim treasure') {
      return { type: 'quest', raw, target: 'claim_treasure' };
    }

    if (normalized.startsWith('go ')) {
      return { type: 'move', raw, direction: normalized.split(' ')[1] };
    }

    if (/^(take|pick up|pickup|grab)\b/.test(normalized)) {
      const item = normalized
        .replace(/^(take|pick up|pickup|grab)\b/, '')
        .replace(/^the\s+/, '')
        .trim();
      return { type: 'take', raw, item };
    }

    if (/^(attack|fight|strike|engage)\b/.test(normalized)) {
      return { type: 'combat', raw, mode: 'attack' };
    }

    if (/^(defend|brace|guard|block)\b/.test(normalized)) {
      return { type: 'combat', raw, mode: 'defend' };
    }

    if (/^(look|investigate|inspect|search|review)\b/.test(normalized)) {
      return { type: 'investigate', raw };
    }

    if (/^(talk|speak|ask)\b/.test(normalized)) {
      return { type: 'talk', raw };
    }

    if (/^(use|offer)\b/.test(normalized)) {
      const item = normalized
        .replace(/^(use|offer)\b/, '')
        .replace(/^the\s+/, '')
        .trim()
        .split(' ')[0];
      return { type: 'use', raw, item };
    }

    if (/^(wait|rest|pause)\b/.test(normalized)) {
      return { type: 'wait', raw };
    }

    // Detect open-ended questions or custom roleplay actions
    if (
      /^(who|what|where|when|why|how|can|is|are|tell|describe|narrate)\b/.test(normalized) ||
      raw.endsWith('?') ||
      gameState.pendingActionIsCustom // Flag set by UI
    ) {
      return { type: 'custom', raw };
    }

    return { type: 'unknown', raw };
  }

  applyAction(action, gameState) {
    switch (action.type) {
      case 'start':
        return this.handleStart(gameState);
      case 'move':
        return this.handleMove(action, gameState);
      case 'take':
        return this.handleTake(action, gameState);
      case 'combat':
        return this.handleCombat(action, gameState);
      case 'investigate':
        return this.handleInvestigate(action, gameState);
      case 'talk':
        return this.handleTalk(action, gameState);
      case 'use':
        return this.handleUse(action, gameState);
      case 'wait':
        return this.handleWait();
      case 'quest':
        return this.handleQuestAction(action, gameState);
      case 'custom':
        return this.handleCustom(action, gameState);
      default:
        return this.handleUnknown(action, gameState);
    }
  }

  handleStart(gameState) {
    gameState.isFirstTurn = false;
    return {
      status: 'success',
      message: 'Your journey begins. Seek the Village Elder to earn passage toward the temple.',
      check: null,
      inventoryUpdate: { add: [], remove: [] },
      gameOver: false
    };
  }

  handleMove(action, gameState) {
    const room = this.requireRoom(gameState.currentRoom);
    const nextRoomId = room.exits[action.direction];
    if (!nextRoomId) {
      return {
        status: 'fail',
        message: `No path leads ${action.direction} from here.`,
        check: null,
        inventoryUpdate: { add: [], remove: [] },
        gameOver: false
      };
    }

    gameState.currentRoom = nextRoomId;
    gameState.visitedRooms.add(nextRoomId);

    const encounter = this.getActiveEncounter(gameState, nextRoomId);
    const message = encounter
      ? `You move ${action.direction} and confront ${encounter.name}.`
      : `You move ${action.direction} and enter a new area.`;

    return {
      status: 'success',
      message,
      check: null,
      inventoryUpdate: { add: [], remove: [] },
      gameOver: false
    };
  }

  handleTake(action, gameState) {
    const roomId = gameState.currentRoom;
    const roomItems = this.getRoomItems(gameState, roomId);
    const targetItem = this.resolveItemTarget(roomItems, action.item);

    if (!targetItem) {
      return {
        status: 'fail',
        message: 'That item is not available here.',
        check: null,
        inventoryUpdate: { add: [], remove: [] },
        gameOver: false
      };
    }

    if (targetItem === 'amulet') {
      const recoverQuest = gameState.worldState.quests.recover_amulet;
      if (recoverQuest.status !== 'active') {
        return {
          status: 'fail',
          message: 'You are not yet sanctioned to recover the amulet.',
          check: null,
          inventoryUpdate: { add: [], remove: [] },
          gameOver: false
        };
      }
      if (!gameState.inventory.includes('elder_seal')) {
        return {
          status: 'fail',
          message: 'The temple wards reject you. You need the Elder Seal.',
          check: null,
          inventoryUpdate: { add: [], remove: [] },
          gameOver: false
        };
      }
      if (!this.isEncounterDefeated(gameState, 'temple_guardian')) {
        return {
          status: 'fail',
          message: 'The Runic Guardian still bars your path to the amulet.',
          check: null,
          inventoryUpdate: { add: [], remove: [] },
          gameOver: false
        };
      }
    }

    const check = this.runSkillCheck(
      gameState,
      'perception',
      targetItem === 'amulet'
        ? GAME_CONFIG.systems.skillDifficulty.hard
        : GAME_CONFIG.systems.skillDifficulty.normal,
      `${roomId}:${targetItem}:take`
    );

    if (check.status === 'fail') {
      return {
        status: 'fail',
        message: `You reach for the ${targetItem} but fail to secure it.`,
        check,
        inventoryUpdate: { add: [], remove: [] },
        gameOver: false
      };
    }

    const index = roomItems.indexOf(targetItem);
    if (index >= 0) {
      roomItems.splice(index, 1);
    }

    return {
      status: check.status,
      message: `You secure the ${targetItem} and add it to your inventory.`,
      check,
      inventoryUpdate: { add: [targetItem], remove: [] },
      gameOver: false
    };
  }

  handleCombat(action, gameState) {
    const encounter = this.getActiveEncounter(gameState, gameState.currentRoom);
    if (!encounter) {
      return {
        status: 'fail',
        message: 'There is no immediate threat to fight here.',
        check: null,
        inventoryUpdate: { add: [], remove: [] },
        combat: null,
        gameOver: false
      };
    }

    const encounterConfig = this.getEncounterConfig(encounter.id);
    const skill = action.mode === 'defend' ? 'stealth' : 'combat';
    const difficulty = action.mode === 'defend'
      ? encounterConfig.difficulty - 1
      : encounterConfig.difficulty;
    const check = this.runSkillCheck(
      gameState,
      skill,
      difficulty,
      `${encounter.id}:${action.mode}:${gameState.worldState.time.turn}`
    );

    const playerDamage = this.computeCombatDamage(check.status, action.mode);
    encounter.currentHp = clamp(encounter.currentHp - playerDamage, 0, encounter.maxHp);

    let counterDamage = 0;
    const inventoryAdd = [];
    let message;

    if (encounter.currentHp <= 0) {
      encounter.defeated = true;
      encounter.lastOutcome = 'defeated';
      inventoryAdd.push(...encounterConfig.drops);
      for (const [factionId, delta] of Object.entries(encounterConfig.factionImpact || {})) {
        this.adjustFaction(gameState, factionId, delta);
      }
      message = `You defeat ${encounter.name} and secure the area.`;
    } else {
      counterDamage = this.computeCounterDamage(check.status, action.mode);
      const minHealth = GAME_CONFIG.systems.player.minHealth;
      gameState.player.health = clamp(
        gameState.player.health - counterDamage,
        minHealth,
        gameState.player.maxHealth
      );
      encounter.lastOutcome = check.status;
      const lowHealthNote = gameState.player.health === minHealth
        ? ' You are barely standing.'
        : '';
      message = `You strike ${encounter.name} for ${playerDamage} damage. It remains at ${encounter.currentHp}/${encounter.maxHp} HP and counters for ${counterDamage}.${lowHealthNote}`;
    }

    return {
      status: encounter.defeated ? 'success' : check.status,
      message,
      check,
      inventoryUpdate: { add: inventoryAdd, remove: [] },
      combat: {
        encounterId: encounter.id,
        defeated: encounter.defeated,
        damageToEnemy: playerDamage,
        counterDamage,
        enemyHp: encounter.currentHp,
        enemyMaxHp: encounter.maxHp
      },
      gameOver: false
    };
  }

  handleInvestigate(action, gameState) {
    const check = this.runSkillCheck(
      gameState,
      'lore',
      GAME_CONFIG.systems.skillDifficulty.easy,
      `${gameState.currentRoom}:investigate:${action.raw}`
    );

    const questHint = this.getQuestHint(gameState);
    const encounter = this.getActiveEncounter(gameState, gameState.currentRoom);
    const encounterHint = encounter
      ? ` Threat present: ${encounter.name} (${encounter.currentHp}/${encounter.maxHp} HP).`
      : '';
    const message = check.status === 'fail'
      ? 'You scan the area but fail to uncover anything useful.'
      : `You uncover useful clues. ${questHint}${encounterHint}`;

    return {
      status: check.status,
      message,
      check,
      inventoryUpdate: { add: [], remove: [] },
      gameOver: false
    };
  }

  handleTalk(action, gameState) {
    const npc = this.getNpcInRoom(gameState, gameState.currentRoom, action.raw);
    if (!npc) {
      return {
        status: 'fail',
        message: 'No one here is available to speak with you.',
        check: null,
        inventoryUpdate: { add: [], remove: [] },
        gameOver: false
      };
    }

    const check = this.runSkillCheck(
      gameState,
      'charisma',
      GAME_CONFIG.systems.skillDifficulty.normal,
      `${npc.id}:talk:${action.raw}`
    );

    const trustDelta = check.status === 'success' ? 2 : (check.status === 'partial' ? 1 : -1);
    npc.trust = clamp(npc.trust + trustDelta, -10, 10);
    this.adjustFaction(gameState, npc.faction, trustDelta);
    this.rememberNpcInteraction(
      gameState,
      npc.id,
      `Turn ${gameState.worldState.time.turn + 1}: ${action.raw}`
    );

    const inventoryUpdate = { add: [], remove: [] };
    let message = `${npc.name} shares guidance about the path ahead.`;

    if (npc.id === 'village_elder') {
      const proveWorth = gameState.worldState.quests.prove_worth;
      if (proveWorth?.status === 'active' && check.status !== 'fail') {
        proveWorth.status = 'completed';
        proveWorth.progress = 100;
        proveWorth.updatedAtTurn = gameState.worldState.time.turn + 1;
        if (!gameState.inventory.includes('elder_seal')) {
          inventoryUpdate.add.push('elder_seal');
        }
        this.unlockQuest(gameState, 'recover_amulet');
        message = `${npc.name} grants you the Elder Seal and authorizes your temple expedition.`;
      }
    }

    return {
      status: check.status,
      message,
      check,
      inventoryUpdate,
      gameOver: false
    };
  }

  handleUse(action, gameState) {
    const item = this.resolveItemTarget(gameState.inventory, action.item);
    if (!item) {
      return {
        status: 'fail',
        message: 'You do not have that item available.',
        check: null,
        inventoryUpdate: { add: [], remove: [] },
        gameOver: false
      };
    }

    if (item === 'elder_seal' && gameState.currentRoom === 'temple') {
      return {
        status: 'success',
        message: 'The Elder Seal resonates with temple wards and steadies your resolve.',
        check: null,
        inventoryUpdate: { add: [], remove: [] },
        gameOver: false
      };
    }

    if (item === 'amulet' && gameState.currentRoom === 'treasure') {
      return {
        status: 'partial',
        message: 'The amulet glows near the vault, but the chamber must still be secured.',
        check: null,
        inventoryUpdate: { add: [], remove: [] },
        gameOver: false
      };
    }

    return {
      status: 'partial',
      message: `You use the ${item}, but it creates no immediate breakthrough.`,
      check: null,
      inventoryUpdate: { add: [], remove: [] },
      gameOver: false
    };
  }

  handleWait() {
    return {
      status: 'success',
      message: 'You pause, reassess your surroundings, and steady your focus.',
      check: null,
      inventoryUpdate: { add: [], remove: [] },
      gameOver: false
    };
  }

  handleCustom(action, gameState) {
    // Custom actions are passed to the narrative layer without strict rule enforcement
    // We return 'success' to encourage the LLM to roleplay the outcome
    return {
      status: 'success',
      message: '', // Empty message signals LLM to generate the full response based on action.raw
      check: null,
      inventoryUpdate: { add: [], remove: [] },
      gameOver: false
    };
  }

  handleQuestAction(action, gameState) {
    if (action.target !== 'claim_treasure') {
      return {
        status: 'fail',
        message: 'That objective is not available.',
        check: null,
        inventoryUpdate: { add: [], remove: [] },
        gameOver: false
      };
    }

    const quest = gameState.worldState.quests.claim_treasure;
    const questDef = this.questById.claim_treasure;
    const requirementsMet = (questDef.requiredItems || [])
      .every((item) => gameState.inventory.includes(item));

    if (gameState.currentRoom !== questDef.roomId) {
      return {
        status: 'fail',
        message: 'The treasure can only be claimed in the treasure chamber.',
        check: null,
        inventoryUpdate: { add: [], remove: [] },
        gameOver: false
      };
    }

    if (quest.status !== 'active') {
      return {
        status: 'fail',
        message: 'This quest is not yet active.',
        check: null,
        inventoryUpdate: { add: [], remove: [] },
        gameOver: false
      };
    }

    if (questDef.requiredEncounterDefeated && !this.isEncounterDefeated(gameState, questDef.requiredEncounterDefeated)) {
      return {
        status: 'fail',
        message: 'A sentinel still guards the vault. Defeat it first.',
        check: null,
        inventoryUpdate: { add: [], remove: [] },
        gameOver: false
      };
    }

    if (!requirementsMet) {
      return {
        status: 'fail',
        message: 'You are missing the required relics to claim the treasure.',
        check: null,
        inventoryUpdate: { add: [], remove: [] },
        gameOver: false
      };
    }

    quest.status = 'completed';
    quest.progress = 100;
    quest.updatedAtTurn = gameState.worldState.time.turn + 1;

    return {
      status: 'success',
      message: 'You claim the treasure and complete your quest.',
      check: null,
      inventoryUpdate: { add: ['gold', 'crown', 'jewels'], remove: [] },
      gameOver: true
    };
  }

  handleUnknown(action, gameState) {
    // If it's a question or complex action, let the LLM handle the flavor completely
    // We provide a neutral 'success' so the LLM feels empowered to answer/narrate
    const isQuestion = /^(who|what|where|when|why|how|can|is|are)\b/i.test(action.raw) || action.raw.endsWith('?');
    
    if (isQuestion) {
      return {
        status: 'success',
        message: '', // Empty message signals LLM to generate the full response based on action.raw
        check: null,
        inventoryUpdate: { add: [], remove: [] },
        gameOver: false
      };
    }

    const check = this.runSkillCheck(
      gameState,
      'perception',
      GAME_CONFIG.systems.skillDifficulty.normal,
      `${gameState.currentRoom}:improvise:${action.raw}`
    );

    return {
      status: check.status,
      message: 'You improvise and probe the environment for a useful opening.',
      check,
      inventoryUpdate: { add: [], remove: [] },
      gameOver: false
    };
  }

  runSkillCheck(gameState, skill, difficulty, seed) {
    const roll = this.computeRoll(seed, gameState.worldState.time.turn, gameState.moves);
    const score = gameState.player.skills[skill] ?? GAME_CONFIG.systems.initialSkillScore;
    const total = roll + score;

    if (total >= difficulty + 2) {
      return { skill, roll, total, target: difficulty, status: 'success' };
    }
    if (total >= difficulty) {
      return { skill, roll, total, target: difficulty, status: 'partial' };
    }
    return { skill, roll, total, target: difficulty, status: 'fail' };
  }

  applyInventoryUpdate(gameState, inventoryUpdate) {
    const add = Array.isArray(inventoryUpdate?.add) ? inventoryUpdate.add : [];
    const remove = Array.isArray(inventoryUpdate?.remove) ? inventoryUpdate.remove : [];

    for (const item of add) {
      if (!gameState.inventory.includes(item)) {
        gameState.inventory.push(item);
      }
    }

    if (remove.length > 0) {
      gameState.inventory = gameState.inventory.filter((item) => !remove.includes(item));
    }
  }

  computeRoll(seed, turn, moves) {
    let hash = 17;
    const input = `${seed}:${turn}:${moves}`;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash * 31 + input.charCodeAt(i)) % 1000003;
    }
    return (hash % 20) + 1;
  }

  computeCombatDamage(status, mode) {
    const cfg = GAME_CONFIG.systems.combat;
    let damage = mode === 'defend' ? cfg.defendDamage : cfg.baseDamage;
    if (status === 'partial') damage += 1;
    if (status === 'success') damage += cfg.criticalBonus;
    if (status === 'fail') damage = Math.max(1, damage - 1);
    return damage;
  }

  computeCounterDamage(status, mode) {
    const cfg = GAME_CONFIG.systems.combat;
    let counter = cfg.enemyCounterDamage[status] ?? cfg.enemyCounterDamage.partial;
    if (mode === 'defend') {
      counter = Math.max(1, counter - 1);
    }
    return counter;
  }

  updateQuestProgress(gameState, action, outcome) {
    if (outcome.inventoryUpdate.add.includes('amulet')) {
      const quest = gameState.worldState.quests.recover_amulet;
      if (quest && quest.status !== 'completed') {
        quest.status = 'completed';
        quest.progress = 100;
        quest.updatedAtTurn = gameState.worldState.time.turn;
        this.unlockQuest(gameState, 'claim_treasure');
      }
    }

    if (action.type === 'combat' && outcome.combat?.defeated) {
      if (outcome.combat.encounterId === 'temple_guardian') {
        const recoverQuest = gameState.worldState.quests.recover_amulet;
        if (recoverQuest?.status === 'active') {
          recoverQuest.progress = Math.max(recoverQuest.progress, 70);
        }
      }
      if (outcome.combat.encounterId === 'treasure_sentinel') {
        const claimQuest = gameState.worldState.quests.claim_treasure;
        if (claimQuest?.status === 'active') {
          claimQuest.progress = Math.max(claimQuest.progress, 85);
        }
      }
    }

    if (action.type === 'move' && gameState.currentRoom === 'treasure') {
      const claimQuest = gameState.worldState.quests.claim_treasure;
      if (claimQuest?.status === 'active') {
        claimQuest.progress = Math.max(claimQuest.progress, 60);
      }
    }
  }

  unlockQuest(gameState, questId) {
    const quest = gameState.worldState.quests[questId];
    if (!quest || quest.status !== 'locked') {
      return;
    }
    quest.status = 'active';
    quest.progress = Math.max(quest.progress, 10);
    quest.updatedAtTurn = gameState.worldState.time.turn;
  }

  updateDirector(gameState, action, outcome) {
    const deltaMap = {
      start: 0,
      move: 4,
      take: 3,
      combat: 6,
      investigate: 2,
      talk: -2,
      use: 2,
      wait: -4,
      quest: 8,
      unknown: 1
    };
    const outcomeDelta = outcome.status === 'fail' ? 3 : (outcome.status === 'partial' ? 1 : 0);
    const baseDelta = deltaMap[action.type] ?? 0;
    const director = gameState.worldState.director;
    director.tension = clamp(
      director.tension + baseDelta + outcomeDelta,
      GAME_CONFIG.systems.pacing.minTension,
      GAME_CONFIG.systems.pacing.maxTension
    );
    director.lastBeat = this.selectBeat(director.tension);
    director.style = this.selectDirectorStyle(gameState, director.tension);
  }

  selectBeat(tension) {
    const beats = GAME_CONFIG.systems.pacing.beats;
    if (tension >= 80) return beats[4];
    if (tension >= 60) return beats[2];
    if (tension >= 40) return beats[1];
    if (tension >= 20) return beats[0];
    return beats[3];
  }

  selectDirectorStyle(gameState, tension) {
    const counts = gameState.worldState.metrics.actionCounts;
    if (tension >= 75 || counts.combat > counts.talk) {
      return 'grim';
    }
    if ((counts.investigate + counts.talk) > (counts.move + counts.take + counts.combat)) {
      return 'mystic';
    }
    if (gameState.worldState.metrics.checks.passed > gameState.worldState.metrics.checks.failed) {
      return 'heroic';
    }
    return GAME_CONFIG.systems.defaultDirectorStyle;
  }

  updateMetrics(gameState, action, outcome) {
    const metrics = gameState.worldState.metrics;
    if (Object.prototype.hasOwnProperty.call(metrics.actionCounts, action.type)) {
      metrics.actionCounts[action.type] += 1;
    }
    metrics.inventoryPeak = Math.max(metrics.inventoryPeak, gameState.inventory.length);

    if (outcome.check?.status === 'success') metrics.checks.passed += 1;
    if (outcome.check?.status === 'partial') metrics.checks.partial += 1;
    if (outcome.check?.status === 'fail') metrics.checks.failed += 1;

    if (outcome.status === 'success' && action.type === 'quest') {
      metrics.questCompletions += 1;
    }

    if (outcome.combat) {
      metrics.damageDealt += outcome.combat.damageToEnemy;
      metrics.damageTaken += outcome.combat.counterDamage;
      if (outcome.combat.defeated) {
        metrics.combatVictories += 1;
      }
    }
  }

  adjustFaction(gameState, factionId, delta) {
    const bounds = GAME_CONFIG.systems.factionBounds;
    const next = (gameState.worldState.factions[factionId] ?? 0) + delta;
    gameState.worldState.factions[factionId] = clamp(next, bounds.min, bounds.max);
    gameState.worldState.metrics.reputationChanges += 1;
  }

  rememberNpcInteraction(gameState, npcId, entry) {
    const npc = gameState.worldState.npcs[npcId];
    if (!npc) return;
    npc.memory.push(entry);
    if (npc.memory.length > 8) {
      npc.memory.splice(0, npc.memory.length - 8);
    }
  }

  getQuestHint(gameState) {
    const activeQuest = Object.values(gameState.worldState.quests).find((quest) => quest.status === 'active');
    if (!activeQuest) {
      return 'No active objective remains.';
    }
    return `Active objective: ${activeQuest.title}.`;
  }

  getTimePhase(turn) {
    const phases = GAME_CONFIG.gameplay.timePhases;
    return phases[turn % phases.length];
  }

  getAvailableActions(gameState) {
    const room = this.requireRoom(gameState.currentRoom);
    const roomItems = this.getRoomItems(gameState, room.id);
    const activeEncounter = this.getActiveEncounter(gameState, room.id);
    const actions = [];
    const max = GAME_CONFIG.llm.actionCount.max;
    const min = GAME_CONFIG.llm.actionCount.min;

    const push = (value) => {
      if (!value || actions.includes(value) || actions.length >= max) return;
      actions.push(value);
    };

    for (const direction of Object.keys(room.exits)) {
      push(`Go ${direction}`);
    }

    if (activeEncounter) {
      push(`Attack ${activeEncounter.name}`);
      push(`Defend against ${activeEncounter.name}`);
    }

    for (const item of roomItems.slice(0, 2)) {
      push(`Take ${item}`);
    }

    const npc = this.getNpcInRoom(gameState, room.id);
    if (npc) {
      push(`Talk to ${npc.name}`);
    }

    if (gameState.currentRoom === 'temple' && gameState.inventory.includes('elder_seal')) {
      push('Use elder_seal at altar');
    }

    if (
      gameState.currentRoom === 'treasure' &&
      gameState.worldState.quests.claim_treasure.status === 'active' &&
      !activeEncounter
    ) {
      push('Claim the treasure');
    }

    for (const genericAction of GAME_CONFIG.gameplay.genericActions) {
      push(genericAction);
    }

    while (actions.length < min) {
      push(`Review objective ${actions.length + 1}`);
    }

    return actions;
  }

  getNpcInRoom(gameState, roomId, rawInput = '') {
    const npcs = Object.values(gameState.worldState.npcs).filter((npc) => npc.roomId === roomId);
    if (npcs.length === 0) return null;
    const match = npcs.find((npc) => includesToken(rawInput, npc.name));
    return match || npcs[0];
  }

  resolveItemTarget(items, candidate) {
    if (!candidate) {
      return items.length === 1 ? items[0] : null;
    }
    return items.find((item) => includesToken(item, candidate)) || null;
  }

  getRoomItems(gameState, roomId) {
    if (!Array.isArray(gameState.worldState.roomItems[roomId])) {
      gameState.worldState.roomItems[roomId] = [];
    }
    return gameState.worldState.roomItems[roomId];
  }

  getEncounterConfig(encounterId) {
    const config = GAME_CONFIG.world.encounters[encounterId];
    if (!config) {
      throw new Error(`[rules] Unknown encounter id "${encounterId}"`);
    }
    return config;
  }

  getActiveEncounter(gameState, roomId) {
    return Object.values(gameState.worldState.encounters).find(
      (encounter) => encounter.roomId === roomId && !encounter.defeated
    ) || null;
  }

  isEncounterDefeated(gameState, encounterId) {
    const encounter = gameState.worldState.encounters[encounterId];
    return Boolean(encounter?.defeated);
  }

  requireRoom(roomId) {
    const room = this.gameModel.getRoom(roomId);
    if (!room) {
      throw new Error(`[rules] Unknown room id "${roomId}"`);
    }
    return room;
  }
}
