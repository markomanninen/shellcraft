// SSH authentication for shellcraft servers: `@shellcraft/ui/auth`.
// Separate from the main entry, so apps without SSH do not load ssh2 (an
// optional peer dependency).
import crypto from 'node:crypto';
import ssh2 from 'ssh2';

const { utils } = ssh2;

/** The methods offered when one is rejected. */
export const AUTH_METHODS = Object.freeze(['publickey', 'keyboard-interactive']);

/** OpenSSH-style fingerprint of a public key: "SHA256:…" (as ssh-keygen -l), or 'anonymous'. */
export function fingerprintOf(publicKey) {
  if (!publicKey?.data) return 'anonymous';
  return `SHA256:${crypto.createHash('sha256').update(publicKey.data).digest('base64').replace(/=+$/, '')}`;
}

/**
 * ssh2 'authentication' handler:
 *
 *   client.on('authentication', (ctx) => authenticate(ctx, (key) => { publicKey = key; }));
 *
 * - publickey: the client must prove it holds the key: ssh2 leaves the
 *   signature check to the server, so without this anyone could claim any
 *   public key. A query without a signature ("would this key do?") is
 *   answered yes; onKey(ctx.key) is called only for a verified signature.
 *   allowKey(ctx.key, ctx) can turn keys away (an allow-list).
 * - keyboard-interactive: accepted without prompts, an anonymous session
 *   (anonymous: false turns this off).
 * - none, password and the rest: rejected, offering the methods above.
 *   OpenSSH tries 'none' first; accepting it made every user anonymous and
 *   the client never offered its keys.
 *
 * Options: { anonymous = true, allowKey = () => true }.
 */
export function authenticate(ctx, onKey = () => {}, { anonymous = true, allowKey = () => true } = {}) {
  const methods = anonymous ? [...AUTH_METHODS] : ['publickey'];
  if (ctx.method === 'publickey') {
    let key = null;
    try {
      key = ctx.key?.data ? utils.parseKey(ctx.key.data) : null;
    } catch {
      key = null;
    }
    if (!key || key instanceof Error || !allowKey(ctx.key, ctx)) return ctx.reject(methods);
    if (ctx.signature) {
      if (key.verify(ctx.blob, ctx.signature, ctx.hashAlgo) !== true) return ctx.reject(methods);
      onKey(ctx.key);
    }
    return ctx.accept();
  }
  if (ctx.method === 'keyboard-interactive' && anonymous) return ctx.accept();
  return ctx.reject(methods);
}
