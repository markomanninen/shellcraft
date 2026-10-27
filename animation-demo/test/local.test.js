// The app as it runs: run() → renderLocal() on a fake TTY whose output goes
// into a headless xterm, so this is what the terminal would show.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import xterm from '@xterm/headless';
import { createFakeTty, boldDimText, tick } from '@shellcraft/ui/testing';
import { run } from '../app.js';

const { Terminal } = xterm;

const ENTER_ALT = '\u001B[?1049h';
const LEAVE_ALT = '\u001B[?1049l';
const SYNC_START = '\u001B[?2026h';

function local({ columns = 80, rows = 24 } = {}) {
  // convertEol: a local tty turns "\n" into CR LF (ONLCR).
  const term = new Terminal({ cols: columns, rows, allowProposedApi: true, convertEol: true });
  const tty = createFakeTty({ columns, rows, onOutput: (text, done) => term.write(text, done) });
  let exits = 0;
  const cleanup = run({ stdin: tty.stdin, stdout: tty.stdout, onExit: () => exits++ });
  const screen = () => {
    const b = term.buffer.active;
    return Array.from({ length: term.rows }, (_, y) => b.getLine(b.baseY + y)?.translateToString(true) ?? '');
  };
  return { term, tty, cleanup, screen, exits: () => exits };
}

describe('renderLocal (fake TTY, headless xterm)', () => {
  it('full screen in the alternate screen, animating, no frame taller than the terminal', async () => {
    const { term, tty, cleanup, screen } = local();
    await tick(80);
    assert.ok(tty.output.join('').startsWith(`${ENTER_ALT}\u001B[H\u001B[2J`));
    assert.equal(term.buffer.active.type, 'alternate');
    assert.equal(term.buffer.active.baseY, 0, 'nothing scrolled');
    assert.equal(tty.stdin.rawMode, true);

    let out = screen();
    assert.ok(out[0].startsWith(' Animation Demo › Crystal Ball'), out[0]);
    assert.ok(out[0].endsWith('speed 1.0×'), out[0]);
    assert.ok(out[1].startsWith('╭─ Crystal Ball ─'));
    assert.ok(out[1].endsWith('╮╭─ Animations ─────────────╮'));
    assert.ok(out[2].endsWith('│ › Crystal Ball         1 │'));
    assert.ok(out.some((line) => line.includes(".'''''''`.")), 'the crystal ball is on screen');
    assert.ok(out[22].startsWith('╰'));
    assert.ok(out[23].startsWith(' space pause  +/- speed  ←→ switch  1-7 jump  q quit'));
    assert.ok(out[23].endsWith('i Frame 1/4 · 350 ms'), out[23]);

    await tick(800);
    out = screen();
    assert.match(out[23], /i Frame [2-4]\/4 · 350 ms$/, 'the frames move on');
    assert.equal(term.buffer.active.baseY, 0);

    const all = tty.output.join('');
    assert.equal(boldDimText(all), '', 'nothing is bold and dim at once');
    for (const frame of all.split(SYNC_START).slice(1)) {
      assert.ok(frame.split('\n').length <= 24, 'no frame taller than the terminal');
    }
    cleanup();
    await cleanup.exited;
  });

  it('keys reach the app: switch, pause', async () => {
    const { tty, cleanup, screen } = local();
    await tick(60);
    tty.type('\u001B[C');
    await tick(60);
    assert.ok(screen()[0].startsWith(' Animation Demo › Bubbling Cauldron'));
    tty.type(' ');
    await tick(60);
    assert.ok(screen()[23].endsWith('! Paused · frame 1/5'), screen()[23]);
    tty.type('6');
    await tick(60);
    assert.ok(screen()[0].startsWith(' Animation Demo › DNA Helix'));
    cleanup();
    await cleanup.exited;
  });

  it('resizes to 100x30 without a frame of the old layout', async () => {
    const { term, tty, cleanup, screen } = local();
    await tick(60);
    tty.takeOutput();
    term.resize(100, 30);
    tty.resize(100, 30);
    await tick(80);
    const out = screen();
    assert.equal(term.buffer.active.baseY, 0);
    assert.ok(out[0].startsWith(' Animation Demo › Crystal Ball'));
    assert.equal(out[1].length, 100);
    assert.ok(out[28].startsWith('╰'));
    assert.ok(out[29].startsWith(' space pause'));
    cleanup();
    await cleanup.exited;
  });

  it('q leaves the alternate screen and releases raw mode', async () => {
    const { term, tty, cleanup, exits } = local();
    await tick(60);
    tty.type('q');
    await cleanup.exited;
    await tick(20);
    assert.equal(term.buffer.active.type, 'normal');
    assert.ok(tty.output.join('').includes(LEAVE_ALT));
    assert.equal(tty.stdin.rawMode, false);
    assert.equal(exits(), 1);
  });

  it('Ctrl-C leaves the alternate screen and releases raw mode', async () => {
    const { term, tty, cleanup, exits } = local();
    await tick(60);
    tty.type('\u0003');
    await cleanup.exited;
    await tick(20);
    assert.equal(term.buffer.active.type, 'normal');
    assert.ok(tty.output.join('').includes(LEAVE_ALT));
    assert.equal(tty.stdin.rawMode, false);
    assert.equal(exits(), 1);
    cleanup();
    assert.equal(exits(), 1, 'cleanup after exit is a no-op');
  });

  it('node index.js ends by itself after q (no process.exit, no timer left)', async () => {
    const entry = fileURLToPath(new URL('../index.js', import.meta.url));
    const child = spawn(process.execPath, [entry], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    const closed = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal })));
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);

    for (let i = 0; i < 50 && !out.includes('Frame 1/4'); i++) await tick(50);
    assert.ok(out.includes(ENTER_ALT), 'entered the alternate screen');
    assert.ok(out.includes('Crystal Ball'), 'drew the app');
    child.stdin.write('q');
    const { code, signal } = await closed;
    clearTimeout(timer);
    assert.equal(signal, null, `exited by itself, not killed (stderr: ${err})`);
    assert.equal(code, 0);
    assert.ok(out.includes(LEAVE_ALT), 'left the alternate screen');
  });
});
