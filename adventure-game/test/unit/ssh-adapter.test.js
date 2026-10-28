import { describe, it, before, after, afterEach } from 'node:test';
import { strict as assert } from 'assert';
import {
  FakeSshChannel,
  FakeSshSession,
  cleanupTerminals,
  waitFor,
  stripAnsi,
  keys,
  tick
} from '@shellcraft/ui/testing';
import { CommandRouter } from '../../src/server/router.js';
import { stubLlm, tempSessions, testKey } from '../helpers/adventure.js';

let log;
let store;
before(() => {
  log = console.log;
  console.log = (...args) => {
    if (typeof args[0] === 'string' && args[0].startsWith('[session]')) return;
    log(...args);
  };
  store = tempSessions();
});
after(() => {
  console.log = log;
  store.remove();
});

// A test that fails halfway would leave its session mounted, with the busy
// spinner animating forever: the file's process would never exit.
const gates = [];
afterEach(() => {
  for (const llm of gates.splice(0)) llm.release();
  cleanupTerminals();
});

/** Output the client has received and not taken yet, without ANSI codes. */
const pending = (channel) => stripAnsi(channel.output.join(''));

// The router hands the SSH channel to the ui package's serve(); check the
// bytes a client would receive, with a fake duplex stream as the channel
// and a stub LLM (nothing calls Ollama).
describe('SSH adapter (fake channel)', () => {
  it('renders the menu, plays a turn, resizes, quits on q', async () => {
    const channel = new FakeSshChannel((_text, callback) => callback());
    const sshSession = new FakeSshSession();
    const session = store.manager.createSession('ssh-player', testKey('ssh-player'));
    const llm = stubLlm({ gate: true });
    gates.push(llm);
    const router = new CommandRouter({ llm });
    const cleanup = router.handleConnection(channel, session, { cols: 80, rows: 24 }, store.manager, sshSession);
    await waitFor(() => pending(channel).includes('Start new adventure'), { message: 'the menu' });

    let out = channel.takeOutput();
    assert.ok(out.startsWith('\u001B[?1049h'), 'alternate screen');
    assert.ok(out.includes('\u001B[36m'), 'ANSI colors without a TTY');
    assert.ok(!/[^\r]\n/.test(out), 'CRLF line ends');
    assert.ok(stripAnsi(out).includes('Terminal Adventure › Menu'));
    assert.ok(stripAnsi(out).includes('Start new adventure'));

    channel.type(keys.enter);
    await waitFor(() => pending(channel).includes('The Game Master is thinking'), { message: 'the busy message' });
    channel.takeOutput();
    await waitFor(() => llm.pending() === 1, { message: 'the LLM call' });
    llm.release();
    await waitFor(() => pending(channel).includes('Lanterns sway over the village square.'), { message: 'the narration' });
    await waitFor(() => store.read().some((entry) => entry.username === 'ssh-player' && entry.gameState), { message: 'the save' });
    channel.takeOutput();
    assert.equal(session.gameState.moves, 1);
    assert.ok(store.read().some((entry) => entry.username === 'ssh-player' && entry.gameState), 'saved');

    assert.equal(sshSession.windowChange(100, 30), true);
    // A synchronized frame drawn after the clear: the full redraw.
    const redrawn = () => {
      const raw = channel.output.join('');
      return raw.indexOf('\u001B[?2026l', raw.indexOf('\u001B[2J')) > raw.indexOf('\u001B[2J') && raw.includes('\u001B[2J');
    };
    await waitFor(redrawn, { message: 'the redraw at 100x30' });
    assert.equal(channel.columns, 100);
    assert.equal(channel.rows, 30);
    out = channel.takeOutput();
    // The first synchronized frame after the clear is the full redraw (the
    // free-text field re-measures its 'fill' width in one more small update).
    const redraw = out.slice(out.indexOf('\u001B[2J'), out.indexOf('\u001B[?2026l'));
    assert.equal(stripAnsi(redraw).split('\r\n').length, 30, 'redrawn at 30 rows');
    assert.ok(stripAnsi(redraw).includes('Terminal Adventure › Village Square'));

    channel.type('q');
    await cleanup.exited;
    assert.ok(channel.output.join('').includes('\u001B[?1049l'), 'leaves the alternate screen');
    assert.equal(channel.writableEnded, true);
    assert.equal(channel.exitCode, 0);
  });

  it('Ctrl-C ends the session; a disconnect while the LLM thinks does not throw', async () => {
    const session = store.manager.createSession('ssh-other', testKey('ssh-other'));
    const a = new FakeSshChannel((_t, cb) => cb());
    const cleanupA = new CommandRouter({ llm: stubLlm() }).handleConnection(a, session, null, store.manager);
    await waitFor(() => pending(a).includes('Start new adventure'), { message: 'the menu' });
    a.type(keys.ctrlC);
    await cleanupA.exited;
    assert.equal(a.writableEnded, true);

    const llm = stubLlm({ gate: true });
    gates.push(llm);
    const b = new FakeSshChannel((_t, cb) => cb());
    const cleanupB = new CommandRouter({ llm }).handleConnection(b, session, { cols: 80, rows: 24 }, store.manager);
    await waitFor(() => pending(b).includes('Start new adventure'), { message: 'the menu' });
    b.type(keys.enter); // start a game: the LLM is now busy
    await waitFor(() => llm.pending() === 1, { message: 'the LLM call' });
    assert.doesNotThrow(() => b.disconnect());
    await cleanupB.exited;
    llm.release(); // the narration arrives after the client left
    await waitFor(() => session.gameState?.lastResponse?.room_name === 'Village Square', { message: 'the saved turn' });
    await tick(20);
    assert.equal(b.writesAfterClose, 0);
  });
});
