import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import {
  parseProcesses, parseServices, processRows, networkRows, formatKB, shortCommand, netmaskLabel
} from '../../src/ui/tables.js';
import { DEMO_PROCESSES, DEMO_SERVICES, DEMO_LAUNCHD, DEMO_NETWORK } from '../helpers/demo-system.js';

// macOS `ps aux`: STARTED instead of START, TT instead of TTY, paths with spaces.
const MAC_PS = `USER               PID  %CPU %MEM      VSZ    RSS   TT  STAT STARTED      TIME COMMAND
demo             41235  12.3  1.2 412345678 198765   ??  S     9:41PM   1:23.45 /Applications/Demo App.app/Contents/MacOS/Demo App --flag
_windowserver      151   5.0  0.6 413000000  98304   ??  Ss   Mon09AM  80:12.34 /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon
`;

describe('parseProcesses', () => {
  it('reads Linux ps aux, keeping spaces in the command', () => {
    const processes = parseProcesses(DEMO_PROCESSES);
    assert.equal(processes.length, 9);
    assert.deepEqual(processes[0], {
      user: 'root', pid: '1', cpu: '0.0', mem: '0.1', rss: '13120', time: '0:09', command: '/sbin/init splash'
    });
    assert.equal(processes[6].command, 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups');
    assert.deepEqual(processRows(processes)[5], ['2210', 'demo', '12.5', '6.1', '980.0M', '58:01', 'node /srv/app/server.js --port 8080']);
  });

  it('reads macOS ps aux', () => {
    const processes = parseProcesses(MAC_PS);
    assert.equal(processes.length, 2);
    assert.equal(processes[0].pid, '41235');
    assert.equal(processes[0].time, '1:23.45');
    assert.equal(processes[0].command, '/Applications/Demo App.app/Contents/MacOS/Demo App --flag');
    assert.equal(processes[1].user, '_windowserver');
  });

  it('returns null for the model error texts', () => {
    assert.equal(parseProcesses('Error fetching processes'), null);
    assert.equal(parseProcesses('Process listing not available on this platform'), null);
    assert.equal(parseProcesses(''), null);
    assert.deepEqual(parseProcesses('USER PID %CPU COMMAND\n'), []);
  });
});

describe('parseServices', () => {
  it('reads systemctl list-units up to the legend', () => {
    const services = parseServices(DEMO_SERVICES);
    assert.equal(services.manager, 'systemd');
    assert.deepEqual(services.columns.map((c) => c.label), ['Unit', 'Load', 'Active', 'Sub', 'Description']);
    assert.equal(services.rows.length, 13);
    assert.deepEqual(services.rows[0], ['cron.service', 'loaded', 'active', 'running', 'Regular background program processing daemon']);
    assert.equal(services.names.at(-1), 'unattended-upgrades.service');
    assert.equal(services.columns.filter((c) => c.grow).length, 1, 'one grow column');
  });

  it('strips the failed-unit marker', () => {
    const text = 'UNIT LOAD ACTIVE SUB DESCRIPTION\n● broken.service loaded failed failed Broken thing\n';
    assert.deepEqual(parseServices(text).rows[0], ['broken.service', 'loaded', 'failed', 'failed', 'Broken thing']);
  });

  it('reads launchctl list', () => {
    const services = parseServices(DEMO_LAUNCHD);
    assert.equal(services.manager, 'launchd');
    assert.deepEqual(services.columns.map((c) => [c.label, c.align ?? 'left']), [['PID', 'right'], ['Status', 'right'], ['Label', 'left']]);
    assert.deepEqual(services.rows[2], ['-', '-9', 'com.apple.homed']);
    assert.deepEqual(services.rows[3], ['1022', '0', 'com.example.backup agent']);
  });

  it('returns null for anything else', () => {
    assert.equal(parseServices('Error fetching services'), null);
    assert.equal(parseServices('Service listing not available on this platform'), null);
    assert.equal(parseServices(''), null);
  });
});

describe('cell formatting', () => {
  it('formatKB', () => {
    assert.equal(formatKB('512'), '512K');
    assert.equal(formatKB('13120'), '12.8M');
    assert.equal(formatKB(String(3 * 1024 * 1024)), '3.0G');
    assert.equal(formatKB('-'), '-');
    assert.equal(formatKB(''), '');
  });

  it('shortCommand cuts the executable path to its name', () => {
    assert.equal(shortCommand('/usr/sbin/sshd -D'), 'sshd -D');
    assert.equal(shortCommand('/usr/bin/python3 /opt/app/run.py'), 'python3 /opt/app/run.py');
    assert.equal(shortCommand('/Applications/Demo App.app/Contents/MacOS/Demo App --flag'), 'Demo App --flag');
    assert.equal(shortCommand('/sbin/launchd'), 'launchd');
    assert.equal(shortCommand('node /srv/app/server.js'), 'node /srv/app/server.js');
    assert.equal(shortCommand('[kworker/0:1]'), '[kworker/0:1]');
  });

  it('netmaskLabel: IPv4 as is, IPv6 as prefix length', () => {
    assert.equal(netmaskLabel('IPv4', '255.255.255.0'), '255.255.255.0');
    assert.equal(netmaskLabel('IPv6', 'ffff:ffff:ffff:ffff::'), '/64');
    assert.equal(netmaskLabel(6, 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'), '/128');
    assert.equal(netmaskLabel('IPv6', 'ffff:ffc0::'), '/26');
    assert.equal(netmaskLabel('IPv6', '::'), '/0');
    assert.deepEqual(networkRows(DEMO_NETWORK)[3], ['eth0', '2001:db8::10', 'IPv6', '/64', 'No']);
  });
});
