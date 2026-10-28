import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ssh2 from 'ssh2';
import { authenticate, fingerprintOf, AUTH_METHODS } from '../src/auth.js';

const { Server, Client, utils } = ssh2;

/** A fake ssh2 authentication context that records the answer. */
function fakeCtx(method, extra = {}) {
  const ctx = { method, username: 'alice', result: null, ...extra };
  ctx.accept = () => {
    ctx.result = 'accept';
  };
  ctx.reject = (methods) => {
    ctx.result = 'reject';
    ctx.offered = methods;
  };
  return ctx;
}

/**
 * A key pair from ssh2's keygen. ssh2 1.17.0 drops every leading zero byte of
 * an ed25519 public key, so about one key in 256 comes out 31 bytes long and
 * does not parse back (parseKey returns an Error); such a key is made again.
 */
function keyPair(type = 'ed25519') {
  for (;;) {
    const pair = utils.generateKeyPairSync(type, type === 'rsa' ? { bits: 2048 } : undefined);
    const key = utils.parseKey(pair.private);
    if (!(key instanceof Error)) return { pair, key, publicKey: { algo: key.type, data: key.getPublicSSH() } };
  }
}

describe('authenticate (unit)', () => {
  it('rejects none, password and hostbased, offering publickey and keyboard-interactive', () => {
    for (const method of ['none', 'password', 'hostbased']) {
      const ctx = fakeCtx(method);
      authenticate(ctx);
      assert.equal(ctx.result, 'reject', method);
      assert.deepEqual(ctx.offered, [...AUTH_METHODS]);
    }
  });

  it('lets a client without a key in through keyboard-interactive, without prompts', () => {
    const ctx = fakeCtx('keyboard-interactive');
    let key = null;
    authenticate(ctx, (k) => {
      key = k;
    });
    assert.equal(ctx.result, 'accept');
    assert.equal(key, null);
  });

  it('anonymous: false turns keyboard-interactive away and offers only publickey', () => {
    const ctx = fakeCtx('keyboard-interactive');
    authenticate(ctx, undefined, { anonymous: false });
    assert.equal(ctx.result, 'reject');
    assert.deepEqual(ctx.offered, ['publickey']);
  });

  it('answers a key query (no signature) without trusting the key', () => {
    const { publicKey } = keyPair();
    const ctx = fakeCtx('publickey', { key: publicKey });
    let key = null;
    authenticate(ctx, (k) => {
      key = k;
    });
    assert.equal(ctx.result, 'accept');
    assert.equal(key, null);
  });

  it('accepts a valid signature and reports the key', () => {
    for (const type of ['ed25519', 'rsa']) {
      const { key: privateKey, publicKey } = keyPair(type);
      const blob = Buffer.from('session id and request');
      const ctx = fakeCtx('publickey', { key: publicKey, blob, signature: privateKey.sign(blob), hashAlgo: undefined });
      let key = null;
      authenticate(ctx, (k) => {
        key = k;
      });
      assert.equal(ctx.result, 'accept', type);
      assert.equal(key, publicKey);
      assert.match(fingerprintOf(key), /^SHA256:[A-Za-z0-9+/]{43}$/);
    }
  });

  it('rejects a signature made with another key', () => {
    const { publicKey } = keyPair();
    const other = keyPair().key;
    const blob = Buffer.from('session id and request');
    const ctx = fakeCtx('publickey', { key: publicKey, blob, signature: other.sign(blob) });
    let key = null;
    authenticate(ctx, (k) => {
      key = k;
    });
    assert.equal(ctx.result, 'reject');
    assert.equal(key, null);
  });

  it('rejects garbage keys and keys allowKey turns away', () => {
    const garbage = fakeCtx('publickey', { key: { algo: 'ssh-ed25519', data: Buffer.from('nope') } });
    authenticate(garbage);
    assert.equal(garbage.result, 'reject');
    const { publicKey } = keyPair();
    const denied = fakeCtx('publickey', { key: publicKey });
    authenticate(denied, undefined, { allowKey: () => false });
    assert.equal(denied.result, 'reject');
  });

  it('fingerprintOf: anonymous without a key', () => {
    assert.equal(fingerprintOf(null), 'anonymous');
    assert.equal(fingerprintOf({}), 'anonymous');
  });
});

describe('authenticate on a real SSH server', () => {
  let server;
  let port;
  const seen = [];

  before(async () => {
    const host = keyPair().pair;
    server = new Server({ hostKeys: [host.private] }, (client) => {
      const record = { key: null, user: null };
      client.on('authentication', (ctx) => {
        record.user = ctx.username;
        authenticate(ctx, (key) => {
          record.key = key;
        });
      });
      client.on('ready', () => {
        seen.push(record);
        client.on('session', (accept) => {
          const session = accept();
          session.on('exec', (acceptExec) => {
            const stream = acceptExec();
            stream.write(`ok ${fingerprintOf(record.key)}\n`);
            stream.exit(0);
            stream.end();
          });
        });
      });
      client.on('error', () => {});
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  function connect(options) {
    const conn = new Client();
    conn.on('keyboard-interactive', (_name, _instructions, _lang, _prompts, finish) => finish([]));
    return new Promise((resolve, reject) => {
      conn.on('ready', () => {
        conn.end();
        resolve();
      });
      conn.on('error', reject);
      conn.connect({ host: '127.0.0.1', port, username: 'test', readyTimeout: 5000, ...options });
    });
  }

  it('ssh2 client with a key: signed in, key verified and reported', async () => {
    const { pair, publicKey } = keyPair();
    seen.length = 0;
    await connect({ privateKey: pair.private, tryKeyboard: false });
    assert.equal(fingerprintOf(seen[0].key), fingerprintOf(publicKey));
  });

  it('ssh2 client without a key: anonymous through keyboard-interactive', async () => {
    seen.length = 0;
    await connect({ tryKeyboard: true });
    assert.equal(seen[0].key, null);
  });

  it('ssh2 client with only none or a password: turned away', async () => {
    await assert.rejects(connect({ tryKeyboard: false }), /authentication methods failed/);
    await assert.rejects(connect({ password: 'secret', tryKeyboard: false }), /authentication methods failed/);
  });

  const haveOpenSsh = spawnSync('ssh', ['-V'], { encoding: 'utf8' }).status === 0;

  function openssh(args) {
    return new Promise((resolve) => {
      const child = spawn(
        'ssh',
        [
          '-F', '/dev/null',
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'UserKnownHostsFile=/dev/null',
          '-o', 'IdentityAgent=none',
          '-o', 'LogLevel=ERROR',
          '-o', 'ConnectTimeout=5',
          '-p', String(port),
          ...args
        ],
        { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, SSH_AUTH_SOCK: '' } }
      );
      let out = '';
      let err = '';
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (err += d));
      child.on('close', (code) => resolve({ code, out, err }));
    });
  }

  it('OpenSSH client with a key: signs in with that key', { skip: !haveOpenSsh && 'no ssh client' }, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shellcraft-auth-'));
    try {
      const { pair, publicKey } = keyPair();
      const file = path.join(dir, 'id_ed25519');
      fs.writeFileSync(file, pair.private, { mode: 0o600 });
      const result = await openssh(['-i', file, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', 'alice@127.0.0.1', 'true']);
      assert.equal(result.code, 0, result.err);
      assert.equal(result.out.trim(), `ok ${fingerprintOf(publicKey)}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('OpenSSH client without keys: anonymous, no prompts', { skip: !haveOpenSsh && 'no ssh client' }, async () => {
    const result = await openssh([
      '-o', 'PubkeyAuthentication=no',
      '-o', 'PasswordAuthentication=no',
      '-o', 'KbdInteractiveAuthentication=yes',
      'guest@127.0.0.1', 'true'
    ]);
    assert.equal(result.code, 0, result.err);
    assert.equal(result.out.trim(), 'ok anonymous');
  });

  it('OpenSSH client with none only: turned away', { skip: !haveOpenSsh && 'no ssh client' }, async () => {
    const result = await openssh(['-o', 'PreferredAuthentications=none', '-o', 'BatchMode=yes', 'guest@127.0.0.1', 'true']);
    assert.notEqual(result.code, 0);
    assert.match(result.err, /Permission denied/);
  });
});
