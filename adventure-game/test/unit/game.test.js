import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { GameModel } from '../../src/models/game.js';
import { createInitialGameState, normalizeGameState } from '../../src/models/game-state.js';
import { GAME_CONFIG } from '../../src/config/game-config.js';

describe('GameModel', () => {
  it('returns all configured rooms', () => {
    const model = new GameModel();
    const rooms = model.getAllRooms();
    assert.ok(Array.isArray(rooms));
    assert.strictEqual(rooms.length, Object.keys(GAME_CONFIG.world.rooms).length);
  });

  it('returns room by id', () => {
    const model = new GameModel();
    const room = model.getRoom('start');
    assert.ok(room);
    assert.strictEqual(room.name, 'Village Square');
  });

  it('has valid room connections', () => {
    const model = new GameModel();
    for (const room of model.getAllRooms()) {
      for (const exitId of Object.values(room.exits)) {
        assert.ok(model.getRoom(exitId), `Invalid exit "${exitId}" from room "${room.id}"`);
      }
    }
  });
});

describe('GameState factory', () => {
  it('creates initial game state with advanced systems', () => {
    const state = createInitialGameState();
    assert.strictEqual(state.currentRoom, GAME_CONFIG.gameplay.initialRoomId);
    assert.ok(state.visitedRooms.has(GAME_CONFIG.gameplay.initialRoomId));
    assert.strictEqual(state.player.health, GAME_CONFIG.systems.player.initialHealth);
    assert.strictEqual(state.player.maxHealth, GAME_CONFIG.systems.player.maxHealth);
    assert.ok(state.player.skills.combat >= 0);
    assert.ok(state.worldState.quests.prove_worth);
    assert.ok(state.worldState.quests.recover_amulet);
    assert.ok(state.worldState.encounters.temple_guardian);
    assert.ok(state.worldState.factions.villagers === 0);
    assert.ok(state.worldState.npcs.village_elder);
    assert.strictEqual(state.worldState.director.style, GAME_CONFIG.systems.defaultDirectorStyle);
  });

  it('normalizes persisted state into current runtime schema', () => {
    const snapshot = {
      currentRoom: 'forest',
      visitedRooms: ['start', 'forest'],
      inventory: ['map'],
      moves: 5,
      messageHistory: []
    };

    const normalized = normalizeGameState(snapshot);
    assert.ok(normalized.visitedRooms instanceof Set);
    assert.ok(normalized.visitedRooms.has('forest'));
    assert.ok(normalized.worldState.quests.claim_treasure);
    assert.ok(normalized.worldState.encounters.treasure_sentinel);
    assert.ok(normalized.worldState.metrics.actionCounts.move >= 0);
    assert.ok(Number.isFinite(normalized.player.health));
  });

  it('normalizes missing state to initial values', () => {
    const normalized = normalizeGameState(null);
    assert.strictEqual(normalized.currentRoom, GAME_CONFIG.gameplay.initialRoomId);
    assert.strictEqual(normalized.moves, 0);
    assert.strictEqual(normalized.messageHistory.length, 0);
  });
});
