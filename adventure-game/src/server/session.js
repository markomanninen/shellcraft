import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';
import { fingerprintOf } from '@shellcraft/ui/auth';
import { normalizeGameState } from '../models/game-state.js';
import { runtimeConfig } from '../config/runtime-config.js';

function resolveSessionsFile(filePath) {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.resolve(process.cwd(), filePath);
}

/**
 * Sessions and their saved games. A saved game belongs to the SSH key the
 * player proved (its fingerprint, `owner`); the login name is only shown,
 * since anyone can type any name. Without a key a session is anonymous: a
 * fresh game on every connection that is never written to disk.
 */
export class SessionManager {
  constructor(options = {}) {
    this.sessionsFile = resolveSessionsFile(
      options.sessionsFile ?? runtimeConfig.storage.sessionsFile
    );
    this.dataDir = path.dirname(this.sessionsFile);
    this.sessions = new Map();
    this.ownerIndex = new Map(); // key fingerprint → session id
    // Saves from before key sign-in, keyed by login name only. Kept in the
    // file as they are but never resumed: a name proves nothing.
    this.unowned = [];
    this._load();
  }

  _load() {
    try {
      if (!fs.existsSync(this.sessionsFile)) {
        console.log('[session] No sessions file found, starting fresh');
        return;
      }
      const raw = JSON.parse(fs.readFileSync(this.sessionsFile, 'utf8'));
      console.log(`[session] Reading ${this.sessionsFile} — ${raw.length} entry(ies)`);
      for (const entry of raw) {
        if (!entry.owner) {
          this.unowned.push(entry);
          continue;
        }
        if (entry.gameState) {
          entry.gameState = normalizeGameState(entry.gameState);
        }
        if (entry.createdAt) entry.createdAt = new Date(entry.createdAt);
        if (entry.lastConnected) entry.lastConnected = new Date(entry.lastConnected);

        this.sessions.set(entry.id, entry);
        this.ownerIndex.set(entry.owner, entry.id);
      }
      console.log(`[session] Loaded ${this.sessions.size} saved session(s)`);
      if (this.unowned.length > 0) {
        console.log(`[session] Kept ${this.unowned.length} save(s) without a key; they cannot be resumed`);
      }
    } catch (err) {
      console.error('[session] Failed to load sessions:', err.message);
    }
  }

  _save() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const entries = [];
      for (const session of this.sessions.values()) {
        if (!session.owner || !session.gameState) continue; // only keyed sessions with game progress

        const clone = { ...session };
        clone.gameState = { ...clone.gameState };
        if (clone.gameState.visitedRooms instanceof Set) {
          clone.gameState.visitedRooms = [...clone.gameState.visitedRooms];
        }
        entries.push(clone);
      }
      entries.push(...this.unowned);
      fs.writeFileSync(this.sessionsFile, JSON.stringify(entries, null, 2));
      console.log(`[session] Saved ${entries.length} session(s) to ${this.sessionsFile}`);
    } catch (err) {
      console.error('[session] Failed to save sessions:', err.message);
    }
  }

  /**
   * The session of one connection. username: the SSH login name (shown);
   * publicKey: the key authenticate() verified ({ algo, data }), or null.
   * The same key resumes its saved game under whatever name it signs in
   * with; no key gives a new anonymous session every time.
   */
  createSession(username, publicKey = null) {
    username = username || 'guest';
    const owner = publicKey?.data ? fingerprintOf(publicKey) : null;

    const existing = owner ? this.sessions.get(this.ownerIndex.get(owner)) : null;
    if (existing) {
      existing.username = username;
      existing.lastConnected = new Date();
      console.log(`[session] Resuming session for ${owner} as "${username}" (id=${existing.id}, hasGame=${!!existing.gameState})`);
      return existing;
    }

    const id = nanoid();
    const session = {
      id,
      owner,
      anonymous: !owner,
      username,
      createdAt: new Date(),
      lastConnected: new Date(),
      cart: [],
      user: null
    };

    this.sessions.set(id, session);
    if (owner) this.ownerIndex.set(owner, id);
    console.log(`[session] Created new session for "${username}" (id=${id}, ${owner ?? 'anonymous, not saved'})`);
    return session;
  }

  /** Write the saved games after a change to this one; anonymous ones are never written. */
  saveSession(id) {
    if (this.sessions.get(id)?.owner) {
      this._save();
    }
  }

  getSession(id) {
    return this.sessions.get(id);
  }

  /** Forget a session; a keyed one also loses its saved game. */
  destroySession(id) {
    const session = this.sessions.get(id);
    if (session?.owner) {
      this.ownerIndex.delete(session.owner);
    }
    this.sessions.delete(id);
    if (session?.owner) this._save();
  }
}
