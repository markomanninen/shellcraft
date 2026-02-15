import { nanoid } from 'nanoid';
import crypto from 'crypto';

export class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  createSession(publicKey) {
    const id = nanoid();
    const fingerprint = publicKey 
      ? crypto.createHash('md5').update(publicKey.data).digest('hex')
      : 'anonymous';
    
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
