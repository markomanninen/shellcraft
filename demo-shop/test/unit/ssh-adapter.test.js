import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'assert';
import { cleanupTerminals, FakeSshChannel, FakeSshSession, stripAnsi, keys, tick } from '@shellcraft/ui/testing';
import { CommandRouter } from '../../src/server/router.js';
import { SessionManager } from '../../src/server/session.js';

// A test that fails halfway would leave its session mounted; a live timer
// in it (spinner, refresh, animation) would keep this file's process alive.
afterEach(() => cleanupTerminals());

// The router hands the SSH channel to the ui package's serve(); check the
// bytes a client would receive, with a fake duplex stream as the channel.
describe('SSH adapter (fake channel)', () => {
  it('renders the shop, follows keys and resizes, quits on q', async () => {
    const channel = new FakeSshChannel((_text, callback) => callback());
    const sshSession = new FakeSshSession();
    const session = new SessionManager().createSession(null);
    const cleanup = new CommandRouter().handleConnection(channel, session, { cols: 80, rows: 24 }, sshSession);
    await tick(80);

    let out = channel.takeOutput();
    assert.ok(out.startsWith('\u001B[?1049h'), 'alternate screen');
    assert.ok(out.includes('\u001B[36m'), 'ANSI colors without a TTY');
    assert.ok(!/[^\r]\n/.test(out), 'CRLF line ends');
    assert.ok(stripAnsi(out).includes('Demo Shop › Home'));
    assert.ok(stripAnsi(out).includes('Browse products'));

    channel.type(keys.enter);
    await tick(80);
    channel.type('a');
    await tick(80);
    out = stripAnsi(channel.takeOutput());
    assert.ok(out.includes('Added Developer Blend to cart'), out);
    assert.equal(session.cart.length, 1);

    assert.equal(sshSession.windowChange(100, 30), true);
    await tick(80);
    assert.equal(channel.columns, 100);
    assert.equal(channel.rows, 30);
    out = channel.takeOutput();
    assert.equal(stripAnsi(out).split('\r\n').length, 30, 'redrawn at 30 rows');

    channel.type('q');
    await cleanup.exited;
    assert.ok(channel.output.join('').includes('\u001B[?1049l'), 'leaves the alternate screen');
    assert.equal(channel.writableEnded, true);
    assert.equal(channel.exitCode, 0);
  });

  it('Ctrl-C ends the session; a disconnect does not throw', async () => {
    const session = new SessionManager().createSession(null);
    const a = new FakeSshChannel((_t, cb) => cb());
    const cleanupA = new CommandRouter().handleConnection(a, session, null);
    await tick(50);
    a.type(keys.ctrlC);
    await cleanupA.exited;
    assert.equal(a.writableEnded, true);

    const b = new FakeSshChannel((_t, cb) => cb());
    const cleanupB = new CommandRouter().handleConnection(b, session, { cols: 80, rows: 24 });
    await tick(50);
    assert.doesNotThrow(() => b.disconnect());
    await cleanupB.exited;
    assert.equal(b.writesAfterClose, 0);
  });
});
