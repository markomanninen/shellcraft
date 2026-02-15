import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { SessionManager } from '../../src/server/session.js';
import crypto from 'crypto';

describe('SessionManager', () => {
  it('should create a session', () => {
    const manager = new SessionManager();
    const session = manager.createSession(null);
    
    assert.ok(session, 'Should create session');
    assert.ok(session.id, 'Session should have id');
    assert.ok(session.fingerprint, 'Session should have fingerprint');
    assert.ok(session.createdAt, 'Session should have createdAt');
    assert.ok(Array.isArray(session.cart), 'Session should have cart array');
  });

  it('should create anonymous session without key', () => {
    const manager = new SessionManager();
    const session = manager.createSession(null);
    
    assert.strictEqual(session.fingerprint, 'anonymous');
  });

  it('should create fingerprint from public key', () => {
    const manager = new SessionManager();
    const mockKey = { data: Buffer.from('test-key-data') };
    const session = manager.createSession(mockKey);
    
    assert.notStrictEqual(session.fingerprint, 'anonymous');
    assert.ok(session.fingerprint.length > 0);
  });

  it('should retrieve existing session', () => {
    const manager = new SessionManager();
    const session = manager.createSession(null);
    const retrieved = manager.getSession(session.id);
    
    assert.deepStrictEqual(retrieved, session);
  });

  it('should destroy session', () => {
    const manager = new SessionManager();
    const session = manager.createSession(null);
    
    manager.destroySession(session.id);
    const retrieved = manager.getSession(session.id);
    
    assert.strictEqual(retrieved, undefined);
  });

  it('should maintain separate session carts', () => {
    const manager = new SessionManager();
    const session1 = manager.createSession(null);
    const session2 = manager.createSession(null);
    
    session1.cart.push({ id: 'item1' });
    session2.cart.push({ id: 'item2' });
    
    assert.strictEqual(session1.cart.length, 1);
    assert.strictEqual(session2.cart.length, 1);
    assert.notDeepStrictEqual(session1.cart, session2.cart);
  });
});
