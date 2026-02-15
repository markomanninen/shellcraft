import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { LLMGameEngine } from '../../src/llm/game-engine.js';

describe('LLMGameEngine', () => {
  describe('parseResponse', () => {
    let engine;

    it('should parse valid JSON response', () => {
      engine = new LLMGameEngine();
      const json = JSON.stringify({
        room_name: 'Village Square',
        description: 'A sunny village square with a fountain.',
        items_here: ['torch', 'map'],
        actions: ['Go north', 'Go east', 'Take torch', 'Look around'],
        inventory_update: { add: [], remove: [] },
        game_over: false,
        message: null
      });

      const result = engine.parseResponse(json);
      assert.strictEqual(result.room_name, 'Village Square');
      assert.strictEqual(result.description, 'A sunny village square with a fountain.');
      assert.deepStrictEqual(result.items_here, ['torch', 'map']);
      assert.strictEqual(result.actions.length, 4);
      assert.strictEqual(result.game_over, false);
      assert.strictEqual(result.message, null);
    });

    it('should parse inventory_update with add items', () => {
      engine = new LLMGameEngine();
      const json = JSON.stringify({
        room_name: 'Forest',
        description: 'Dense trees.',
        items_here: [],
        actions: ['Go south', 'Look', 'Wait'],
        inventory_update: { add: ['torch', 'sword'], remove: [] },
        game_over: false,
        message: 'You picked up the torch and sword.'
      });

      const result = engine.parseResponse(json);
      assert.deepStrictEqual(result.inventory_update.add, ['torch', 'sword']);
      assert.deepStrictEqual(result.inventory_update.remove, []);
      assert.strictEqual(result.message, 'You picked up the torch and sword.');
    });

    it('should parse inventory_update with remove items', () => {
      engine = new LLMGameEngine();
      const json = JSON.stringify({
        room_name: 'Cave',
        description: 'Dark cave.',
        items_here: [],
        actions: ['Go back', 'Look'],
        inventory_update: { add: ['golden key'], remove: ['torch'] },
        game_over: false,
        message: 'The torch burns out but reveals a golden key.'
      });

      const result = engine.parseResponse(json);
      assert.deepStrictEqual(result.inventory_update.add, ['golden key']);
      assert.deepStrictEqual(result.inventory_update.remove, ['torch']);
    });

    it('should provide defensive defaults for missing fields', () => {
      engine = new LLMGameEngine();
      const json = JSON.stringify({});

      const result = engine.parseResponse(json);
      assert.strictEqual(result.room_name, 'Unknown Location');
      assert.ok(result.description.length > 0);
      assert.deepStrictEqual(result.items_here, []);
      assert.ok(result.actions.length >= 3, 'Should have fallback actions');
      assert.deepStrictEqual(result.inventory_update, { add: [], remove: [] });
      assert.strictEqual(result.game_over, false);
      assert.strictEqual(result.message, null);
    });

    it('should handle invalid JSON with graceful fallback', () => {
      engine = new LLMGameEngine();
      const result = engine.parseResponse('not valid json at all');

      assert.strictEqual(result.room_name, 'Mysterious Place');
      assert.ok(result.description.length > 0);
      assert.deepStrictEqual(result.items_here, []);
      assert.ok(result.actions.length >= 3);
      assert.deepStrictEqual(result.inventory_update, { add: [], remove: [] });
      assert.strictEqual(result.game_over, false);
      assert.ok(result.message !== null, 'Should have error message');
    });

    it('should handle game_over flag', () => {
      engine = new LLMGameEngine();
      const json = JSON.stringify({
        room_name: 'Treasure Chamber',
        description: 'You found the legendary treasure!',
        items_here: ['gold', 'crown'],
        actions: [],
        inventory_update: { add: ['gold', 'crown'], remove: [] },
        game_over: true,
        message: 'Congratulations, adventurer!'
      });

      const result = engine.parseResponse(json);
      assert.strictEqual(result.game_over, true);
      assert.strictEqual(result.room_name, 'Treasure Chamber');
    });

    it('should handle non-array items_here', () => {
      engine = new LLMGameEngine();
      const json = JSON.stringify({
        room_name: 'Room',
        description: 'A room.',
        items_here: 'not an array',
        actions: ['Look'],
        inventory_update: { add: [], remove: [] },
        game_over: false,
        message: null
      });

      const result = engine.parseResponse(json);
      assert.deepStrictEqual(result.items_here, []);
    });

    it('should handle non-array actions with fallback', () => {
      engine = new LLMGameEngine();
      const json = JSON.stringify({
        room_name: 'Room',
        description: 'A room.',
        items_here: [],
        actions: 'not an array',
        inventory_update: { add: [], remove: [] },
        game_over: false,
        message: null
      });

      const result = engine.parseResponse(json);
      assert.ok(Array.isArray(result.actions));
      assert.ok(result.actions.length >= 3);
    });

    it('should handle empty actions array with fallback', () => {
      engine = new LLMGameEngine();
      const json = JSON.stringify({
        room_name: 'Room',
        description: 'A room.',
        items_here: [],
        actions: [],
        inventory_update: { add: [], remove: [] },
        game_over: false,
        message: null
      });

      const result = engine.parseResponse(json);
      assert.ok(result.actions.length >= 3, 'Empty actions should get fallback');
    });

    it('should handle missing inventory_update object', () => {
      engine = new LLMGameEngine();
      const json = JSON.stringify({
        room_name: 'Room',
        description: 'A room.',
        items_here: [],
        actions: ['Look'],
        game_over: false,
        message: null
      });

      const result = engine.parseResponse(json);
      assert.deepStrictEqual(result.inventory_update, { add: [], remove: [] });
    });

    it('should handle inventory_update with non-array add/remove', () => {
      engine = new LLMGameEngine();
      const json = JSON.stringify({
        room_name: 'Room',
        description: 'A room.',
        items_here: [],
        actions: ['Look'],
        inventory_update: { add: 'torch', remove: 'sword' },
        game_over: false,
        message: null
      });

      const result = engine.parseResponse(json);
      assert.deepStrictEqual(result.inventory_update.add, []);
      assert.deepStrictEqual(result.inventory_update.remove, []);
    });
  });

  describe('trimHistory', () => {
    it('should not trim short history', () => {
      const engine = new LLMGameEngine();
      const messages = [
        { role: 'system', content: 'You are a game master.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: '{}' }
      ];

      const trimmed = engine.trimHistory(messages);
      assert.strictEqual(trimmed.length, 3);
    });

    it('should trim long history keeping system prompt', () => {
      const engine = new LLMGameEngine();
      const messages = [
        { role: 'system', content: 'System prompt' }
      ];

      // Add 50 user/assistant message pairs
      for (let i = 0; i < 50; i++) {
        messages.push({ role: 'user', content: `User message ${i}` });
        messages.push({ role: 'assistant', content: `Assistant message ${i}` });
      }

      const trimmed = engine.trimHistory(messages);
      assert.strictEqual(trimmed[0].role, 'system', 'First message should be system prompt');
      assert.strictEqual(trimmed[0].content, 'System prompt');
      assert.ok(trimmed.length <= 41, 'Should be at most system + 40 messages');
    });

    it('should keep most recent messages when trimming', () => {
      const engine = new LLMGameEngine();
      const messages = [
        { role: 'system', content: 'System prompt' }
      ];

      for (let i = 0; i < 30; i++) {
        messages.push({ role: 'user', content: `User ${i}` });
        messages.push({ role: 'assistant', content: `Asst ${i}` });
      }

      const trimmed = engine.trimHistory(messages);
      const lastMsg = trimmed[trimmed.length - 1];
      assert.strictEqual(lastMsg.content, 'Asst 29', 'Last message should be the most recent');
    });

    it('should return a copy, not mutate original', () => {
      const engine = new LLMGameEngine();
      const messages = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Hello' }
      ];

      const trimmed = engine.trimHistory(messages);
      trimmed.push({ role: 'assistant', content: 'added' });
      assert.strictEqual(messages.length, 2, 'Original should not be modified');
    });
  });

  describe('buildSystemPrompt', () => {
    it('should include world seed', () => {
      const engine = new LLMGameEngine();
      const prompt = engine.buildSystemPrompt();
      assert.ok(prompt.includes('Village Square'), 'Should include Village Square');
      assert.ok(prompt.includes('Dark Forest'), 'Should include Dark Forest');
      assert.ok(prompt.includes('Treasure Chamber'), 'Should include Treasure Chamber');
    });

    it('should include inventory tracking rules', () => {
      const engine = new LLMGameEngine();
      const prompt = engine.buildSystemPrompt();
      assert.ok(prompt.includes('INVENTORY IS CRITICAL'), 'Should emphasize inventory tracking');
      assert.ok(prompt.includes('inventory_update.add'), 'Should mention inventory_update.add');
      assert.ok(prompt.includes('inventory_update.remove'), 'Should mention inventory_update.remove');
    });

    it('should include free-form text handling rule', () => {
      const engine = new LLMGameEngine();
      const prompt = engine.buildSystemPrompt();
      assert.ok(prompt.includes('free-form text'), 'Should mention free-form text handling');
    });

    it('should include JSON schema', () => {
      const engine = new LLMGameEngine();
      const prompt = engine.buildSystemPrompt();
      assert.ok(prompt.includes('room_name'), 'Should include room_name field');
      assert.ok(prompt.includes('description'), 'Should include description field');
      assert.ok(prompt.includes('items_here'), 'Should include items_here field');
      assert.ok(prompt.includes('actions'), 'Should include actions field');
      assert.ok(prompt.includes('inventory_update'), 'Should include inventory_update field');
      assert.ok(prompt.includes('game_over'), 'Should include game_over field');
      assert.ok(prompt.includes('message'), 'Should include message field');
    });
  });
});
