import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { useState } from 'react';
import xterm from '@xterm/headless';
import { renderLocal, useInterval, Screen, Panel, Text, useApp, useInput } from '../src/index.js';
import { renderTerminal, cleanupTerminals, createFakeTty, boldDimText, tick } from '../src/testing.js';

const { Terminal } = xterm;
const h = React.createElement;

afterEach(() => cleanupTerminals());

describe('useInterval', () => {
  it('calls the latest callback every ms and stops on unmount', async () => {
    const calls = [];
    function Ticker({ label, ms }) {
      const [n, setN] = useState(0);
      useInterval(() => {
        calls.push(label);
        setN((x) => x + 1);
      }, ms);
      return h(Text, null, `${label} ${n}`);
    }
    const t = renderTerminal(h(Ticker, { label: 'a', ms: 20 }), { columns: 20, rows: 2 });
    await tick(110);
    assert.ok(calls.length >= 3, `called ${calls.length} times`);
    t.rerender(h(Ticker, { label: 'b', ms: 20 }));
    await tick(70);
    assert.equal(calls.at(-1), 'b', 'latest callback, same timer');
    assert.match(t.text(), /^b \d+/);
    t.unmount();
    const after = calls.length;
    await tick(80);
    assert.equal(calls.length, after, 'cleared on unmount');
  });

  it('null pauses it', async () => {
    let count = 0;
    function Paused() {
      useInterval(() => count++, null);
      return h(Text, null, 'paused');
    }
    const t = renderTerminal(h(Paused), { columns: 20, rows: 2 });
    await tick(60);
    assert.equal(count, 0);
    t.unmount();
  });
});

function App() {
  const { exit } = useApp();
  const [n, setN] = useState(0);
  useInput((input) => {
    if (input === 'x') exit();
    if (input === '+') setN((v) => v + 1);
  });
  return h(
    Screen,
    { app: 'Animation', screen: 'Demo', meta: `n=${n}`, hints: [['q', 'quit']] },
    h(Panel, { title: 'Stage', focused: true }, h(Text, null, 'frame'))
  );
}

/** A local terminal: a headless xterm behind fake TTY streams. */
function local({ columns = 80, rows = 24, options = {} } = {}) {
  // convertEol: a local tty turns "\n" into CR LF (ONLCR), which an SSH
  // client terminal does not; renderLocal relies on it, serve() does not.
  const term = new Terminal({ cols: columns, rows, allowProposedApi: true, convertEol: true });
  const tty = createFakeTty({ columns, rows, onOutput: (text, done) => term.write(text, done) });
  const cleanup = renderLocal(h(App), { stdin: tty.stdin, stdout: tty.stdout, ...options });
  const screen = () => {
    const b = term.buffer.active;
    return Array.from({ length: term.rows }, (_, y) => b.getLine(b.baseY + y)?.translateToString(true) ?? '');
  };
  return { term, tty, cleanup, screen };
}

describe('renderLocal', () => {
  it('fills the terminal in the alternate screen, raw mode on', async () => {
    const { term, tty, cleanup, screen } = local();
    await tick(60);
    assert.ok(tty.output.join('').startsWith('\u001B[?1049h\u001B[H\u001B[2J'));
    assert.equal(term.buffer.active.type, 'alternate');
    assert.equal(term.buffer.active.baseY, 0);
    const out = screen();
    assert.ok(out[0].startsWith(' Animation › Demo'));
    assert.ok(out[1].startsWith('╭─ Stage'));
    assert.ok(out[22].startsWith('╰'));
    assert.ok(out[23].startsWith(' q quit'));
    assert.equal(tty.stdin.rawMode, true);
    assert.equal(boldDimText(tty.output.join('')), '');
    cleanup();
    await cleanup.exited;
  });

  it('follows stdout resize without drawing the old layout', async () => {
    const { term, tty, cleanup, screen } = local();
    await tick(60);
    tty.takeOutput();
    term.resize(60, 18);
    tty.resize(60, 18);
    await tick(80);
    for (const frame of tty.takeOutput().split('\u001B[?2026h').slice(1)) {
      assert.ok(frame.split('\n').length <= 18, 'no frame taller than the terminal');
    }
    const out = screen();
    assert.equal(term.buffer.active.baseY, 0);
    assert.ok(out[0].startsWith(' Animation › Demo'));
    assert.equal(out[1].length, 60);
    assert.ok(out[16].startsWith('╰'));
    assert.ok(out[17].startsWith(' q quit'));
    cleanup();
    await cleanup.exited;
  });

  it('Ctrl-C leaves the alternate screen and releases raw mode', async () => {
    let exits = 0;
    const { term, tty, cleanup } = local({ options: { onExit: () => exits++ } });
    await tick(60);
    tty.type('\u0003');
    await cleanup.exited;
    await tick(20);
    assert.equal(term.buffer.active.type, 'normal');
    assert.ok(tty.output.join('').includes('\u001B[?1049l'));
    assert.equal(tty.stdin.rawMode, false);
    assert.equal(exits, 1);
    cleanup();
    assert.equal(exits, 1, 'idempotent');
  });

  it('quitKeys and the app’s own exit() end it the same way', async () => {
    const a = local({ options: { quitKeys: ['q'] } });
    await tick(60);
    a.tty.type('q');
    await a.cleanup.exited;
    await tick(20);
    assert.equal(a.term.buffer.active.type, 'normal');

    const b = local();
    await tick(60);
    b.tty.type('q'); // not a quit key by default
    await tick(40);
    assert.equal(b.term.buffer.active.type, 'alternate');
    b.tty.type('x'); // the app calls exit()
    await b.cleanup.exited;
    await tick(20);
    assert.equal(b.term.buffer.active.type, 'normal');
  });

  it('keys reach the app', async () => {
    const { tty, cleanup, screen } = local();
    await tick(60);
    tty.type('+');
    await tick(60);
    assert.ok(screen()[0].endsWith('n=1'));
    cleanup();
    await cleanup.exited;
  });
});
