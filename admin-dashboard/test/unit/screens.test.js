import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'assert';
import React from 'react';
import { renderTerminal, cleanupTerminals, styleAt, styleAtCell, boldDimText, tick, waitFor } from '@shellcraft/ui/testing';
import { AdminApp } from '../../src/ui/app.js';
import { MENU } from '../../src/ui/dashboard.js';
import { meterTone } from '../../src/ui/parts.js';
import { DemoSystem, DEMO_LAUNCHD, demoSession } from '../helpers/demo-system.js';

const h = React.createElement;

afterEach(() => cleanupTerminals());

/** Render the app with demo data; refreshMs null: no live refresh. */
async function open({ columns = 80, rows = 24, system = new DemoSystem(), refreshMs = null, ...props } = {}) {
  const t = renderTerminal(
    h(AdminApp, { session: demoSession(), system, refreshMs, ...props }),
    { columns, rows }
  );
  await tick(30);
  return { t, system };
}

const width = (line) => Array.from(line).length;

/** Panels with a cyan (focused) top-left corner. */
function focusedPanels(raw) {
  let count = 0;
  for (let i = 0; ; i++) {
    const style = styleAt(raw, '╭', i);
    if (!style) return count;
    if (style.fg === 'cyan') count++;
  }
}

/**
 * Every frame is a full screen: title on row 0 (host name as meta), panel
 * edges, status bar on the last row, no row wider than the terminal,
 * nothing bold and dim at once (in any frame so far), one focused panel.
 */
function assertScreen(t, columns, rows, screen) {
  const lines = t.lines();
  assert.equal(lines.length, rows, `${screen}: ${rows} rows`);
  for (const [i, line] of lines.entries()) {
    assert.ok(width(line) <= columns, `${screen}: row ${i} is ${width(line)} wide: "${line}"`);
  }
  assert.ok(lines[0].startsWith(` Admin › ${screen}`), `row 0: "${lines[0]}"`);
  assert.ok(lines[0].endsWith('demo-server'), `row 0 meta: "${lines[0]}"`);
  assert.ok(lines[1].startsWith('╭─ '), `row 1: "${lines[1]}"`);
  assert.ok(lines[rows - 2].startsWith('╰'), `row ${rows - 2}: "${lines[rows - 2]}"`);
  for (const frame of t.frames) {
    assert.equal(boldDimText(frame), '', `${screen}: nothing is bold and dim at once`);
  }
  assert.equal(focusedPanels(t.lastFrame()), 1, `${screen}: one focused panel`);
  return lines;
}

const statusRow = (t) => t.lines().at(-1);
/** The status row without the "Connected" greeting a session starts with. */
const hintsRow = (t) => statusRow(t).replace(/ +✓ Connected$/, '');
const detail = (line) => line.slice(30); // the detail panel at 80 columns

describe('Home: Menu + detail (80x24)', () => {
  it('matches the Figma template: menu focused, overview summary, status hints', async () => {
    const { t } = await open();
    const lines = assertScreen(t, 80, 24, 'Dashboard');
    assert.ok(lines[1].startsWith('╭─ Menu ─'));
    assert.equal(lines[1].indexOf('╮'), 29, 'menu panel is 30 cells');
    assert.ok(lines[1].includes('╮╭─ System overview ─'));
    assert.equal(width(detail(lines[1])), 50, 'detail panel is 50 cells');
    MENU.forEach((item, i) => {
      const marker = i === 0 ? '›' : ' ';
      assert.equal(lines[2 + i].slice(0, 30), `│ ${marker} ${item.label.padEnd(23)}${i + 1} │`);
    });
    assert.equal(lines[9].slice(0, 30), `│${' '.repeat(28)}│`);
    assert.ok(!t.text().includes('Exit'), 'no Exit item');
    assert.ok(!t.text().includes('Back'), 'no Back button');

    assert.ok(detail(lines[3]).startsWith('│ Hostname    demo-server '));
    assert.ok(detail(lines[4]).startsWith('│ Platform    linux x64 '));
    assert.ok(detail(lines[5]).startsWith('│ CPUs        8 cores '));
    assert.ok(detail(lines[6]).startsWith('│ Uptime      12d 4h 31m '));
    assert.ok(detail(lines[7]).startsWith('│ Load        0.42  0.37  0.31 '));
    assert.equal(detail(lines[8]), `│${' '.repeat(48)}│`);
    assert.ok(detail(lines[9]).startsWith('│ CPU     ████████░░░░░░░░░░░░     41% '));
    assert.ok(detail(lines[10]).startsWith('│ Memory  ████████████████░░░░     82% '));
    assert.equal(statusRow(t), ` ↑↓ move  ⏎ open  1-7 jump  q quit${' '.repeat(34)}✓ Connected`);

    const raw = t.lastFrame();
    assert.equal(styleAt(raw, 'Menu').fg, 'cyan', 'menu panel has focus');
    assert.equal(styleAt(raw, 'System overview', 0).fg, undefined, 'detail title default color');
    assert.equal(styleAt(raw, '╭', 1).dim, true, 'the detail border is dim');
    assert.deepEqual(styleAt(raw, 'System overview', 1), { fg: 'black', bg: 'cyan', bold: true, dim: false, underline: false });
    assert.equal(styleAt(raw, 'demo-server').dim, true, 'title meta is muted');
    assert.equal(styleAt(raw, 'Hostname').dim, true, 'labels are muted');
    assert.equal(styleAt(raw, 'demo-server', 1).dim, false, 'values are default text');
    assert.equal(styleAtCell(raw, 9, 40).fg, 'cyan', 'CPU 41%: default tone');
    assert.equal(styleAtCell(raw, 10, 40).fg, 'yellow', 'memory 82%: warning tone');
    assert.equal(styleAt(raw, 'Connected').fg, 'green');
  });

  it('the detail panel follows the selection (arrows, j/k, 1-7)', async () => {
    const { t } = await open();
    await t.press('down');
    let lines = assertScreen(t, 80, 24, 'Dashboard');
    assert.ok(lines[1].includes('╭─ CPU & memory ─'));
    assert.ok(detail(lines[3]).startsWith('│ Model       Demo CPU 8-Core @ 3.20GHz'));
    assert.ok(detail(lines[5]).startsWith('│ Memory      13.12 GB of 16.00 GB'));
    assert.ok(detail(lines[7]).startsWith('│ CPU     ████████░░░░░░░░░░░░     41%'));
    assert.ok(detail(lines[10]).startsWith('│ Core 0  ████████░░░░░░░░░░░░     41%'));
    assert.ok(detail(lines[17]).startsWith('│ Core 7  █████░░░░░░░░░░░░░░░     27%'));

    await t.press('j');
    await tick(20);
    lines = assertScreen(t, 80, 24, 'Dashboard');
    assert.ok(lines[1].includes('╭─ Processes ─'));
    assert.ok(detail(lines[3]).startsWith('│ Command                            CPU % Mem % │'));
    assert.ok(detail(lines[4]).startsWith('│ init splash                          0.0   0.1 │'));
    assert.equal(styleAt(t.lastFrame(), 'Command').underline, true, 'table header');

    await t.press('4');
    lines = assertScreen(t, 80, 24, 'Dashboard');
    assert.ok(lines[1].includes('╭─ Logs ─'));
    assert.ok(detail(lines[3]).startsWith('│ Entries     20'));
    assert.ok(detail(lines[4]).startsWith('│ Errors      2'));
    assert.ok(detail(lines[5]).startsWith('│ Warnings    3'));
    assert.equal(styleAtCell(t.lastFrame(), 4, 44).fg, 'red', 'error count in red');
    assert.equal(styleAtCell(t.lastFrame(), 5, 44).fg, 'yellow', 'warning count in yellow');
    assert.ok(t.text().includes('09:47:30  INFO   Cache cleared'), 'latest entry visible');

    await t.press('5');
    lines = assertScreen(t, 80, 24, 'Dashboard');
    assert.ok(lines[1].includes('╭─ Network ─'));
    assert.ok(detail(lines[3]).startsWith('│ Interfaces  3'));
    assert.ok(detail(lines[7]).startsWith('│ eth0        192.0.2.10'));

    await t.press('6');
    await tick(20);
    lines = assertScreen(t, 80, 24, 'Dashboard');
    assert.ok(lines[1].includes('╭─ Services ─'));
    assert.ok(detail(lines[3]).startsWith('│ Listed      13 services'));
    assert.ok(detail(lines[6]).startsWith('│ cron.service'));

    await t.press('7');
    lines = assertScreen(t, 80, 24, 'Dashboard');
    assert.ok(lines[1].includes('╭─ Settings ─'));
    assert.ok(detail(lines[3]).startsWith('│ Node        v24.11.0'));
    assert.ok(detail(lines[8]).startsWith('│ Fingerprint anonymous'));
    assert.ok(detail(lines[9]).startsWith('│ Screen      80×24'));

    await t.press('k');
    assert.ok(t.lines()[1].includes('╭─ Services ─'));
    await t.press('9');
    assert.ok(t.lines()[1].includes('╭─ Services ─'), 'no item 9');
  });

  it('only the highlighted summary refreshes; moving on stops its timer', async () => {
    const { t, system } = await open({ refreshMs: 25 });
    await t.press('3');
    await tick(120);
    const polled = system.calls.getProcesses;
    assert.ok(polled >= 3, `processes summary is live (${polled} loads)`);
    await t.press('1');
    const overviewLoads = system.calls.getCPUPercent;
    await tick(120);
    assert.equal(system.calls.getProcesses, polled, 'processes summary stopped');
    assert.ok(system.calls.getCPUPercent > overviewLoads, 'overview summary is live');
    t.unmount();
    const after = system.calls.getCPUPercent;
    await tick(80);
    assert.equal(system.calls.getCPUPercent, after, 'nothing runs after unmount');
  });

  it('q quits', async () => {
    const { t } = await open();
    let exited = false;
    t.waitUntilExit().then(() => { exited = true; });
    await t.press('q');
    await tick(20);
    assert.equal(exited, true);
  });
});

describe('Screens (80x24)', () => {
  it('⏎ opens every item, b and Esc come back with the same item highlighted', async () => {
    const { t } = await open();
    const titles = ['System overview', 'CPU & memory', 'Processes', 'Logs', 'Network', 'Services', 'Settings'];
    for (const [i, title] of titles.entries()) {
      await t.press(String(i + 1), 'enter');
      await tick(20);
      const lines = assertScreen(t, 80, 24, title);
      assert.ok(statusRow(t).includes('b back') && statusRow(t).includes('q quit'), statusRow(t));
      assert.ok(!t.text().includes('Back '), 'no Back button');
      assert.ok(!lines.some((line, row) => row > 1 && row < 22 && line.includes('╭')), 'one panel, nothing floating');
      await t.press(i % 2 ? 'escape' : 'b');
      assertScreen(t, 80, 24, 'Dashboard');
      assert.ok(t.lines()[2 + i].startsWith(`│ › ${MENU[i].label}`), `item ${i + 1} still highlighted`);
      assert.ok(!statusRow(t).includes('Connected'), 'message cleared on navigation');
    }
  });

  it('system overview: label/value rows and meters; r refreshes', async () => {
    const { t, system } = await open({ initialScreen: 'overview' });
    const lines = assertScreen(t, 80, 24, 'System overview');
    assert.ok(lines[1].startsWith('╭─ System overview ─'));
    assert.ok(lines[3].startsWith('│ Hostname      demo-server '));
    assert.ok(lines[5].startsWith('│ Architecture  x64 '));
    assert.ok(lines[9].startsWith('│ Load 1 min    0.42 '));
    assert.ok(lines[11].startsWith('│ Load 15 min   0.31 '));
    assert.ok(lines[13].startsWith('│ Total memory  16.00 GB '));
    assert.ok(lines[17].startsWith('│ CPU     ████████░░░░░░░░░░░░     41% '));
    assert.ok(lines[18].startsWith('│ Memory  ████████████████░░░░     82% '));
    assert.equal(styleAt(t.lastFrame(), 'Architecture').dim, true);
    assert.equal(hintsRow(t), ' r refresh  b back  q quit');

    const loads = system.calls.getSystemInfo;
    await t.press('r');
    assert.ok(system.calls.getSystemInfo > loads);
    assert.ok(statusRow(t).endsWith('✓ Refreshed'), statusRow(t));
  });

  it('meter tones: warning from 75 %, danger from 90 %', async () => {
    assert.equal(meterTone(74.9), 'default');
    assert.equal(meterTone(75), 'warning');
    assert.equal(meterTone(89.9), 'warning');
    assert.equal(meterTone(90), 'danger');
    const { t } = await open({ initialScreen: 'overview', system: new DemoSystem({ cpu: 95, memory: 60 }) });
    const raw = t.lastFrame();
    assert.equal(styleAtCell(raw, 17, 10).fg, 'red', 'CPU 95 %');
    assert.equal(styleAtCell(raw, 18, 10).fg, 'cyan', 'memory 60 %');
    assert.equal(styleAtCell(raw, 18, 22).dim, true, 'the empty part is muted');
  });

  it('live stats refresh every interval and stop when leaving the screen', async () => {
    const { t, system } = await open({ initialScreen: 'processes', refreshMs: 25 });
    await tick(120);
    const loads = system.calls.getProcesses;
    assert.ok(loads >= 3, `processes reload (${loads})`);
    await t.press('b');
    assertScreen(t, 80, 24, 'Dashboard'); // overview highlighted: no process summary
    await tick(100);
    assert.equal(system.calls.getProcesses, loads, 'timer cleared on navigation');
  });

  it('CPU & memory: per-core meters side by side, memory totals', async () => {
    const { t } = await open({ initialScreen: 'resources' });
    const lines = assertScreen(t, 80, 24, 'CPU & memory');
    assert.ok(lines[3].startsWith('│ Model         Demo CPU 8-Core @ 3.20GHz '));
    assert.ok(lines[6].startsWith('│ CPU     ████████░░░░░░░░░░░░     41% '));
    assert.equal(lines[7], '│ Core 0  ████████░░░░░░░░░░░░     41%    Core 1  ████████░░░░░░░░░░░░     38% │');
    assert.ok(lines[10].startsWith('│ Core 6  ████████████░░░░░░░░     61%    Core 7 '));
    assert.ok(lines[12].startsWith('│ Memory  ████████████████░░░░     82% '));
    assert.ok(lines[13].startsWith('│ Total         16.00 GB '));
    assert.equal(hintsRow(t), ' r refresh  b back  q quit');
  });

  it('CPU & memory: many cores scroll', async () => {
    const cores = Array.from({ length: 64 }, (_, i) => (i * 7) % 100);
    const { t } = await open({ initialScreen: 'resources', system: new DemoSystem({ cores }) });
    let lines = assertScreen(t, 80, 24, 'CPU & memory');
    assert.equal(hintsRow(t), ' ↑↓ scroll  r refresh  b back  q quit');
    // 41 rows (model, cores, CPU, 32 rows of 2 cores, memory) in 18.
    assert.ok(lines[20].startsWith('│ ↓ 24 more'), lines[20]);
    await t.press('down', 'down');
    lines = t.lines();
    assert.ok(lines[3].startsWith('│ ↑ 2 more'), lines[3]);
  });

  it('processes: ps output as a table, numbers right-aligned, command grows', async () => {
    const { t } = await open({ initialScreen: 'processes' });
    const lines = assertScreen(t, 80, 24, 'Processes');
    assert.equal(lines[2], '│     PID User       CPU % Mem %     RSS      Time Command                     │');
    assert.equal(lines[3], '│       1 root         0.0   0.1   12.8M      0:09 /sbin/init splash           │');
    assert.equal(lines[8], '│    2210 demo        12.5   6.1  980.0M     58:01 node /srv/app/server.js --… │');
    assert.equal(styleAt(t.lastFrame(), 'PID').underline, true);
    assert.equal(styleAt(t.lastFrame(), 'PID').dim, true);
    assert.ok(!t.lastFrame().includes('\u001B[46m'), 'no selection bar: nothing to act on');
    assert.equal(hintsRow(t), ' r refresh  b back  q quit');
  });

  it('processes: the table height follows the terminal', async () => {
    const header = 'USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND';
    const many = [header, ...Array.from({ length: 40 }, (_, i) => `demo ${100 + i} 0.0 0.1 1000 2048 ? S 10:00 0:00 worker ${i}`)].join('\n');
    const { t } = await open({ initialScreen: 'processes', system: new DemoSystem({ processes: many }) });
    await waitFor(() => t.lines()[21]?.startsWith('│ ↓ 22 more'), { message: 'the process list' });
    let lines = assertScreen(t, 80, 24, 'Processes');
    assert.ok(lines[21].startsWith('│ ↓ 22 more'), lines[21]);
    assert.ok(statusRow(t).startsWith(' ↑↓ scroll'));
    await t.press('down');
    assert.ok(t.lines()[3].startsWith('│ ↑ 1 more'));
    await t.resize(80, 30);
    lines = t.lines();
    assert.equal(lines.length, 30);
    assert.ok(lines[27].includes('more'), 'the window grew with the terminal');
  });

  it('processes: a failed listing is an error in the status bar', async () => {
    const { t } = await open({ initialScreen: 'processes', system: new DemoSystem({ processes: 'Error fetching processes' }) });
    assertScreen(t, 80, 24, 'Processes');
    assert.ok(statusRow(t).endsWith('✗ Error fetching processes'), statusRow(t));
    assert.equal(styleAt(t.lastFrame(), 'Error fetching').fg, 'red');
    assert.ok(t.text().includes('No process list.'));
    assert.ok(t.text().includes('Try again: r refresh'));
  });

  it('processes: loading shows a busy message in the status bar', async () => {
    const system = new DemoSystem();
    system.getProcesses = () => new Promise(() => {});
    const { t } = await open({ initialScreen: 'processes', system });
    assertScreen(t, 80, 24, 'Processes');
    assert.ok(statusRow(t).endsWith('Loading processes'), statusRow(t));
    assert.ok(t.lines()[2].startsWith('│     PID User'), 'header while loading');
  });

  it('logs: follows the end, WARN yellow, ERROR red; new entries arrive; r reloads', async () => {
    const { t, system } = await open({ initialScreen: 'logs' });
    let lines = assertScreen(t, 80, 24, 'Logs');
    assert.equal(lines[2], `│ 09:00:00  INFO   Session created${' '.repeat(45)}│`);
    assert.ok(lines[21].startsWith('│ 09:47:30  INFO   Cache cleared'));
    const raw = t.lastFrame();
    assert.equal(styleAt(raw, '09:10:00  WARN').fg, 'yellow');
    assert.equal(styleAt(raw, '09:15:00  ERROR').fg, 'red');
    assert.equal(styleAt(raw, '09:05:00  DEBUG').dim, true);
    assert.equal(styleAt(raw, '09:00:00  INFO').fg, undefined);
    assert.equal(hintsRow(t), ' r refresh  b back  q quit');
    t.unmount();

    // Live: one entry per interval, the view stays at the end.
    const live = await open({ initialScreen: 'logs', system, refreshMs: 25 });
    await tick(150);
    lines = live.t.lines();
    assert.ok(lines[2].startsWith('│ ↑ '), lines[2]);
    assert.ok(lines[21].includes('  '), lines[21]);
    const last = lines[21].slice(2, 10);
    assert.ok(last > '09:47:30', `newest entry at the bottom (${last})`);
    assert.ok(statusRow(live.t).startsWith(' ↑↓ scroll'));
    await live.t.press('r');
    assert.ok(statusRow(live.t).endsWith('✓ Refreshed'));
  });

  it('network: interfaces as a table, IPv6 masks as prefix length', async () => {
    const { t } = await open({ initialScreen: 'network' });
    const lines = assertScreen(t, 80, 24, 'Network');
    assert.ok(lines[1].startsWith('╭─ Network interfaces ─'));
    assert.equal(lines[2], '│ Interface  Address                           Family Netmask         Internal │');
    assert.equal(lines[3], '│ lo         127.0.0.1                         IPv4   255.0.0.0       Yes      │');
    assert.equal(lines[4], '│ lo         ::1                               IPv6   /128            Yes      │');
    assert.ok(lines[6].startsWith('│ eth0       2001:db8::10 '));
    assert.equal(hintsRow(t), ' r refresh  b back  q quit');
  });

  it('services: systemctl and launchctl listings as tables', async () => {
    const { t } = await open({ initialScreen: 'services' });
    let lines = assertScreen(t, 80, 24, 'Services');
    assert.ok(lines[2].startsWith('│ Unit                           Load   Active Sub     Description'));
    assert.ok(lines[3].startsWith('│ cron.service                   loaded active running Regular background'));
    assert.ok(!t.text().includes('LOAD   ='), 'legend not in the table');
    t.unmount();

    const mac = await open({ initialScreen: 'services', system: new DemoSystem({ services: DEMO_LAUNCHD }) });
    lines = assertScreen(mac.t, 80, 24, 'Services');
    assert.ok(lines[2].startsWith('│     PID Status Label'));
    assert.ok(lines[3].startsWith('│       -      0 com.apple.SafariHistoryServiceAgent'));
    assert.ok(lines[6].startsWith('│    1022      0 com.example.backup agent'));
  });

  it('services: a platform without a listing says so in the status bar', async () => {
    const system = new DemoSystem({ services: 'Service listing not available on this platform' });
    const { t } = await open({ initialScreen: 'services', system });
    assertScreen(t, 80, 24, 'Services');
    assert.ok(statusRow(t).endsWith('✗ Service listing not available on this platform'), statusRow(t));
  });

  it('settings: environment and session as label/value rows', async () => {
    const { t } = await open({ initialScreen: 'settings', terminal: 'xterm-256color' });
    const lines = assertScreen(t, 80, 24, 'Settings');
    assert.ok(lines[3].startsWith('│ Node version  v24.11.0 '));
    assert.ok(lines[4].startsWith('│ Platform      linux 6.8.0-45-generic '));
    assert.ok(lines[9].startsWith('│ Terminal      xterm-256color '), 'the client terminal type');
    assert.ok(lines[12].startsWith('│ Session ID    V1StGXR8_Z5jdHi6B-myT '));
    assert.ok(lines[14].startsWith('│ Connected     2026-10-27 09:41:05 '));
    assert.ok(lines[15].startsWith('│ Screen size   80×24 '));
    assert.equal(hintsRow(t), ' b back  q quit');
    await t.resize(100, 30);
    assert.ok(t.lines()[15].startsWith('│ Screen size   100×30 '));
  });

  it('q quits from a screen', async () => {
    const { t } = await open({ initialScreen: 'logs' });
    let exited = false;
    t.waitUntilExit().then(() => { exited = true; });
    await t.press('q');
    await tick(20);
    assert.equal(exited, true);
  });
});

describe('Screens (100x30)', () => {
  it('every screen fills the terminal', async () => {
    const { t } = await open({ columns: 100, rows: 30 });
    let lines = assertScreen(t, 100, 30, 'Dashboard');
    assert.equal(lines[1].indexOf('╮'), 29, 'menu keeps 30 cells; the detail panel takes the rest');
    const titles = ['System overview', 'CPU & memory', 'Processes', 'Logs', 'Network', 'Services', 'Settings'];
    for (const [i, title] of titles.entries()) {
      await t.press(String(i + 1));
      await tick(20);
      assertScreen(t, 100, 30, 'Dashboard');
      await t.press('enter');
      await tick(20);
      lines = assertScreen(t, 100, 30, title);
      if (title === 'Processes') {
        assert.ok(lines[4].endsWith('0:03 /lib/systemd/systemd-journald                   │'), 'command column grows');
      }
      await t.press('b');
    }
  });
});
