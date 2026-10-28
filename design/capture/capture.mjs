// Capture every reachable screen of the shellcraft demo apps from blessed's own cell buffer.
// Runs the apps' real router and UI code against a fake SSH stream; no network, no SSH.
// Usage: node capture.mjs <app> <cols> <rows> <out.json>   (see capture-all.sh)
import { Duplex } from 'node:stream';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [app, cols, rows, out] = [process.argv[2], +process.argv[3], +process.argv[4], path.resolve(process.argv[5])];
const SCRATCH = path.dirname(out);
const dir = path.join(ROOT, app);
const imp = (rel) => import(pathToFileURL(path.join(dir, rel)).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEY = { up: '\x1b[A', down: '\x1b[B', right: '\x1b[C', left: '\x1b[D', enter: '\r', escape: '\x1b', tab: '\t', space: ' ' };

const blessed = createRequire(path.join(dir, 'package.json'))('blessed');
const screens = [];
const origScreen = blessed.screen;
let currentStream = null;
blessed.screen = function (opts = {}) {
  if (!opts.input) Object.assign(opts, { input: currentStream, output: currentStream, terminal: 'xterm-256color' });
  const s = origScreen.call(this, opts);
  screens.push(s);
  return s;
};

function fakeStream() {
  const s = new Duplex({ read() {}, write(_c, _e, cb) { cb(); } });
  Object.assign(s, { columns: cols, rows, isTTY: true, setRawMode() {} });
  return s;
}

function dump(screen) {
  screen.render();
  return screen.lines.map((line) => {
    const runs = [];
    for (const [attr, ch] of line) {
      const c = ch === '\x03' ? '' : ch;
      if (runs.length && runs[runs.length - 1][0] === attr) runs[runs.length - 1][1] += c;
      else runs.push([attr, c]);
    }
    return runs;
  });
}

// Demo data instead of this machine's hostname, processes, services and addresses.
async function stubSystem() {
  const os = (await import('node:os')).default;
  Object.assign(os, { platform: () => 'linux', release: () => '6.8.0-45-generic', arch: () => 'x64',
    homedir: () => '/home/demo', tmpdir: () => '/tmp' });
  Object.assign(process.env, { SHELL: '/bin/bash', TERM: 'xterm-256color' });
  try { Object.defineProperty(process, 'version', { value: 'v24.0.0' }); } catch {}
  const { SystemModel } = await imp('src/models/system.js');
  Object.assign(SystemModel.prototype, {
    getSystemInfo: () => ({ hostname: 'demo-server', platform: 'linux', arch: 'x64', cpus: 8, totalMemory: '16.00 GB', freeMemory: '9.42 GB', uptime: '12d 4h 31m', loadAvg: ['0.42', '0.37', '0.31'] }),
    getCPUUsage: () => Array.from({ length: 8 }, (_, i) => ({ core: i, model: 'Demo CPU @ 3.2GHz', usage: `${[12.4, 8.1, 33.0, 5.6, 18.9, 2.3, 41.7, 9.8][i]}%` })),
    getMemoryUsage: () => ({ total: '16.00 GB', used: '6.58 GB', free: '9.42 GB', percent: '41.1%' }),
    getNetworkInfo: () => [
      { interface: 'lo', address: '127.0.0.1', family: 'IPv4', netmask: '255.0.0.0', internal: 'Yes' },
      { interface: 'eth0', address: '10.0.0.12', family: 'IPv4', netmask: '255.255.255.0', internal: 'No' },
      { interface: 'eth0', address: 'fe80::1', family: 'IPv6', netmask: 'ffff:ffff:ffff:ffff::', internal: 'No' },
    ],
    getServices: async () => ['UNIT                 LOAD   ACTIVE SUB     DESCRIPTION',
      'cron.service         loaded active running Regular background jobs',
      'nginx.service        loaded active running Web server',
      'postgresql.service   loaded active running Database server',
      'ssh.service          loaded active running OpenBSD Secure Shell server',
      'shellcraft.service   loaded active running Shellcraft demo app'].join('\n'),
    getProcesses: async () => ['USER   PID %CPU %MEM    VSZ   RSS TTY STAT START TIME COMMAND',
      'root     1  0.0  0.1 169084 11620 ?   Ss   Oct15 0:09 /sbin/init',
      'demo   812  2.1  1.4 912344 98812 ?   Sl   Oct15 4:02 node src/server/index.js',
      'www    904  0.3  0.2  55320 14032 ?   S    Oct15 0:41 nginx: worker process',
      'pg    1021  0.8  2.9 401220 236010 ?  Ss   Oct15 2:13 postgres: main',
      'demo  2210  0.0  0.0   9520  3104 pts/0 R+ 10:42 0:00 ps aux'].join('\n'),
  });
}

async function stubLLM() {
  const { OllamaClient } = await imp('src/llm/ollama-client.js');
  OllamaClient.prototype.isAvailable = async () => true;
  OllamaClient.prototype.chat = async () => {
    await sleep(2500);
    return { message: { content: JSON.stringify({
      description: 'Lanterns sway over the village square. A dry fountain stands at its centre, and a notice board creaks in the wind beside the inn door.',
      message: 'The innkeeper waves you over: "Strange lights in the old mill again."' }) } };
  };
}

const SCENARIOS = {
  'admin-dashboard': [['dashboard', []], ...['overview', 'resources', 'processes', 'logs', 'network', 'services', 'settings']
    .map((n, i) => [n, [...Array(i).fill('down'), 'enter']])],
  'demo-shop': [['home', []], ['products', ['enter']], ['product added', ['enter', 'a']],
    ['cart', ['enter', 'a', 'b', 'down', 'enter']], ['checkout', ['enter', 'a', 'b', 'down', 'down', 'enter']]],
  'adventure-game': [['menu', []], ['loading', ['enter'], 900], ['room', ['enter'], 4000],
    ...[1, 2, 3, 4, 5].map((k) => [`menu item ${k}`, [...Array(k).fill('down'), 'enter']])],
  'animation-demo': [['start', [], 600], ['next animation', ['right'], 600], ['third animation', ['right', 'right'], 600]],
};

async function run() {
  if (app === 'admin-dashboard') await stubSystem();
  if (app === 'adventure-game') await stubLLM();
  const results = [];
  for (const [name, keys, settle = 800] of SCENARIOS[app]) {
    screens.length = 0;
    currentStream = fakeStream();
    if (app === 'animation-demo') {
      await import(pathToFileURL(path.join(dir, 'index.js')).href + `?v=${results.length}`);
    } else {
      const { CommandRouter } = await imp('src/server/router.js');
      const { SessionManager } = await imp('src/server/session.js');
      // Adventure sessions persist to disk: give each scenario a fresh file outside the app.
      const sessionsFile = path.join(SCRATCH, `sessions-${results.length}.json`);
      fs.rmSync(sessionsFile, { force: true });
      const sm = app === 'adventure-game' ? new SessionManager({ sessionsFile }) : new SessionManager();
      const session = sm.createSession(app === 'adventure-game' ? `demo${results.length}` : null);
      new CommandRouter().handleConnection(currentStream, session, { cols, rows }, sm);
    }
    await sleep(300);
    for (const k of keys) { currentStream.push(KEY[k] ?? k); await sleep(250); }
    await sleep(settle);
    const screen = screens[screens.length - 1];
    results.push({ app, name, keys, cols, rows, lines: dump(screen) });
    screen.destroy();
  }
  fs.writeFileSync(out, JSON.stringify(results));
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
