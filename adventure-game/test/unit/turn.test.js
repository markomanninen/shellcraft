import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { createInitialGameState } from '../../src/models/game-state.js';
import { RulesEngine } from '../../src/models/rules-engine.js';
import {
  needsTurn,
  nextAction,
  buildResponse,
  appendStory,
  storyOf,
  narrativeLines,
  journalEntries,
  healthTone,
  tensionTone,
  validateRenderableResponse,
  STORY_LIMIT
} from '../../src/ui/turn.js';
import { generateMap } from '../../src/ui/map-view.js';
import { stubLlm, narrate } from '../helpers/adventure.js';

describe('Turn helpers', () => {
  it('a new game, a chosen action or a pending narration needs a turn', () => {
    const state = createInitialGameState();
    assert.equal(needsTurn(null), false);
    assert.equal(needsTurn(state), true);
    assert.equal(nextAction(state), '__start__');
    state.isFirstTurn = false;
    state.lastResponse = { room_name: 'x' };
    assert.equal(needsTurn(state), false);
    state.pendingAction = 'Go north';
    assert.equal(needsTurn(state), true);
    assert.equal(nextAction(state), 'Go north');
    delete state.pendingAction;
    state.pendingTurn = {};
    assert.equal(needsTurn(state), true);
  });

  it('builds a valid response and a story entry from a turn and its narration', async () => {
    const state = createInitialGameState();
    const turn = new RulesEngine().resolveTurn(state, '__start__');
    const narration = await stubLlm().narrateTurn(turn, []);
    const response = validateRenderableResponse(buildResponse(turn, narration));
    assert.equal(response.room_name, 'Village Square');
    assert.equal(response.description, narrate({ room: turn.room }).description);
    assert.equal(response.action_outcome, 'success');
    const entry = appendStory(state, turn, response);
    assert.deepEqual(entry, {
      turn: 1,
      action: null,
      roomId: 'start',
      roomName: 'Village Square',
      description: response.description,
      message: response.message,
      status: 'success'
    });
    assert.equal(storyOf(state).length, 1);
  });

  it('keeps the story bounded', () => {
    const state = createInitialGameState();
    const turn = { turn: 0, action: { type: 'move', raw: 'Go north' }, room: { id: 'start', name: 'Village Square' } };
    for (let i = 0; i < STORY_LIMIT + 5; i++) {
      appendStory(state, { ...turn, turn: i }, { description: 'd', message: 'm', action_outcome: 'success' });
    }
    assert.equal(state.story.length, STORY_LIMIT);
    assert.equal(state.story[0].turn, 5);
  });

  it('a game saved before the story shows its last response', () => {
    const state = createInitialGameState();
    state.moves = 4;
    state.lastResponse = { room_name: 'Dark Forest', description: 'Trees.', message: 'You wait.', action_outcome: 'partial' };
    assert.deepEqual(narrativeLines(storyOf(state)), [
      'Trees.',
      '',
      { text: '! You wait.', tone: 'warning', hangingIndent: 2 }
    ]);
  });

  it('narrative lines: action muted, outcome in its tone, wrapped under its text', () => {
    const story = [
      { turn: 1, action: null, roomId: 'start', roomName: 'Village Square', description: 'Lanterns.', message: 'You begin.', status: 'success' },
      { turn: 2, action: 'Attack Shadow Wolf', roomId: 'forest', roomName: 'Dark Forest', description: 'Teeth.', message: 'You miss.', status: 'fail' }
    ];
    assert.deepEqual(narrativeLines(story), [
      'Lanterns.',
      '',
      { text: '✓ You begin.', tone: 'success', hangingIndent: 2 },
      '',
      { text: '› Attack Shadow Wolf', tone: 'muted', hangingIndent: 2 },
      'Teeth.',
      '',
      { text: '✗ You miss.', tone: 'danger', hangingIndent: 2 }
    ]);
    assert.deepEqual(journalEntries(story), [
      { prefix: 'T1', text: 'Arrived at Village Square' },
      { prefix: 'T2', text: 'Attack Shadow Wolf', status: 'fail' },
      { prefix: 'T2', text: 'Arrived at Dark Forest' }
    ]);
  });

  it('meter tones', () => {
    assert.equal(healthTone(20, 20), 'default');
    assert.equal(healthTone(10, 20), 'warning');
    assert.equal(healthTone(5, 20), 'danger');
    assert.equal(tensionTone(25), 'warning');
    assert.equal(tensionTone(80), 'danger');
  });

  it('draws the map without blessed tags', () => {
    const state = createInitialGameState();
    state.visitedRooms.add('forest');
    state.currentRoom = 'forest';
    const map = generateMap(state);
    assert.ok(map.startsWith('[ @ ]'));
    assert.ok(map.includes('  |\n[VLG]'));
    assert.ok(!map.includes('{'), 'no blessed tags');
  });
});
