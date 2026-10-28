import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'assert';
import { Client } from 'ssh2';
import { spawn } from 'child_process';
import { generateKeyPairSync } from 'crypto';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';

/** A port nobody listens on right now (other apps' e2e tests use 2223). */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

describe('SSH Server E2E', () => {
  let serverProcess;
  let dataDir;
  let TEST_PORT;

  before(async () => {
    // Ensure keys exist
    if (!fs.existsSync('./keys/host_key')) {
      throw new Error('Host key not found. Run npm run generate-keys first.');
    }

    // Sessions go to a temp directory, never ./data; the LLM URL points
    // at a closed port, so nothing here can reach Ollama.
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adventure-e2e-'));
    TEST_PORT = await freePort();
    serverProcess = spawn('node', ['src/server/index.js'], {
      env: {
        ...process.env,
        SSH_PORT: String(TEST_PORT),
        SSH_HOST: '127.0.0.1',
        SESSIONS_FILE_PATH: path.join(dataDir, 'sessions.json'),
        OLLAMA_BASE_URL: 'http://127.0.0.1:9'
      },
      stdio: 'pipe'
    });

    // Wait until the server listens
    await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error(`Server did not start: ${output}`)), 10000);
      const onData = (chunk) => {
        output += chunk.toString();
        if (output.includes('listening')) {
          clearTimeout(timer);
          resolve();
        }
      };
      serverProcess.stdout.on('data', onData);
      serverProcess.stderr.on('data', onData);
      serverProcess.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Server exited (${code}): ${output}`));
      });
    });
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
    if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('should accept SSH connection', (t, done) => {
    const conn = new Client();
    // No key: anonymous through keyboard-interactive, no prompts.
    conn.on('keyboard-interactive', (_name, _instructions, _lang, _prompts, finish) => finish([]));

    conn.on('ready', () => {
      conn.end();
      done();
    });

    conn.on('error', (err) => {
      done(err);
    });

    conn.connect({
      host: 'localhost',
      port: TEST_PORT,
      username: 'test',
      tryKeyboard: true
    });
  });

  it('should accept anonymous connection', (t, done) => {
    const conn = new Client();
    // No key: anonymous through keyboard-interactive, no prompts.
    conn.on('keyboard-interactive', (_name, _instructions, _lang, _prompts, finish) => finish([]));
    let shellReceived = false;

    conn.on('ready', () => {
      conn.shell((err, stream) => {
        if (err) {
          conn.end();
          return done(err);
        }

        shellReceived = true;
        stream.end();
        conn.end();
      });
    });

    conn.on('end', () => {
      if (shellReceived) {
        done();
      } else {
        done(new Error('Shell not received'));
      }
    });

    conn.on('error', (err) => {
      done(err);
    });

    conn.connect({
      host: 'localhost',
      port: TEST_PORT,
      username: 'test',
      tryKeyboard: true
    });
  });

  it('should render the menu in a pty, resize, and quit on q', (t, done) => {
    const conn = new Client();
    // No key: anonymous through keyboard-interactive, no prompts.
    conn.on('keyboard-interactive', (_name, _instructions, _lang, _prompts, finish) => finish([]));
    let output = '';
    let step = 'menu';
    const plain = () => output.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '');
    const fail = (err) => {
      conn.end();
      done(err);
    };

    conn.on('ready', () => {
      conn.shell({ cols: 80, rows: 24, term: 'xterm-256color' }, (err, stream) => {
        if (err) return fail(err);
        let exitCode = null;
        stream.on('exit', (code) => { exitCode = code; });
        stream.on('data', (data) => {
          output += data.toString();
          if (step === 'menu' && plain().includes('Terminal Adventure › Menu') && plain().includes('q quit')) {
            assert.ok(plain().includes('Start new adventure'));
            assert.ok(!plain().includes('Exit'));
            step = 'resize';
            output = '';
            stream.setWindow(30, 100, 0, 0);
          } else if (step === 'resize' && plain().split('\r\n').length >= 30) {
            step = 'quit';
            stream.write('q');
          }
        });
        stream.on('close', () => {
          try {
            assert.equal(step, 'quit', 'went through the menu and the resize');
            assert.ok(output.includes('\u001B[?1049l'), 'left the alternate screen');
            assert.equal(exitCode, 0);
            conn.end();
            done();
          } catch (e) {
            fail(e);
          }
        });
      });
    });

    conn.on('error', fail);

    conn.connect({
      host: 'localhost',
      port: TEST_PORT,
      username: 'e2e-player',
      tryKeyboard: true
    });
  });

  /** Connect and resolve once signed in; reject with ssh2's error. */
  function signIn(options) {
    const conn = new Client();
    conn.on('keyboard-interactive', (_name, _instructions, _lang, _prompts, finish) => finish([]));
    return new Promise((resolve, reject) => {
      conn.on('ready', () => {
        conn.end();
        resolve();
      });
      conn.on('error', reject);
      conn.connect({ host: 'localhost', port: TEST_PORT, username: 'test', readyTimeout: 5000, ...options });
    });
  }

  it('accepts a client key (the server checks its signature)', async () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' }
    });
    await signIn({ privateKey, tryKeyboard: false });
  });

  it('turns away none and passwords (OpenSSH would never offer its keys)', async () => {
    await assert.rejects(signIn({ tryKeyboard: false }), /authentication methods failed/);
    await assert.rejects(signIn({ password: 'test', tryKeyboard: false }), /authentication methods failed/);
  });

  const plainText = (text) => text.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '');
  const rsaKey = () => generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  }).privateKey;
  async function until(predicate, what, timeout = 5000) {
    const deadline = Date.now() + timeout;
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  /**
   * Sign in, open an 80x24 shell and wait for the menu; then(stream) runs
   * (default: quit with q). Resolves with the menu as first drawn, as plain
   * text, once the shell closes.
   */
  function openMenu(options, then = (stream) => stream.write('q')) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on('keyboard-interactive', (_name, _instructions, _lang, _prompts, finish) => finish([]));
      let output = '';
      let menu = null;
      const fail = (err) => {
        conn.end();
        reject(err);
      };
      conn.on('ready', () => {
        conn.shell({ cols: 80, rows: 24, term: 'xterm-256color' }, (err, stream) => {
          if (err) return fail(err);
          stream.on('data', (data) => {
            output += data.toString();
            const text = plainText(output);
            if (menu === null && text.includes('Terminal Adventure › Menu') && text.includes('q quit')) {
              menu = text;
              Promise.resolve(then(stream)).catch(fail);
            }
          });
          stream.on('close', () => {
            conn.end();
            resolve(menu ?? '');
          });
        });
      });
      conn.on('error', reject);
      conn.connect({ host: 'localhost', port: TEST_PORT, readyTimeout: 5000, tryKeyboard: true, ...options });
    });
  }

  it('a saved game belongs to the SSH key, not to the login name', async () => {
    const sessionsFile = path.join(dataDir, 'sessions.json');
    const savedGames = () => (fs.existsSync(sessionsFile) ? JSON.parse(fs.readFileSync(sessionsFile, 'utf8')) : [])
      .filter((entry) => entry.gameState);
    const adaKey = rsaKey();

    // Ada starts a game. The turn is saved before the Game Master is asked
    // (who cannot be reached here), so the save is there to come back to.
    const first = await openMenu({ username: 'ada', privateKey: adaKey }, async (stream) => {
      stream.write('\r');
      await until(() => savedGames().length === 1, 'the save');
      stream.write('q');
    });
    assert.ok(first.includes('Start new adventure'));
    assert.ok(!first.includes('not saved'));
    assert.equal(savedGames()[0].username, 'ada');
    assert.match(savedGames()[0].owner, /^SHA256:/);

    const otherKey = await openMenu({ username: 'ada', privateKey: rsaKey() });
    assert.ok(!otherKey.includes('Continue adventure'), 'another key with the same name gets no game');
    const noKey = await openMenu({ username: 'ada' });
    assert.ok(!noKey.includes('Continue adventure'), 'no key with the same name gets no game');
    assert.ok(noKey.includes('no game · not saved'));

    const sameKey = await openMenu({ username: 'ada-laptop', privateKey: adaKey });
    assert.ok(sameKey.includes('Continue adventure'), 'the same key resumes under another name');
    assert.equal(savedGames().length, 1, 'nothing saved for the other two');
  });
});
