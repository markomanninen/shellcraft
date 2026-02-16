import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import {
  validateRenderableResponse,
  buildMeterBar,
  classifyAction
} from '../../src/ui/room.js';

describe('Room response validation', () => {
  it('accepts fully shaped responses', () => {
    const response = {
      room_name: 'Village Square',
      description: 'You stand in the village center.',
      items_here: ['torch'],
      actions: ['Go north'],
      message: 'You grip the torch.',
      director: {
        style: 'balanced',
        lastBeat: 'discovery',
        tension: 25
      },
      phase: 'dawn',
      player: {
        health: 20,
        maxHealth: 20
      },
      active_encounter: null
    };

    const validated = validateRenderableResponse(response);
    assert.strictEqual(validated, response);
  });

  it('throws when required fields are missing', () => {
    const malformed = {
      room_name: 'Village Square',
      description: 'Missing director and player fields',
      items_here: [],
      actions: ['Wait'],
      message: '...'
    };

    assert.throws(() => validateRenderableResponse(malformed), /missing "director"/);
  });
});

describe('Room UI helpers', () => {
  it('builds a bounded meter bar', () => {
    assert.strictEqual(buildMeterBar(5, 10, 10), '=====-----');
    assert.strictEqual(buildMeterBar(50, 10, 10), '==========');
    assert.strictEqual(buildMeterBar(-4, 10, 10), '----------');
  });

  it('classifies actions for tactical list labels', () => {
    assert.strictEqual(classifyAction('Go north into the forest'), 'MOVE');
    assert.strictEqual(classifyAction('Attack the guardian'), 'COMBAT');
    assert.strictEqual(classifyAction('Talk to the village elder'), 'SOCIAL');
    assert.strictEqual(classifyAction('Investigate the altar'), 'LOOK');
    assert.strictEqual(classifyAction('Take the amulet'), 'USE');
    assert.strictEqual(classifyAction('Back to menu'), 'SYSTEM');
  });
});
