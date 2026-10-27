import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'assert';
import { FakeSshChannel, FakeSshSession, stripAnsi, keys, tick } from '@shellcraft/ui/testing';
import { CommandRouter } from '../../src/server/router.js';
import { stubLlm, tempSessions } from '../helpers/adventure.js';

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

// The router hands the SSH channel to the ui package's serve(); check the
// bytes a client would receive, with a fake duplex stream as the channel
// and a stub LLM (nothing calls Ollama).
describe('SSH adapter (fake channel)', () => {
  it('renders the menu, plays a turn, resizes, quits on q', async () => {
    const channel = new FakeSshChannel((_text, callback) => callback());
    const sshSession = new FakeSshSession();
    const session = store.manager.createSession('ssh-player');
    const llm = stubLlm({ gate: true });
    const router = new CommandRouter({ llm });
    const cleanup = router.handleConnection(channel, session, { cols: 80, rows: 24 }, store.manager, sshSession);
    await tick(80);

    let out = channel.takeOutput();
    assert.ok(out.startsWith('\u001B[?1049h'), 'alternate screen');
    assert.ok(out.includes('\u001B[36m'), 'ANSI colors without a TTY');
    assert.ok(!/[^\r]\n/.test(out), 'CRLF line ends');
    assert.ok(stripAnsi(out).includes('Terminal Adventure › Menu'));
    assert.ok(stripAnsi(out).includes('Start new adventure'));

    channel.type(keys.enter);
    await tick(80);
    out = stripAnsi(channel.takeOutput());
    assert.ok(out.includes('The Game Master is thinking'), out);
    llm.release();
    await tick(80);
    out = stripAnsi(channel.takeOutput());
    assert.ok(out.includes('Lanterns sway over the village square.'), out);
    assert.equal(session.gameState.moves, 1);
    assert.ok(store.read().some((entry) => entry.username === 'ssh-player' && entry.gameState), 'saved');

    assert.equal(sshSession.windowChange(100, 30), true);
    await tick(80);
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
    const session = store.manager.createSession('ssh-other');
    const a = new FakeSshChannel((_t, cb) => cb());
    const cleanupA = new CommandRouter({ llm: stubLlm() }).handleConnection(a, session, null, store.manager);
    await tick(50);
    a.type(keys.ctrlC);
    await cleanupA.exited;
    assert.equal(a.writableEnded, true);

    const llm = stubLlm({ gate: true });
    const b = new FakeSshChannel((_t, cb) => cb());
    const cleanupB = new CommandRouter({ llm }).handleConnection(b, session, { cols: 80, rows: 24 }, store.manager);
    await tick(50);
    b.type(keys.enter); // start a game: the LLM is now busy
    await tick(50);
    assert.equal(llm.pending(), 1);
    assert.doesNotThrow(() => b.disconnect());
    await cleanupB.exited;
    llm.release(); // the narration arrives after the client left
    await tick(50);
    assert.equal(b.writesAfterClose, 0);
    assert.equal(session.gameState.lastResponse.room_name, 'Village Square', 'the turn is still saved');
  });
});
