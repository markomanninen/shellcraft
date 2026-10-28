#!/usr/bin/env node
// Animated SVG recordings of the apps for the README (docs/images/*.svg).
//
// Each app is rendered with renderTerminal() from @shellcraft/ui/testing at
// 80x24, driven through a scripted session, and every distinct screen is
// kept with how long it stays up. The SVG draws each frame from its ANSI
// output: text runs placed by column, box lines and blocks as shapes, the
// VS Code Dark+ terminal palette, dim as opacity. A CSS @keyframes
// animation steps through the frames; no scripts, no external resources,
// so GitHub can show it in an <img>.
//
//   node scripts/record-readme.mjs                 # all apps
//   node scripts/record-readme.mjs demo-shop       # one app
//
// Needs each app's dependencies (npm ci in the app directory). Each app is
// recorded in its own process, with the app's own React, Ink and ui copy.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'docs', 'images');
const APPS = ['demo-shop', 'admin-dashboard', 'adventure-game', 'animation-demo'];
const COLUMNS = 80;
const ROWS = 24;

// --- SVG ------------------------------------------------------------------

const CELL_W = 9; // px per column
const CELL_H = 18; // px per row
const FONT_SIZE = 15;
const BASELINE = 13; // text baseline inside a row
const PAD = 14; // terminal padding inside the window
const BAR = 30; // window title bar

// VS Code Dark+ terminal colors (terminalColorRegistry.ts, dark defaults).
const PALETTE = {
  black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510',
  blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
  gray: '#666666', redBright: '#f14c4c', greenBright: '#23d18b', yellowBright: '#f5f543',
  blueBright: '#3b8eea', magentaBright: '#d670d6', cyanBright: '#29b8db', whiteBright: '#e5e5e5'
};
const DEFAULT_FG = '#cccccc';
const BACKGROUND = '#1e1e1e';
const SGR_COLORS = {
  30: 'black', 31: 'red', 32: 'green', 33: 'yellow', 34: 'blue', 35: 'magenta', 36: 'cyan', 37: 'white',
  90: 'gray', 91: 'redBright', 92: 'greenBright', 93: 'yellowBright', 94: 'blueBright',
  95: 'magentaBright', 96: 'cyanBright', 97: 'whiteBright'
};
const COLOR_NAMES = Object.keys(PALETTE);
const colorClass = (name) => (name ? `c${COLOR_NAMES.indexOf(name).toString(16)}` : '');

/** A frame's rows as cells { ch, fg, bg, bold, dim, ul }, COLUMNS wide. */
function parseFrame(raw) {
  const blank = () => ({ ch: ' ', fg: null, bg: null, bold: false, dim: false, ul: false });
  const rows = [];
  let row = [];
  let style = { fg: null, bg: null, bold: false, dim: false, ul: false };
  // eslint-disable-next-line no-control-regex
  const token = /\u001B\[([0-9;]*)m|\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001B]*(?:\u0007|\u001B\\))|([\s\S])/gu;
  for (const m of String(raw).matchAll(token)) {
    if (m[1] !== undefined) {
      const codes = m[1] === '' ? [0] : m[1].split(';').map(Number);
      style = { ...style };
      for (const c of codes) {
        if (c === 0) style = { fg: null, bg: null, bold: false, dim: false, ul: false };
        else if (c === 1) style.bold = true;
        else if (c === 2) style.dim = true;
        else if (c === 22) Object.assign(style, { bold: false, dim: false });
        else if (c === 4) style.ul = true;
        else if (c === 24) style.ul = false;
        else if (c === 39) style.fg = null;
        else if (c === 49) style.bg = null;
        else if (SGR_COLORS[c]) style.fg = SGR_COLORS[c];
        else if (SGR_COLORS[c - 10]) style.bg = SGR_COLORS[c - 10];
      }
    } else if (m[2] === '\n') {
      rows.push(row);
      row = [];
    } else if (m[2] !== undefined) {
      row.push({ ch: m[2], ...style });
    }
  }
  rows.push(row);
  return Array.from({ length: ROWS }, (_, y) => {
    const cells = (rows[y] ?? []).slice(0, COLUMNS);
    while (cells.length < COLUMNS) cells.push(blank());
    return cells;
  });
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v) => Number(v.toFixed(2)).toString();
const BOX = new Set(['─', '│', '╭', '╮', '╰', '╯']);
const BLOCK = new Set(['█', '░']);
const sameStyle = (a, b) => a.fg === b.fg && a.bold === b.bold && a.dim === b.dim;

/** One row as SVG markup, drawn at y = 0 (the frame places it). */
function rowMarkup(cells) {
  const parts = [];
  // Backgrounds.
  for (let x = 0; x < COLUMNS; ) {
    const bg = cells[x].bg;
    let end = x + 1;
    while (end < COLUMNS && cells[end].bg === bg) end++;
    if (bg) parts.push(`<rect x="${x * CELL_W}" width="${(end - x) * CELL_W}" height="${CELL_H}" fill="${PALETTE[bg]}"/>`);
    x = end;
  }
  // Box lines as paths (they join across cells and rows, whatever the font).
  const paths = new Map();
  const addPath = (cell, d) => {
    const key = `${colorClass(cell.fg)}${cell.dim ? ' d' : ''}`;
    paths.set(key, (paths.get(key) ?? '') + d);
  };
  const r = CELL_W / 2;
  const cy = CELL_H / 2;
  for (let x = 0; x < COLUMNS; x++) {
    const cell = cells[x];
    if (!BOX.has(cell.ch)) continue;
    const left = x * CELL_W;
    const cx = left + r;
    if (cell.ch === '─') {
      let end = x + 1;
      while (end < COLUMNS && cells[end].ch === '─' && sameStyle(cells[end], cell)) end++;
      addPath(cell, `M${left} ${cy}H${end * CELL_W}`);
      x = end - 1;
    } else if (cell.ch === '│') addPath(cell, `M${n(cx)} 0V${CELL_H}`);
    else if (cell.ch === '╭') addPath(cell, `M${left + CELL_W} ${cy}A${r} ${r} 0 0 0 ${n(cx)} ${n(cy + r)}V${CELL_H}`);
    else if (cell.ch === '╮') addPath(cell, `M${left} ${cy}A${r} ${r} 0 0 1 ${n(cx)} ${n(cy + r)}V${CELL_H}`);
    else if (cell.ch === '╰') addPath(cell, `M${n(cx)} 0V${n(cy - r)}A${r} ${r} 0 0 0 ${left + CELL_W} ${cy}`);
    else if (cell.ch === '╯') addPath(cell, `M${n(cx)} 0V${n(cy - r)}A${r} ${r} 0 0 1 ${left} ${cy}`);
  }
  for (const [cls, d] of paths) parts.push(`<path class="l ${cls}" d="${d}"/>`.replace(' "', '"'));
  // Blocks (meters, cursor) as rects.
  for (let x = 0; x < COLUMNS; ) {
    const cell = cells[x];
    if (!BLOCK.has(cell.ch)) {
      x++;
      continue;
    }
    let end = x + 1;
    while (end < COLUMNS && cells[end].ch === cell.ch && sameStyle(cells[end], cell)) end++;
    const cls = [colorClass(cell.fg) || 'cf', cell.ch === '░' ? 'sh' : '', cell.dim ? 'd' : ''].filter(Boolean).join(' ');
    const inset = cell.ch === '░' ? 3 : 1;
    parts.push(`<rect class="${cls}" x="${x * CELL_W}" y="${inset}" width="${(end - x) * CELL_W}" height="${CELL_H - 2 * inset}"/>`);
    x = end;
  }
  // Underlines as rects in the text color.
  for (let x = 0; x < COLUMNS; ) {
    const cell = cells[x];
    if (!cell.ul) {
      x++;
      continue;
    }
    let end = x + 1;
    while (end < COLUMNS && cells[end].ul && sameStyle(cells[end], cell)) end++;
    const cls = [colorClass(cell.fg) || 'cf', cell.dim ? 'd' : ''].filter(Boolean).join(' ');
    parts.push(`<rect class="${cls}" x="${x * CELL_W}" y="${BASELINE + 2}" width="${(end - x) * CELL_W}" height="1"/>`);
    x = end;
  }
  // Text runs, each placed at its column and stretched to its cells.
  for (let x = 0; x < COLUMNS; ) {
    const cell = cells[x];
    if (cell.ch === ' ' || BOX.has(cell.ch) || BLOCK.has(cell.ch)) {
      x++;
      continue;
    }
    let end = x + 1;
    while (end < COLUMNS && !BOX.has(cells[end].ch) && !BLOCK.has(cells[end].ch) && sameStyle(cells[end], cell)) end++;
    let text = cells.slice(x, end).map((c) => c.ch).join('');
    const trimmed = text.replace(/ +$/, '');
    const len = Array.from(trimmed).length;
    const cls = [colorClass(cell.fg), cell.bold ? 'b' : '', cell.dim ? 'd' : ''].filter(Boolean).join(' ');
    const fit = len > 1 ? ` textLength="${len * CELL_W}"` : '';
    parts.push(`<text${cls ? ` class="${cls}"` : ''} x="${x * CELL_W}" y="${BASELINE}"${fit}>${esc(trimmed)}</text>`);
    x = end;
  }
  return parts.join('');
}

/**
 * The animated SVG for a timeline of [{ raw, ms }]. Rows and frames are
 * defined once and reused; a strip of frames moves up one screen per step.
 */
export function toSvg(timeline, { title }) {
  const rowIds = new Map();
  const rowDefs = [];
  const frameIds = new Map();
  const frameDefs = [];
  const steps = [];
  for (const { raw, ms } of timeline) {
    const uses = [];
    parseFrame(raw).forEach((cells, y) => {
      const markup = rowMarkup(cells);
      if (!markup) return;
      if (!rowIds.has(markup)) {
        rowIds.set(markup, `r${rowIds.size.toString(36)}`);
        rowDefs.push(`<g id="${rowIds.get(markup)}">${markup}</g>`);
      }
      uses.push(`<use href="#${rowIds.get(markup)}" y="${y * CELL_H}"/>`);
    });
    const key = uses.join('');
    if (!frameIds.has(key)) {
      frameIds.set(key, `f${frameIds.size.toString(36)}`);
      frameDefs.push(`<g id="${frameIds.get(key)}">${key}</g>`);
    }
    const id = frameIds.get(key);
    if (steps.length > 0 && steps.at(-1).id === id) steps.at(-1).ms += ms;
    else steps.push({ id, ms });
  }

  const screenW = COLUMNS * CELL_W;
  const screenH = ROWS * CELL_H;
  const width = screenW + 2 * PAD;
  const height = BAR + screenH + 2 * PAD;
  const total = steps.reduce((sum, s) => sum + s.ms, 0);
  let at = 0;
  const keyframes = steps.map((s, i) => {
    const pct = (at / total) * 100;
    at += s.ms;
    return `${n(pct)}%{transform:translateY(${-i * screenH}px)}`;
  });
  keyframes.push(`100%{transform:translateY(${-(steps.length - 1) * screenH}px)}`);
  const strip = steps.map((s, i) => `<use href="#${s.id}" y="${i * screenH}"/>`).join('');

  const colorCss = COLOR_NAMES.map((name, i) => `.c${i.toString(16)}{fill:${PALETTE[name]}}.l.c${i.toString(16)}{stroke:${PALETTE[name]};fill:none}`).join('');
  const css = [
    `text{font:${FONT_SIZE}px ui-monospace,SFMono-Regular,Menlo,Consolas,'DejaVu Sans Mono','Liberation Mono',monospace;fill:${DEFAULT_FG};white-space:pre}`,
    `.cf{fill:${DEFAULT_FG}}.l{fill:none;stroke:${DEFAULT_FG};stroke-width:1.2}`,
    colorCss,
    '.b{font-weight:700}.d{opacity:.5}.sh{opacity:.35}.sh.d{opacity:.18}',
    `.t{font-size:12px;fill:#9d9d9d}`,
    `.s{animation:play ${n(total / 1000)}s step-end infinite}`,
    `@keyframes play{${keyframes.join('')}}`
  ].join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">`,
    `<title>${esc(title)}</title>`,
    `<style>${css}</style>`,
    `<defs>${rowDefs.join('')}${frameDefs.join('')}<clipPath id="screen"><rect width="${screenW}" height="${screenH}"/></clipPath></defs>`,
    `<rect width="${width}" height="${height}" rx="10" fill="${BACKGROUND}" stroke="#3c3c3c"/>`,
    `<path d="M0 ${BAR}H${width}" stroke="#2d2d2d"/>`,
    `<circle cx="18" cy="15" r="6" fill="#ff5f57"/><circle cx="38" cy="15" r="6" fill="#febc2e"/><circle cx="58" cy="15" r="6" fill="#28c840"/>`,
    `<text class="t" x="${width / 2}" y="19" text-anchor="middle">${esc(title)}</text>`,
    `<g transform="translate(${PAD} ${BAR + PAD})" clip-path="url(#screen)"><g class="s">${strip}</g></g>`,
    '</svg>',
    ''
  ].join('\n');
}

// --- Recording --------------------------------------------------------------

/** Frames of a renderTerminal session and how long each stays up. */
function recorder(t) {
  const timeline = [];
  return {
    timeline,
    /** Keep the current screen for `ms`. */
    hold(ms) {
      timeline.push({ raw: t.lastFrame(), ms });
    },
    /** Sample the screen every `every` ms for `ms` (animations, live data). */
    async watch(ms, every = 100) {
      for (let spent = 0; spent < ms; spent += every) {
        timeline.push({ raw: t.lastFrame(), ms: every });
        await new Promise((resolve) => setTimeout(resolve, every));
      }
    },
    /** Type text one key at a time, `ms` per key. */
    async type(text, ms = 70) {
      for (const ch of Array.from(text)) {
        await t.press(ch);
        timeline.push({ raw: t.lastFrame(), ms });
      }
    }
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function importFrom(app, specifier) {
  const dir = path.join(ROOT, app);
  if (specifier.startsWith('.')) return import(pathToFileURL(path.join(dir, specifier)).href);
  const pkg = path.join(dir, 'node_modules', specifier);
  const entry = specifier === 'react' ? 'index.js' : '';
  return import(pathToFileURL(path.join(pkg, entry)).href);
}

const SCENARIOS = {
  /** Browse, add to the cart, the cart, checkout with an invalid email. */
  async 'demo-shop'() {
    const React = (await importFrom('demo-shop', 'react')).default;
    const { renderTerminal } = await importFrom('demo-shop', '@shellcraft/ui/src/testing.js');
    const { ShopApp } = await importFrom('demo-shop', './src/ui/app.js');
    const { SessionManager } = await importFrom('demo-shop', './src/server/session.js');
    const t = renderTerminal(React.createElement(ShopApp, { session: new SessionManager().createSession(null) }), { columns: COLUMNS, rows: ROWS });
    const r = recorder(t);
    await sleep(50);
    r.hold(1600);
    await t.press('enter');
    r.hold(1400);
    await t.press('a');
    r.hold(1300);
    await t.press('down');
    r.hold(500);
    await t.press('down');
    r.hold(500);
    await t.press('a');
    r.hold(1500);
    await t.press('c');
    r.hold(2000);
    await t.press('c');
    r.hold(1200);
    await t.press('enter');
    r.hold(400);
    await r.type('Ada Lovelace');
    await t.press('enter');
    r.hold(500);
    await t.press('down', 'enter');
    r.hold(300);
    await r.type('ada@');
    await t.press('enter');
    r.hold(400);
    await t.press('down', 'enter');
    r.hold(300);
    await r.type('12 Analytical St');
    await t.press('enter');
    r.hold(500);
    await t.press('down');
    r.hold(900);
    await t.press('enter');
    r.hold(2600);
    await t.press('enter');
    r.hold(300);
    await r.type('example.com');
    await t.press('enter');
    r.hold(800);
    await t.press('down', 'down');
    r.hold(800);
    await t.press('enter');
    r.hold(2800);
    t.unmount();
    return { timeline: r.timeline, title: 'demo-shop · ssh localhost -p 2222' };
  },

  /** Home moving through the menu, live meters, logs following. */
  async 'admin-dashboard'() {
    const React = (await importFrom('admin-dashboard', 'react')).default;
    const { renderTerminal } = await importFrom('admin-dashboard', '@shellcraft/ui/src/testing.js');
    const { AdminApp } = await importFrom('admin-dashboard', './src/ui/app.js');
    const { DemoSystem, demoSession } = await importFrom('admin-dashboard', './test/helpers/demo-system.js');
    // Demo data that moves, so the meters and the log are live.
    class LiveSystem extends DemoSystem {
      tick() {
        this.ticks = (this.ticks ?? 0) + 1;
        return this.ticks;
      }
      getCPUPercent() {
        const i = this.tick();
        return Math.round(45 + 30 * Math.sin(i / 2.2));
      }
      getCPUUsage() {
        const i = this.ticks ?? 0;
        return super.getCPUUsage().map((core) => {
          const percent = Math.max(3, Math.min(97, Math.round(core.percent + 28 * Math.sin(i / 1.7 + core.core))));
          return { ...core, percent, usage: `${percent.toFixed(1)}%` };
        });
      }
      getMemoryUsage() {
        this.overrides.memory = 70 + ((this.ticks ?? 0) % 9) * 2.5;
        return super.getMemoryUsage();
      }
    }
    const t = renderTerminal(
      React.createElement(AdminApp, { session: demoSession(), system: new LiveSystem(), refreshMs: 400, terminal: 'xterm-256color' }),
      { columns: COLUMNS, rows: ROWS }
    );
    const r = recorder(t);
    await sleep(50);
    await r.watch(2000, 200);
    for (const _ of [1, 2]) {
      await t.press('down');
      await r.watch(1600, 200);
    }
    await t.press('down');
    await r.watch(1800, 200); // Logs summary
    await t.press('1', 'down'); // back to the top, then CPU & memory
    await t.press('enter');
    await r.watch(3200, 200); // live meters per core
    await t.press('b', '4', 'enter');
    await r.watch(4000, 200); // the log follows new lines
    await t.press('b');
    r.hold(1200);
    t.unmount();
    return { timeline: r.timeline, title: 'admin-dashboard · ssh localhost -p 2222' };
  },

  /** Start, the busy spinner, a narrated turn, an action, the next turn. */
  async 'adventure-game'() {
    const React = (await importFrom('adventure-game', 'react')).default;
    const { renderTerminal } = await importFrom('adventure-game', '@shellcraft/ui/src/testing.js');
    const { AdventureApp } = await importFrom('adventure-game', './src/ui/app.js');
    const { stubLlm, tempSessions, testKey } = await importFrom('adventure-game', './test/helpers/adventure.js');
    const log = console.log;
    console.log = () => {};
    const store = tempSessions();
    try {
      const session = store.manager.createSession('ada', testKey('ada')); // signed in with a key: the game is saved
      const llm = stubLlm({ gate: true });
      const t = renderTerminal(
        React.createElement(AdventureApp, { session, saveGame: () => store.manager.saveSession(session.id), llm }),
        { columns: COLUMNS, rows: ROWS }
      );
      const r = recorder(t);
      await sleep(50);
      r.hold(1800);
      await t.press('enter');
      await r.watch(1600, 80); // the Game Master is thinking
      llm.release();
      await sleep(150);
      r.hold(3800);
      await t.press('down');
      r.hold(700);
      await t.press('down');
      r.hold(700);
      await t.press('enter');
      await r.watch(1300, 80);
      llm.release();
      await sleep(150);
      r.hold(3600);
      await t.press('tab');
      r.hold(500);
      await r.type('read the notice board', 60);
      r.hold(600);
      await t.press('enter');
      await r.watch(1300, 80);
      llm.release();
      await sleep(150);
      r.hold(3800);
      t.unmount();
      return { timeline: r.timeline, title: 'adventure-game · ssh ada@localhost -p 2222' };
    } finally {
      console.log = log;
      store.remove();
    }
  },

  /** A few animations, switching between them. */
  async 'animation-demo'() {
    const React = (await importFrom('animation-demo', 'react')).default;
    const { renderTerminal } = await importFrom('animation-demo', '@shellcraft/ui/src/testing.js');
    const { App } = await importFrom('animation-demo', './app.js');
    const t = renderTerminal(React.createElement(App), { columns: COLUMNS, rows: ROWS });
    const r = recorder(t);
    await sleep(50);
    await r.watch(3000, 50);
    for (const key of ['2', '4', '6']) {
      await t.press(key);
      await r.watch(3000, 50);
    }
    t.unmount();
    return { timeline: r.timeline, title: 'animation-demo · npm start' };
  }
};

async function recordOne(app) {
  const { timeline, title } = await SCENARIOS[app]();
  const svg = toSvg(timeline, { title });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${app}.svg`);
  fs.writeFileSync(file, svg);
  console.log(`${path.relative(ROOT, file)}: ${timeline.length} samples, ${(svg.length / 1024).toFixed(1)} KB`);
}

const args = process.argv.slice(2);
if (args[0] === '--app') {
  await recordOne(args[1]);
  process.exit(0);
} else {
  const wanted = args.length > 0 ? args : APPS;
  for (const app of wanted) {
    if (!SCENARIOS[app]) {
      console.error(`Unknown app: ${app} (${APPS.join(', ')})`);
      process.exit(1);
    }
    if (!fs.existsSync(path.join(ROOT, app, 'node_modules', '@shellcraft', 'ui'))) {
      console.error(`${app}: run npm ci in ${app}/ first`);
      process.exit(1);
    }
    // One process per app: each app has its own React, Ink and ui copy.
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--app', app], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
