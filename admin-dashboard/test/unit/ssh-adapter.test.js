import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { FakeSshChannel, FakeSshSession, stripAnsi, keys, tick } from '@shellcraft/ui/testing';
import { CommandRouter } from '../../src/server/router.js';
import { SessionManager } from '../../src/server/session.js';
import { DemoSystem } from '../helpers/demo-system.js';

// The router hands the SSH channel to the ui package's serve(); check the
// bytes a client would receive, with a fake duplex stream as the channel.
describe('SSH adapter (fake channel)', () => {
  it('keeps the old router API', () => {
    const router = new CommandRouter();
    assert.deepEqual(Object.keys(router.screens).sort(),
      ['dashboard', 'logs', 'network', 'overview', 'processes', 'resources', 'services', 'settings']);
  });

  it('renders the dashboard, follows keys and resizes, quits on q', async () => {
    const channel = new FakeSshChannel((_text, callback) => callback());
    const sshSession = new FakeSshSession();
    const session = new SessionManager().createSession(null);
    const router = new CommandRouter({ system: new DemoSystem() });
    const cleanup = router.handleConnection(channel, session, { cols: 80, rows: 24, term: 'xterm-256color' }, sshSession);
    await tick(80);

    let out = channel.takeOutput();
    assert.ok(out.startsWith('\u001B[?1049h'), 'alternate screen');
    assert.ok(out.includes('\u001B[36m'), 'ANSI colors without a TTY');
    assert.ok(!/[^\r]\n/.test(out), 'CRLF line ends');
    assert.ok(stripAnsi(out).includes('Admin › Dashboard'));
    assert.ok(stripAnsi(out).includes('demo-server'));
    assert.ok(stripAnsi(out).includes('System overview'));

    channel.type('7');
    await tick(50);
    channel.type(keys.enter);
    await tick(80);
    out = stripAnsi(channel.takeOutput());
    assert.ok(out.includes('Settings'), out);
    assert.ok(out.includes('xterm-256color'), 'the client terminal type from the pty');
    assert.ok(out.includes(session.id));

    assert.equal(sshSession.windowChange(100, 30), true);
    await tick(80);
    assert.equal(channel.columns, 100);
    assert.equal(channel.rows, 30);
    out = channel.takeOutput();
    assert.equal(stripAnsi(out).split('\r\n').length, 30, 'redrawn at 30 rows');
    assert.ok(stripAnsi(out).includes('100×30'), 'settings shows the new size');

    channel.type('b');
    await tick(80);
    // Incremental rendering: rows are rewritten from the first changed cell.
    out = stripAnsi(channel.takeOutput());
    assert.ok(out.startsWith('Dashboard'), out.slice(0, 40));
    assert.ok(out.includes('Menu ─'));

    channel.type('q');
    await cleanup.exited;
    assert.ok(channel.output.join('').includes('\u001B[?1049l'), 'leaves the alternate screen');
    assert.equal(channel.writableEnded, true);
    assert.equal(channel.exitCode, 0);
  });

  it('Ctrl-C ends the session; a disconnect stops live refresh and does not throw', async () => {
    const session = new SessionManager().createSession(null);
    const a = new FakeSshChannel((_t, cb) => cb());
    const cleanupA = new CommandRouter({ system: new DemoSystem() }).handleConnection(a, session, null);
    await tick(50);
    a.type(keys.ctrlC);
    await cleanupA.exited;
    assert.equal(a.writableEnded, true);
    assert.equal(a.exitCode, 0);

    // The real refresh period: the overview summary polls every 2 s.
    const system = new DemoSystem();
    const b = new FakeSshChannel((_t, cb) => cb());
    const cleanupB = new CommandRouter({ system }).handleConnection(b, session, { cols: 80, rows: 24 });
    await tick(2100);
    const polled = system.calls.getCPUPercent;
    assert.ok(polled >= 2, `live refresh while connected (${polled})`);
    assert.doesNotThrow(() => b.disconnect());
    await cleanupB.exited;
    assert.equal(b.writesAfterClose, 0);
    await tick(2100);
    assert.equal(system.calls.getCPUPercent, polled, 'no refresh after the disconnect');
  });
});
