import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'assert';
import { Client } from 'ssh2';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('SSH Server E2E', () => {
  let serverProcess;
  const TEST_PORT = 2223;

  before(async () => {
    // Ensure keys exist
    if (!fs.existsSync('./keys/host_key')) {
      throw new Error('Host key not found. Run npm run generate-keys first.');
    }

    // Start server in test mode
    serverProcess = spawn('node', ['src/server/index.js'], {
      env: { ...process.env, SSH_PORT: TEST_PORT },
      stdio: 'pipe'
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('should accept SSH connection', (t, done) => {
    const conn = new Client();
    
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
      password: 'test' // Will be rejected but connection should work
    });
  });

  it('should accept anonymous connection', (t, done) => {
    const conn = new Client();
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
      tryKeyboard: false
    });
  });

  it('should render the shop in a pty, resize, and quit on q', (t, done) => {
    const conn = new Client();
    let output = '';
    let step = 'home';
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
          if (step === 'home' && plain().includes('Demo Shop › Home')) {
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
            assert.equal(step, 'quit', 'went through home and resize');
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
      username: 'test',
      tryKeyboard: false
    });
  });
});
