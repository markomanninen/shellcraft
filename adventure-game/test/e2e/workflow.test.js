import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { GameModel } from '../../src/models/game.js';
import { SessionManager } from '../../src/server/session.js';

describe('Adventure Game Workflow', () => {
  it('should complete exploration workflow', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adventure-workflow-'));
    const sessionsFile = path.join(tempDir, 'sessions.json');

    try {
      // 1. Create session
      const sessionManager = new SessionManager({ sessionsFile });
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
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should handle multiple concurrent sessions', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adventure-workflow-'));
    const sessionsFile = path.join(tempDir, 'sessions.json');
    try {
      const sessionManager = new SessionManager({ sessionsFile });
      
      // Create multiple sessions with different usernames
      // (SessionManager reuses sessions for the same username for resume support)
      const session1 = sessionManager.createSession('player1');
      const session2 = sessionManager.createSession('player2');
      
      // Sessions should be independent
      assert.notStrictEqual(session1.id, session2.id, 'Sessions should have different IDs');
      
      // Verify sessions are tracked
      assert.ok(sessionManager.getSession(session1.id), 'Session 1 should be retrievable');
      assert.ok(sessionManager.getSession(session2.id), 'Session 2 should be retrievable');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
