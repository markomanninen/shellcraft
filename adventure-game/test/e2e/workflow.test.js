import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { GameModel } from '../../src/models/game.js';
import { SessionManager } from '../../src/server/session.js';

describe('Adventure Game Workflow', () => {
  it('should complete exploration workflow', () => {
    // 1. Create session
    const sessionManager = new SessionManager();
    const session = sessionManager.createSession(null);
    assert.ok(session, 'Session should be created');

    // 2. Get game model
    const gameModel = new GameModel();
    const rooms = gameModel.getAllRooms();
    assert.ok(rooms.length > 0, 'Should have rooms');

    // 3. Start in village
    const startRoom = gameModel.getRoom('start');
    assert.ok(startRoom, 'Start room should exist');
    assert.strictEqual(startRoom.name, 'Village Square', 'Should start in village');

    // 4. Navigate to forest
    const forestId = startRoom.exits.north;
    const forestRoom = gameModel.getRoom(forestId);
    assert.ok(forestRoom, 'Forest room should exist');
    assert.strictEqual(forestRoom.name, 'Dark Forest', 'Should be in forest');

    // 5. Check items exist
    assert.ok(forestRoom.items.length > 0, 'Forest should have items');
    assert.ok(forestRoom.items.includes('sword'), 'Forest should have sword');
  });

  it('should handle multiple concurrent sessions', () => {
    const sessionManager = new SessionManager();
    
    // Create multiple sessions
    const session1 = sessionManager.createSession(null);
    const session2 = sessionManager.createSession(null);
    
    // Sessions should be independent
    assert.notStrictEqual(session1.id, session2.id, 'Sessions should have different IDs');
    
    // Verify sessions are tracked
    assert.ok(sessionManager.getSession(session1.id), 'Session 1 should be retrievable');
    assert.ok(sessionManager.getSession(session2.id), 'Session 2 should be retrievable');
  });
});
