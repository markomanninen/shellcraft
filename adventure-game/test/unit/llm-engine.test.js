import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { LLMGameEngine, LLMResponseValidationError } from '../../src/llm/game-engine.js';
import { GAME_CONFIG } from '../../src/config/game-config.js';

describe('LLMGameEngine', () => {
  describe('parseNarrationResponse', () => {
    it('parses a valid narration payload', () => {
      const engine = new LLMGameEngine();
      const payload = JSON.stringify({
        description: 'Mist rolls between old stones as lanterns flicker in the square.',
        message: 'You steady yourself and continue.'
      });

      const result = engine.parseNarrationResponse(payload);
      assert.strictEqual(result.description.includes('Mist rolls'), true);
      assert.strictEqual(result.message, 'You steady yourself and continue.');
    });

    it('throws on invalid JSON', () => {
      const engine = new LLMGameEngine();
      assert.throws(
        () => engine.parseNarrationResponse('{'),
        (err) => err instanceof LLMResponseValidationError
      );
    });

    it('throws when required keys are missing', () => {
      const engine = new LLMGameEngine();
      const payload = JSON.stringify({ description: 'Only description is present.' });
      assert.throws(
        () => engine.parseNarrationResponse(payload),
        /Missing required response key "message"/
      );
    });

    it('truncates when description exceeds configured max length', () => {
      const engine = new LLMGameEngine();
      const payload = JSON.stringify({
        description: 'x'.repeat(GAME_CONFIG.llm.descriptionMaxChars + 10),
        message: 'Too long'
      });
      
      const result = engine.parseNarrationResponse(payload);
      assert.strictEqual(result.description.length, GAME_CONFIG.llm.descriptionMaxChars);
      assert.match(result.description, /\.{3}$/);
    });
  });

  describe('prepareHistory', () => {
    it('initializes history with a system prompt when empty', () => {
      const engine = new LLMGameEngine();
      const history = engine.prepareHistory([]);
      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0].role, 'system');
    });

    it('throws if history does not start with system prompt', () => {
      const engine = new LLMGameEngine();
      assert.throws(
        () => engine.prepareHistory([{ role: 'user', content: 'hello' }]),
        /must start with a system prompt/
      );
    });
  });

  describe('trimHistory', () => {
    it('trims to system message + configured window', () => {
      const engine = new LLMGameEngine();
      const messages = [{ role: 'system', content: 'sys' }];
      for (let i = 0; i < 80; i += 1) {
        messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `m${i}` });
      }

      const trimmed = engine.trimHistory(messages);
      assert.strictEqual(trimmed[0].role, 'system');
      assert.ok(trimmed.length <= GAME_CONFIG.llm.maxHistoryMessages + 1);
    });
  });

  describe('buildSystemPrompt', () => {
    it('contains world seed and deterministic narration rule', () => {
      const engine = new LLMGameEngine();
      const prompt = engine.buildSystemPrompt();

      assert.ok(prompt.includes('Village Square'));
      assert.ok(prompt.includes('rules resolution is deterministic'));
    });
  });
});
