import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { GameModel } from '../../src/models/game.js';

describe('GameModel', () => {
  it('should return all rooms', () => {
    const model = new GameModel();
    const rooms = model.getAllRooms();
    assert.ok(Array.isArray(rooms), 'Should return an array');
    assert.ok(rooms.length > 0, 'Should have rooms');
  });

  it('should return a room by id', () => {
    const model = new GameModel();
    const room = model.getRoom('start');
    assert.ok(room, 'Should find start room');
    assert.strictEqual(room.id, 'start');
    assert.strictEqual(room.name, 'Village Square');
  });

  it('should return undefined for non-existent room', () => {
    const model = new GameModel();
    const room = model.getRoom('non-existent');
    assert.strictEqual(room, undefined);
  });

  it('should have required room fields', () => {
    const model = new GameModel();
    const rooms = model.getAllRooms();
    rooms.forEach(room => {
      assert.ok(room.id, 'Room should have id');
      assert.ok(room.name, 'Room should have name');
      assert.ok(room.description, 'Room should have description');
      assert.ok(room.exits, 'Room should have exits');
      assert.ok(room.items, 'Room should have items');
    });
  });

  it('should have valid room connections', () => {
    const model = new GameModel();
    const rooms = model.getAllRooms();
    rooms.forEach(room => {
      Object.values(room.exits).forEach(exitId => {
        const targetRoom = model.getRoom(exitId);
        assert.ok(targetRoom, `Exit ${exitId} from ${room.id} should be valid`);
      });
    });
  });

  it('should generate world seed text with all rooms', () => {
    const model = new GameModel();
    const seedText = model.getWorldSeedText();
    assert.ok(seedText.includes('Village Square'), 'Seed should include Village Square');
    assert.ok(seedText.includes('Dark Forest'), 'Seed should include Dark Forest');
    assert.ok(seedText.includes('Mysterious Cave'), 'Seed should include Cave');
    assert.ok(seedText.includes('Treasure Chamber'), 'Seed should include Treasure');
  });

  it('should include items and exits in world seed text', () => {
    const model = new GameModel();
    const seedText = model.getWorldSeedText();
    assert.ok(seedText.includes('torch'), 'Seed should mention torch');
    assert.ok(seedText.includes('sword'), 'Seed should mention sword');
    assert.ok(seedText.includes('north'), 'Seed should mention directions');
  });
});

describe('Game State Management', () => {
  it('should initialize game state with LLM fields', () => {
    const gameState = {
      currentRoom: 'start',
      inventory: [],
      visitedRooms: new Set(['start']),
      moves: 0,
      messageHistory: [],
      llmEnabled: true,
      isFirstTurn: true
    };

    assert.strictEqual(gameState.llmEnabled, true);
    assert.strictEqual(gameState.isFirstTurn, true);
    assert.deepStrictEqual(gameState.messageHistory, []);
    assert.deepStrictEqual(gameState.inventory, []);
  });

  it('should add items to inventory without duplicates', () => {
    const gameState = { inventory: ['torch'] };
    const update = { add: ['sword', 'torch', 'map'], remove: [] };

    if (update.add) {
      update.add.forEach(item => {
        if (!gameState.inventory.includes(item)) {
          gameState.inventory.push(item);
        }
      });
    }

    assert.deepStrictEqual(gameState.inventory, ['torch', 'sword', 'map']);
    assert.strictEqual(gameState.inventory.length, 3, 'Should not have duplicate torch');
  });

  it('should remove items from inventory', () => {
    const gameState = { inventory: ['torch', 'sword', 'map'] };
    const update = { add: [], remove: ['torch'] };

    if (update.remove) {
      gameState.inventory = gameState.inventory.filter(
        item => !update.remove.includes(item)
      );
    }

    assert.deepStrictEqual(gameState.inventory, ['sword', 'map']);
    assert.ok(!gameState.inventory.includes('torch'), 'Torch should be removed');
  });

  it('should handle add and remove in same update', () => {
    const gameState = { inventory: ['torch', 'rope'] };
    const update = { add: ['golden key'], remove: ['torch'] };

    if (update.add) {
      update.add.forEach(item => {
        if (!gameState.inventory.includes(item)) {
          gameState.inventory.push(item);
        }
      });
    }
    if (update.remove) {
      gameState.inventory = gameState.inventory.filter(
        item => !update.remove.includes(item)
      );
    }

    assert.deepStrictEqual(gameState.inventory, ['rope', 'golden key']);
  });

  it('should handle empty inventory updates', () => {
    const gameState = { inventory: ['torch'] };
    const update = { add: [], remove: [] };

    if (update.add) {
      update.add.forEach(item => {
        if (!gameState.inventory.includes(item)) {
          gameState.inventory.push(item);
        }
      });
    }
    if (update.remove) {
      gameState.inventory = gameState.inventory.filter(
        item => !update.remove.includes(item)
      );
    }

    assert.deepStrictEqual(gameState.inventory, ['torch']);
  });

  it('should store pending action for LLM processing', () => {
    const gameState = {
      inventory: [],
      pendingAction: null,
      llmEnabled: true
    };

    // Simulate user selecting an action
    gameState.pendingAction = 'Take the torch from the wall';
    assert.strictEqual(gameState.pendingAction, 'Take the torch from the wall');

    // Simulate user typing free-form text
    gameState.pendingAction = 'Can you describe the paintings on the wall?';
    assert.strictEqual(gameState.pendingAction, 'Can you describe the paintings on the wall?');
  });

  it('should store and consume pending LLM response', () => {
    const gameState = { pendingResponse: null };

    // Simulate LLM response storage
    gameState.pendingResponse = {
      room_name: 'Forest',
      description: 'Trees surround you.',
      items_here: ['mushroom'],
      actions: ['Pick mushroom', 'Go south'],
      inventory_update: { add: [], remove: [] },
      game_over: false,
      message: 'You entered the forest.'
    };

    assert.ok(gameState.pendingResponse, 'Should have pending response');
    assert.strictEqual(gameState.pendingResponse.room_name, 'Forest');

    // Simulate consumption
    const resp = gameState.pendingResponse;
    delete gameState.pendingResponse;
    assert.strictEqual(gameState.pendingResponse, undefined, 'Should be consumed');
    assert.strictEqual(resp.room_name, 'Forest', 'Response data should be preserved');
  });

  it('should track moves counter', () => {
    const gameState = { moves: 0 };
    gameState.moves++;
    gameState.moves++;
    gameState.moves++;
    assert.strictEqual(gameState.moves, 3);
  });

  it('should handle game over via pending response', () => {
    const gameState = { pendingResponse: null };

    gameState.pendingResponse = {
      room_name: 'Treasure Chamber',
      description: 'You found the treasure!',
      items_here: [],
      actions: [],
      inventory_update: { add: ['gold'], remove: [] },
      game_over: true,
      message: 'Victory!'
    };
    gameState.pendingResponse._gameOver = true;

    assert.ok(gameState.pendingResponse._gameOver, 'Should flag game over');
    assert.ok(gameState.pendingResponse.game_over, 'LLM response should indicate game over');
  });
});
