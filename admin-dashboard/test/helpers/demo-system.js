// A SystemModel with fixed demo data, so screen tests do not depend on the
// machine they run on (host name, processes, addresses, load). Addresses are
// from the documentation ranges (RFC 5737, RFC 3849).
import { SystemModel, clockTime } from '../../src/models/system.js';

export const DEMO_PROCESSES = `USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root           1  0.0  0.1 168832 13120 ?        Ss   Oct15   0:09 /sbin/init splash
root         412  0.0  0.2  47940 18432 ?        Ss   Oct15   0:03 /lib/systemd/systemd-journald
postgres     801  2.1  3.4 321456 562340 ?       Ss   Oct15  41:12 postgres: checkpointer
redis       1022  0.7  0.5  72000 81920 ?        Ssl  Oct15   9:30 /usr/bin/redis-server 127.0.0.1:6379
www-data    1204  1.3  0.8 142300 131072 ?       S    Oct15  12:45 nginx: worker process
demo        2210 12.5  6.1 1293400 1003520 ?     Sl   09:12  58:01 node /srv/app/server.js --port 8080
root         955  0.0  0.1  15420  9216 ?        Ss   Oct15   0:00 sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups
demo        3301  0.3  0.2  11284  5120 pts/0    Ss   10:02   0:00 -bash
root        3390  0.0  0.0  10072  3328 pts/0    R+   10:05   0:00 ps aux
`;

export const DEMO_SERVICES = `  UNIT                        LOAD   ACTIVE SUB     DESCRIPTION
  cron.service                loaded active running Regular background program processing daemon
  dbus.service                loaded active running D-Bus System Message Bus
  nginx.service               loaded active running A high performance web server and a reverse proxy server
  postgresql@16-main.service  loaded active running PostgreSQL Cluster 16-main
  redis-server.service        loaded active running Advanced key-value store
  ssh.service                 loaded active running OpenBSD Secure Shell server
  systemd-journald.service    loaded active running Journal Service
  systemd-logind.service      loaded active running User Login Management
  systemd-networkd.service    loaded active running Network Configuration
  systemd-resolved.service    loaded active running Network Name Resolution
  systemd-timesyncd.service   loaded active running Network Time Synchronization
  systemd-udevd.service       loaded active running Rule-based Manager for Device Events and Files
  unattended-upgrades.service loaded active running Unattended Upgrades Shutdown

LOAD   = Reflects whether the unit definition was properly loaded.
ACTIVE = The high-level unit activation state, i.e. generalization of SUB.
SUB    = The low-level unit activation state, values depend on unit type.
13 loaded units listed.
`;

export const DEMO_LAUNCHD = `PID\tStatus\tLabel
-\t0\tcom.apple.SafariHistoryServiceAgent
412\t0\tcom.apple.Finder
-\t-9\tcom.apple.homed
1022\t0\tcom.example.backup agent
`;

export const DEMO_NETWORK = [
  { interface: 'lo', address: '127.0.0.1', family: 'IPv4', netmask: '255.0.0.0', internal: 'Yes' },
  { interface: 'lo', address: '::1', family: 'IPv6', netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', internal: 'Yes' },
  { interface: 'eth0', address: '192.0.2.10', family: 'IPv4', netmask: '255.255.255.0', internal: 'No' },
  { interface: 'eth0', address: '2001:db8::10', family: 'IPv6', netmask: 'ffff:ffff:ffff:ffff::', internal: 'No' },
  { interface: 'eth0', address: 'fe80::5054:ff:fe12:3456', family: 'IPv6', netmask: 'ffff:ffff:ffff:ffff::', internal: 'No' },
  { interface: 'wg0', address: '198.51.100.7', family: 'IPv4', netmask: '255.255.255.255', internal: 'No' }
];

const LOG_PLAN = [
  ['INFO', 'Session created'],
  ['INFO', 'User authentication successful'],
  ['DEBUG', 'Cache cleared'],
  ['INFO', 'API request received'],
  ['WARN', 'Background job completed'],
  ['INFO', 'Database connection established'],
  ['ERROR', 'Email sent successfully'],
  ['INFO', 'File upload completed'],
  ['DEBUG', 'API request received'],
  ['INFO', 'Session created'],
  ['WARN', 'Cache cleared'],
  ['INFO', 'User authentication successful'],
  ['INFO', 'API request received'],
  ['ERROR', 'Database connection established'],
  ['INFO', 'Background job completed'],
  ['DEBUG', 'Session created'],
  ['INFO', 'Email sent successfully'],
  ['WARN', 'File upload completed'],
  ['INFO', 'API request received'],
  ['INFO', 'Cache cleared']
];

const LOG_START = new Date(2026, 9, 27, 9, 0, 0);

/**
 * Demo data; `calls` counts model calls per method (to check that live
 * refresh stops), `overrides` replaces values ({ cpu, memory, processes,
 * services }).
 */
export class DemoSystem extends SystemModel {
  constructor(overrides = {}) {
    super();
    this.overrides = overrides;
    this.calls = {};
    this.logCount = 0;
  }

  count(name) {
    this.calls[name] = (this.calls[name] ?? 0) + 1;
  }

  getSystemInfo() {
    this.count('getSystemInfo');
    return {
      hostname: 'demo-server',
      platform: 'linux',
      arch: 'x64',
      cpus: 8,
      totalMemory: '16.00 GB',
      freeMemory: '2.88 GB',
      uptime: '12d 4h 31m',
      loadAvg: ['0.42', '0.37', '0.31']
    };
  }

  getCPUUsage() {
    this.count('getCPUUsage');
    const percents = this.overrides.cores ?? [41, 38, 52, 33, 47, 29, 61, 27];
    return percents.map((percent, core) => ({
      core,
      model: 'Demo CPU 8-Core @ 3.20GHz',
      usage: `${percent.toFixed(1)}%`,
      percent
    }));
  }

  getCPUPercent() {
    this.count('getCPUPercent');
    return this.overrides.cpu ?? 41;
  }

  getMemoryUsage() {
    this.count('getMemoryUsage');
    const usedPercent = this.overrides.memory ?? 82;
    const used = (16 * usedPercent) / 100;
    return {
      total: '16.00 GB',
      used: `${used.toFixed(2)} GB`,
      free: `${(16 - used).toFixed(2)} GB`,
      percent: `${usedPercent.toFixed(1)}%`,
      usedPercent
    };
  }

  getNetworkInfo() {
    this.count('getNetworkInfo');
    return DEMO_NETWORK.map((entry) => ({ ...entry }));
  }

  async getProcesses() {
    this.count('getProcesses');
    return this.overrides.processes ?? DEMO_PROCESSES;
  }

  async getServices() {
    this.count('getServices');
    return this.overrides.services ?? DEMO_SERVICES;
  }

  getEnvironment() {
    this.count('getEnvironment');
    return {
      node: 'v24.11.0',
      platform: 'linux',
      release: '6.8.0-45-generic',
      arch: 'x64',
      home: '/home/demo',
      tmp: '/tmp',
      shell: '/bin/bash',
      term: 'xterm',
      sshPort: '2222'
    };
  }

  createMockLog(date) {
    this.count('createMockLog');
    const i = this.logCount++;
    const [level, message] = LOG_PLAN[i % LOG_PLAN.length];
    const at = date ?? new Date(LOG_START.getTime() + i * 150000);
    return { timestamp: clockTime(at), level, message };
  }

  getMockLogs(count = 20) {
    this.count('getMockLogs');
    this.logCount = 0;
    return Array.from({ length: count }, () => this.createMockLog());
  }
}

/** A session like SessionManager makes, with a fixed id and time. */
export const demoSession = () => ({
  id: 'V1StGXR8_Z5jdHi6B-myT',
  fingerprint: 'anonymous',
  createdAt: new Date(2026, 9, 27, 9, 41, 5),
  cart: [],
  user: null
});
