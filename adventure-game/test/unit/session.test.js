import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { SessionManager } from '../../src/server/session.js';

describe('SessionManager', () => {
  it('should create a session', () => {
    const manager = new SessionManager();
    const session = manager.createSession('testuser');

    assert.ok(session, 'Should create session');
    assert.ok(session.id, 'Session should have id');
    assert.strictEqual(session.username, 'testuser');
    assert.ok(session.createdAt, 'Session should have createdAt');
    assert.ok(Array.isArray(session.cart), 'Session should have cart array');
  });

  it('should create guest session without username', () => {
    const manager = new SessionManager();
    const session = manager.createSession(null);

    assert.strictEqual(session.username, 'guest');
  });

  it('should reuse session for same username', () => {
    const manager = new SessionManager();
    const session1 = manager.createSession('player1');
    session1.gameState = { test: true };
    const session2 = manager.createSession('player1');

    assert.strictEqual(session1.id, session2.id);
    assert.deepStrictEqual(session2.gameState, { test: true });
  });

  it('should retrieve existing session', () => {
    const manager = new SessionManager();
    const session = manager.createSession('testuser');
    const retrieved = manager.getSession(session.id);

    assert.deepStrictEqual(retrieved, session);
  });

  it('should destroy session', () => {
    const manager = new SessionManager();
    const session = manager.createSession('testuser');

    manager.destroySession(session.id);
    const retrieved = manager.getSession(session.id);

    assert.strictEqual(retrieved, undefined);
  });

  it('should maintain separate session carts', () => {
    const manager = new SessionManager();
    const session1 = manager.createSession('user1');
    const session2 = manager.createSession('user2');

    session1.cart.push({ id: 'item1' });
    session2.cart.push({ id: 'item2' });

    assert.strictEqual(session1.cart.length, 1);
    assert.strictEqual(session2.cart.length, 1);
    assert.notDeepStrictEqual(session1.cart, session2.cart);
  });
});
