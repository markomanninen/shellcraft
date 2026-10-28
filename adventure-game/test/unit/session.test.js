import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'assert';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { SessionManager } from '../../src/server/session.js';
import { testKey } from '../helpers/adventure.js';

describe('SessionManager', () => {
  let tempDir;
  let sessionsFile;
  let manager;
  let log;

  beforeEach(() => {
    // SessionManager logs every load and save; keep the test output readable.
    log = console.log;
    console.log = () => {};
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adventure-session-unit-'));
    sessionsFile = path.join(tempDir, 'sessions.json');
    manager = new SessionManager({ sessionsFile });
  });

  afterEach(() => {
    console.log = log;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const reload = () => new SessionManager({ sessionsFile });
  const saved = () => JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
  const play = (session) => {
    session.gameState = { moves: 1 };
    manager.saveSession(session.id);
  };

  it('creates a session owned by the key it signed in with', () => {
    const session = manager.createSession('testuser', testKey('testuser'));

    assert.ok(session.id);
    assert.strictEqual(session.username, 'testuser');
    assert.match(session.owner, /^SHA256:/);
    assert.strictEqual(session.anonymous, false);
    assert.ok(session.createdAt);
    assert.ok(Array.isArray(session.cart));
  });

  it('without a key: anonymous, named guest when there is no login name', () => {
    const session = manager.createSession(null);
    assert.strictEqual(session.username, 'guest');
    assert.strictEqual(session.owner, null);
    assert.strictEqual(session.anonymous, true);
  });

  it('the same key resumes its game, under any login name', () => {
    const first = manager.createSession('ada', testKey('ada'));
    play(first);

    const again = reload().createSession('ada-laptop', testKey('ada'));
    assert.strictEqual(again.id, first.id);
    assert.strictEqual(again.gameState.moves, 1);
    assert.strictEqual(again.username, 'ada-laptop', 'the name shown is the current one');
  });

  it('the same login name with another key, or none, does not get the game', () => {
    play(manager.createSession('ada', testKey('ada')));
    const later = reload();

    const otherKey = later.createSession('ada', testKey('mallory'));
    assert.strictEqual(otherKey.gameState, undefined);
    const noKey = later.createSession('ada');
    assert.strictEqual(noKey.gameState, undefined);
    assert.notStrictEqual(otherKey.id, noKey.id);
  });

  it('anonymous sessions are never shared and never written', () => {
    const a = manager.createSession('guest');
    const b = manager.createSession('guest');
    assert.notStrictEqual(a.id, b.id);

    play(a);
    assert.strictEqual(fs.existsSync(sessionsFile), false);

    play(manager.createSession('ada', testKey('ada')));
    assert.deepStrictEqual(saved().map((entry) => entry.username), ['ada']);
  });

  it('keeps saves from before key sign-in in the file but never resumes them', () => {
    const old = { id: 'old1', username: 'ada', gameState: { moves: 7 } };
    fs.writeFileSync(sessionsFile, JSON.stringify([old]));
    const later = reload();

    assert.strictEqual(later.createSession('ada').gameState, undefined);
    const keyed = later.createSession('ada', testKey('ada'));
    assert.strictEqual(keyed.gameState, undefined);

    keyed.gameState = { moves: 1 };
    later.saveSession(keyed.id);
    assert.deepStrictEqual(saved().find((entry) => entry.id === 'old1'), old);
    assert.strictEqual(saved().length, 2);
  });

  it('retrieves existing session', () => {
    const session = manager.createSession('testuser', testKey('testuser'));
    assert.strictEqual(manager.getSession(session.id), session);
  });

  it('destroying a keyed session removes its saved game', () => {
    const session = manager.createSession('testuser', testKey('testuser'));
    play(session);
    manager.destroySession(session.id);

    assert.strictEqual(manager.getSession(session.id), undefined);
    assert.deepStrictEqual(saved(), []);
    assert.strictEqual(reload().createSession('testuser', testKey('testuser')).gameState, undefined);
  });

  it('destroying an anonymous session forgets it without touching the file', () => {
    const session = manager.createSession(null);
    manager.destroySession(session.id);
    assert.strictEqual(manager.getSession(session.id), undefined);
    assert.strictEqual(fs.existsSync(sessionsFile), false);
  });
});
