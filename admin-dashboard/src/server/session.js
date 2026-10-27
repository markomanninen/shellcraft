import { nanoid } from 'nanoid';
import { fingerprintOf } from '@shellcraft/ui/auth';

export class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  createSession(publicKey) {
    const id = nanoid();
    // "SHA256:..." as ssh-keygen -l shows it, or 'anonymous'.
    const fingerprint = fingerprintOf(publicKey);
    
    const session = {
      id,
      fingerprint,
      createdAt: new Date(),
      cart: [],
      user: null
    };
    
    this.sessions.set(id, session);
    return session;
  }

  getSession(id) {
    return this.sessions.get(id);
  }

  destroySession(id) {
    this.sessions.delete(id);
  }
}
