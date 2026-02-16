import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

export class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.usernameIndex = new Map(); // username → session id
    this._load();
  }

  _load() {
    try {
      if (!fs.existsSync(SESSIONS_FILE)) {
        console.log('[session] No sessions file found, starting fresh');
        return;
      }
      const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      console.log(`[session] Reading ${SESSIONS_FILE} — ${raw.length} entry(ies)`);
      for (const entry of raw) {
        if (entry.gameState?.visitedRooms) {
          entry.gameState.visitedRooms = new Set(entry.gameState.visitedRooms);
        }
        if (entry.createdAt) entry.createdAt = new Date(entry.createdAt);
        if (entry.lastConnected) entry.lastConnected = new Date(entry.lastConnected);

        this.sessions.set(entry.id, entry);
        if (entry.username) {
          this.usernameIndex.set(entry.username, entry.id);
        }
      }
      console.log(`[session] Loaded ${this.sessions.size} saved session(s)`);
    } catch (err) {
      console.error('[session] Failed to load sessions:', err.message);
    }
  }

  _save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const entries = [];
      for (const session of this.sessions.values()) {
        if (!session.gameState) continue; // only save sessions with game progress

        const clone = { ...session };
        clone.gameState = { ...clone.gameState };
        if (clone.gameState.visitedRooms instanceof Set) {
          clone.gameState.visitedRooms = [...clone.gameState.visitedRooms];
        }
        entries.push(clone);
      }
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(entries, null, 2));
      console.log(`[session] Saved ${entries.length} session(s) to ${SESSIONS_FILE}`);
    } catch (err) {
      console.error('[session] Failed to save sessions:', err.message);
    }
  }

  createSession(username) {
    username = username || 'guest';

    // Return existing session for known usernames
    if (this.usernameIndex.has(username)) {
      const existingId = this.usernameIndex.get(username);
      const existing = this.sessions.get(existingId);
      if (existing) {
        existing.lastConnected = new Date();
        console.log(`[session] Resuming session for "${username}" (id=${existingId}, hasGame=${!!existing.gameState})`);
        return existing;
      }
    }

    const id = nanoid();
    const session = {
      id,
      username,
      createdAt: new Date(),
      lastConnected: new Date(),
      cart: [],
      user: null
    };

    this.sessions.set(id, session);
    this.usernameIndex.set(username, id);
    console.log(`[session] Created new session for "${username}" (id=${id})`);
    return session;
  }

  saveSession(id) {
    if (this.sessions.has(id)) {
      this._save();
    }
  }

  getSession(id) {
    return this.sessions.get(id);
  }

  destroySession(id) {
    const session = this.sessions.get(id);
    if (session?.username) {
      this.usernameIndex.delete(session.username);
    }
    this.sessions.delete(id);
    this._save();
  }
}
