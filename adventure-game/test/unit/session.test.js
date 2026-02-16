import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'assert';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { SessionManager } from '../../src/server/session.js';

describe('SessionManager', () => {
  let tempDir;
  let sessionsFile;
  let manager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adventure-session-unit-'));
    sessionsFile = path.join(tempDir, 'sessions.json');
    manager = new SessionManager({ sessionsFile });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a session', () => {
    const session = manager.createSession('testuser');

    assert.ok(session);
    assert.ok(session.id);
    assert.strictEqual(session.username, 'testuser');
    assert.ok(session.createdAt);
    assert.ok(Array.isArray(session.cart));
  });

  it('creates guest session without username', () => {
    const session = manager.createSession(null);
    assert.strictEqual(session.username, 'guest');
  });

  it('reuses session for same username', () => {
    const session1 = manager.createSession('player1');
    session1.gameState = { test: true };
    const session2 = manager.createSession('player1');

    assert.strictEqual(session1.id, session2.id);
    assert.deepStrictEqual(session2.gameState, { test: true });
  });

  it('retrieves existing session', () => {
    const session = manager.createSession('testuser');
    const retrieved = manager.getSession(session.id);
    assert.deepStrictEqual(retrieved, session);
  });

  it('destroys session', () => {
    const session = manager.createSession('testuser');
    manager.destroySession(session.id);
    const retrieved = manager.getSession(session.id);
    assert.strictEqual(retrieved, undefined);
  });

  it('maintains separate session carts', () => {
    const session1 = manager.createSession('user1');
    const session2 = manager.createSession('user2');

    session1.cart.push({ id: 'item1' });
    session2.cart.push({ id: 'item2' });

    assert.strictEqual(session1.cart.length, 1);
    assert.strictEqual(session2.cart.length, 1);
    assert.notDeepStrictEqual(session1.cart, session2.cart);
  });
});
