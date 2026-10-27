import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import React, { useState } from 'react';
import xterm from '@xterm/headless';
import { serve, toCrlf, Screen, Panel, SelectList, Text, useApp, useInput } from '../src/index.js';
import { cleanupTerminals, tick, keys } from '../src/testing.js';
import { FakeSshChannel as FakeChannel, FakeSshSession as FakeSession } from '../src/testing.js';

// A test that fails halfway would leave its session mounted; a live timer
// in it (spinner, refresh, animation) would keep this file's process alive.
afterEach(() => cleanupTerminals());

const { Terminal } = xterm;
const h = React.createElement;

function App() {
  const [index, setIndex] = useState(0);
  const { exit } = useApp();
  useInput((input) => {
    if (input === 'q') exit();
  });
  return h(
    Screen,
    { app: 'Demo', screen: 'Home', meta: 'meta', hints: [['↑↓', 'move'], ['q', 'quit']], message: `row ${index}` },
    h(
      Panel,
      { title: 'Menu', focused: true, padding: 0 },
      h(SelectList, {
        items: [{ label: 'One' }, { label: 'Two' }, { label: 'Three' }],
        selectedIndex: index,
        onChange: setIndex
      })
    )
  );
}

/** A client: a headless xterm fed by a fake channel running serve(). */
function connect({ cols = 80, rows = 24, ...options } = {}) {
  const term = new Terminal({ cols, rows, allowProposedApi: true, scrollback: 100 });
  const channel = new FakeChannel((text, callback) => term.write(text, callback));
  const session = new FakeSession();
  const cleanup = serve(channel, { cols, rows, term: 'xterm-256color' }, h(App), { session, ...options });
  const screen = () => {
    const buffer = term.buffer.active;
    return Array.from({ length: term.rows }, (_, y) => buffer.getLine(buffer.baseY + y)?.translateToString(true) ?? '');
  };
  return { term, channel, session, cleanup, screen };
}

describe('serve() over a fake SSH channel', () => {
  it('sets the stream up as a TTY of the pty size with a no-op setRawMode', async () => {
    const { channel, cleanup } = connect({ cols: 100, rows: 30 });
    assert.equal(channel.columns, 100);
    assert.equal(channel.rows, 30);
    assert.equal(channel.isTTY, true);
    assert.equal(typeof channel.setRawMode, 'function');
    cleanup();
    await tick(20);
  });

  it('defaults to 80x24 without a pty', async () => {
    const channel = new FakeChannel();
    const cleanup = serve(channel, null, h(App));
    assert.equal(channel.columns, 80);
    assert.equal(channel.rows, 24);
    cleanup();
    await tick(20);
  });

  it('draws a full screen in the alternate buffer without scrolling', async () => {
    const { term, channel, screen, cleanup } = connect();
    await tick(60);
    const raw = channel.output.join('');
    assert.ok(raw.startsWith('\u001B[?1049h'), 'enters the alternate screen first');
    assert.equal(term.buffer.active.type, 'alternate');
    assert.equal(term.buffer.active.baseY, 0, 'nothing scrolled');
    const out = screen();
    assert.ok(out[0].startsWith(' Demo › Home'), out[0]);
    assert.ok(out[1].startsWith('╭─ Menu'), out[1]);
    assert.ok(out[2].startsWith('│ › One'), out[2]);
    assert.ok(out[22].startsWith('╰'), out[22]);
    assert.ok(out[23].startsWith(' ↑↓ move  q quit'), out[23]);
    assert.ok(out[23].endsWith('i row 0'), out[23]);
    cleanup();
    await tick(20);
  });

  it('writes CRLF line ends only (the client terminal is raw)', async () => {
    const { channel, cleanup } = connect();
    await tick(60);
    const raw = channel.output.join('');
    assert.ok(raw.includes('\r\n'));
    assert.ok(!/[^\r]\n/.test(raw), 'no bare LF');
    assert.equal(toCrlf('a\nb\r\nc'), 'a\r\nb\r\nc');
    cleanup();
    await tick(20);
  });

  it('sends ANSI colors (16-color codes only)', async () => {
    const { channel, cleanup } = connect();
    await tick(60);
    const raw = channel.output.join('');
    assert.ok(raw.includes('\u001B[36m'), 'cyan');
    assert.ok(raw.includes('\u001B[2m'), 'dim (muted text, default borders)');
    assert.ok(!raw.includes('\u001B[90m'), 'no bright black');
    assert.ok(raw.includes('\u001B[46m'), 'cyan background on the selected row');
    assert.ok(!/\u001B\[(?:3|4)8;/.test(raw), 'no 256/truecolor codes');
    cleanup();
    await tick(20);
  });

  it('redraws only what changed on a key press', async () => {
    const { channel, screen, cleanup } = connect();
    await tick(60);
    channel.takeOutput();
    channel.type(keys.down);
    await tick(80);
    const update = channel.takeOutput();
    assert.ok(update.length < 800, `incremental update is small (${update.length} bytes)`);
    assert.ok(!update.includes('\u001B[2J'), 'no full clear');
    const out = screen();
    assert.ok(out[3].startsWith('│ › Two'), out[3]);
    assert.ok(out[23].endsWith('i row 1'));
    cleanup();
    await tick(20);
  });

  it('follows window-change from the ssh session', async () => {
    const { term, session, screen, cleanup } = connect();
    await tick(60);
    for (const [cols, rows] of [[60, 18], [100, 30], [80, 24]]) {
      term.resize(cols, rows);
      assert.equal(session.windowChange(cols, rows), true, 'request accepted');
      await tick(80);
      const out = screen();
      assert.equal(term.buffer.active.baseY, 0);
      assert.ok(out[0].startsWith(' Demo › Home'), `${cols}x${rows} row 0: ${out[0]}`);
      assert.ok(out[1].startsWith('╭─ Menu') && out[1].endsWith('╮'), `${cols}x${rows} row 1: ${out[1]}`);
      assert.equal(out[1].length, cols);
      assert.ok(out[rows - 2].startsWith('╰'), `${cols}x${rows} row ${rows - 2}: ${out[rows - 2]}`);
      assert.ok(out[rows - 1].startsWith(' ↑↓ move'), `${cols}x${rows} last row: ${out[rows - 1]}`);
    }
    cleanup();
    await tick(20);
  });

  it('never draws the old layout into a smaller terminal', async () => {
    const { term, channel, session, cleanup } = connect();
    await tick(60);
    channel.takeOutput();
    term.resize(60, 18);
    session.windowChange(60, 18);
    await tick(80);
    const frames = channel.takeOutput().split('\u001B[?2026h').slice(1);
    assert.ok(frames.length > 0);
    for (const frame of frames) {
      const rows = frame.split('\r\n').length;
      assert.ok(rows <= 18, `a frame of ${rows} rows was drawn into 18`);
    }
    cleanup();
    await tick(20);
  });

  it('Ctrl-C unmounts, leaves the alternate screen and ends the stream', async () => {
    let exits = 0;
    const { term, channel, cleanup } = connect({ onExit: () => exits++ });
    await tick(60);
    channel.type(keys.ctrlC);
    await cleanup.exited;
    await tick(20);
    assert.equal(term.buffer.active.type, 'normal', 'back on the normal screen');
    assert.ok(channel.output.join('').includes('\u001B[?1049l'));
    assert.ok(channel.output.join('').endsWith('\u001B[?25h'), 'cursor shown again');
    assert.equal(channel.writableEnded, true);
    assert.equal(channel.exitCode, 0);
    assert.equal(exits, 1);
    cleanup(); // idempotent
    assert.equal(exits, 1);
  });

  it('q (handled by the app) ends the session the same way', async () => {
    const { term, channel, cleanup } = connect();
    await tick(60);
    channel.type('q');
    await cleanup.exited;
    await tick(20);
    assert.equal(term.buffer.active.type, 'normal');
    assert.equal(channel.writableEnded, true);
  });

  it('drains the channel after exit, so ssh2 can emit end/close', async () => {
    const { channel, cleanup } = connect();
    await tick(60);
    channel.type('q');
    await cleanup.exited;
    // The client acknowledges the close: ssh2 pushes EOF. Without a reader
    // 'end' (and so ssh2's 'close') would never fire.
    const ended = new Promise((resolve) => channel.once('end', resolve));
    channel.push(null);
    await Promise.race([ended, tick(200).then(() => assert.fail('no end event'))]);
  });

  it('a disconnect unmounts quietly and writes nothing more', async () => {
    const { channel, session, cleanup } = connect();
    await tick(60);
    assert.doesNotThrow(() => channel.disconnect());
    await cleanup.exited;
    channel.type = () => {};
    session.windowChange(100, 30); // listener removed: nothing happens
    await tick(50);
    assert.equal(channel.writesAfterClose, 0);
    assert.equal(session.listenerCount('window-change'), 0);
  });

  it('many concurrent sessions add no process listeners', async () => {
    const warnings = [];
    const onWarning = (w) => warnings.push(w);
    process.on('warning', onWarning);
    const before = process.listenerCount('beforeExit');
    const sessions = Array.from({ length: 15 }, () => connect());
    await tick(80);
    assert.equal(process.listenerCount('beforeExit'), before);
    for (const s of sessions) s.cleanup();
    await Promise.all(sessions.map((s) => s.cleanup.exited));
    await tick(20);
    process.off('warning', onWarning);
    assert.deepEqual(warnings.filter((w) => w.name === 'MaxListenersExceededWarning'), []);
  });

  it('cleanup() from the server side ends the session', async () => {
    const { term, channel, cleanup } = connect();
    await tick(60);
    cleanup();
    await cleanup.exited;
    await tick(20);
    assert.equal(term.buffer.active.type, 'normal');
    assert.equal(channel.writableEnded, true);
  });
});

describe('bold + dim', () => {
  it('Ink sends SGR 1, then 2, then one 22 for both; xterm.js keeps both flags', async () => {
    // Why the theme never combines muted (dim) with bold: SGR 1 and 2 share
    // the reset 22, and terminals with one "intensity" attribute (ECMA-48,
    // the Linux console) show only the one set last, here dim.
    const term = new Terminal({ cols: 20, rows: 3, allowProposedApi: true });
    const channel = new FakeChannel((text, callback) => term.write(text, callback));
    const cleanup = serve(channel, { cols: 20, rows: 3 }, h(Text, { bold: true, dimColor: true }, 'BD'));
    await tick(60);
    const raw = channel.output.join('');
    assert.match(raw, /\u001B\[1m\u001B\[2mBD\u001B\[22m/);
    const cell = term.buffer.active.getLine(0).getCell(0);
    assert.equal(Boolean(cell.isBold()), true);
    assert.equal(Boolean(cell.isDim()), true);
    cleanup();
    await cleanup.exited;
  });
});

describe('colors without a TTY', () => {
  it('a server process with no TTY and no FORCE_COLOR still sends colors', () => {
    const env = { ...process.env };
    for (const name of ['FORCE_COLOR', 'NO_COLOR', 'NODE_DISABLE_COLORS', 'COLORTERM', 'CI', 'GITHUB_ACTIONS', 'TERM']) {
      delete env[name];
    }
    const child = fileURLToPath(new URL('./helpers/color-child.js', import.meta.url));
    const result = spawnSync(process.execPath, [child], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout.trim().split('\n').at(-1));
    assert.equal(report.stdoutIsTTY, false, 'the child really has no TTY');
    assert.equal(report.forceColor, null, 'and no FORCE_COLOR');
    assert.equal(report.level, 1, 'chalk pinned to the 16 basic colors');
    assert.equal(report.cyan, true, 'output has \\e[36m');
    assert.equal(report.dim, true, 'output has \\e[2m');
  });

  it('imports ink first and is still colored', () => {
    const env = { ...process.env };
    delete env.FORCE_COLOR;
    delete env.NO_COLOR;
    const child = fileURLToPath(new URL('./helpers/color-child.js', import.meta.url));
    const result = spawnSync(process.execPath, [child, '--ink-first'], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout.trim().split('\n').at(-1));
    assert.equal(report.cyan, true);
  });

  it('FORCE_COLOR=0 turns colors off', () => {
    const env = { ...process.env, FORCE_COLOR: '0' };
    const child = fileURLToPath(new URL('./helpers/color-child.js', import.meta.url));
    const result = spawnSync(process.execPath, [child], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout.trim().split('\n').at(-1));
    assert.equal(report.level, 0);
    assert.equal(report.cyan, false);
    assert.equal(report.dim, false);
  });
});
