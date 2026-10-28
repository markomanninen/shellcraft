// Build a static HTML board of the captured screens: one .board per app and size, plus a
// notes board with the palette actually used.
// Usage: node board.mjs <capture dir> <issues.json|-> <out.html>   (see capture-all.sh)
import fs from 'node:fs';

const [dir, issuesFile, out] = process.argv.slice(2);
const HERE = dir.endsWith('/') ? dir : dir + '/';
const APPS = ['admin-dashboard', 'demo-shop', 'adventure-game', 'animation-demo'];
const SIZES = ['100x30', '80x24'];
const LH = 17;

// VS Code Dark+ terminal ANSI colors; 16-255 are the standard xterm cube and grays.
const ANSI = ['#000000', '#cd3131', '#0dbc79', '#e5e510', '#2472c8', '#bc3fbc', '#11a8cd', '#e5e5e5',
  '#666666', '#f14c4c', '#23d18b', '#f5f543', '#3b8eea', '#d670d6', '#29b8db', '#e5e5e5'];
const NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'gray', 'bright red', 'bright green', 'bright yellow', 'bright blue', 'bright magenta', 'bright cyan', 'bright white'];
const DEF_FG = '#cccccc', DEF_BG = '#1e1e1e';
function color(i, def) {
  if (i === 511) return def;
  if (i < 16) return ANSI[i];
  if (i < 232) { const v = [0, 95, 135, 175, 215, 255], j = i - 16; return '#' + [v[Math.floor(j / 36)], v[Math.floor(j / 6) % 6], v[j % 6]].map((x) => x.toString(16).padStart(2, '0')).join(''); }
  const g = (8 + (i - 232) * 10).toString(16).padStart(2, '0'); return `#${g}${g}${g}`;
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const usage = new Map();   // "fg|bg|bold" -> {count, apps}

function decode(attr) {
  const flags = attr >> 18; let fg = (attr >> 9) & 511, bg = attr & 511;
  if (flags & 8) [fg, bg] = [bg === 511 ? 0 : bg, fg === 511 ? 7 : fg];   // inverse
  return { fg, bg, bold: !!(flags & 1), underline: !!(flags & 2) };
}

function screen(s) {
  const bgs = [], rows = [];
  s.lines.forEach((runs, r) => {
    let col = 0, html = '';
    for (const [attr, text] of runs) {
      const a = decode(attr), n = [...text].length;
      if (a.bg !== 511) bgs.push(`<div class="bg" style="left:${col}ch;top:${r * LH}px;width:${n}ch;background:${color(a.bg, DEF_BG)}"></div>`);
      if (text.trim()) {
        const key = `${a.fg}|${a.bg}|${a.bold ? 1 : 0}`;
        const u = usage.get(key) ?? { count: 0, apps: new Set() }; u.count += text.replace(/\s/g, '').length; u.apps.add(s.app); usage.set(key, u);
      }
      const st = [`color:${color(a.fg, DEF_FG)}`, a.bold && 'font-weight:700', a.underline && 'text-decoration:underline'].filter(Boolean).join(';');
      html += `<span style="${st}">${esc(text)}</span>`;
      col += n;
    }
    rows.push(`<pre class="line" style="top:${r * LH}px">${html}</pre>`);
  });
  return `<figure class="shot"><figcaption>${esc(s.name)}<span>${s.keys.length ? 'keys: ' + esc(s.keys.join(' ')) : 'first screen'}</span></figcaption>
<div class="term" style="width:${s.cols}ch;height:${s.rows * LH}px">${bgs.join('')}${rows.join('')}</div></figure>`;
}

const boards = [];
for (const app of APPS) for (const size of SIZES) {
  const RENAME = { 'menu item 1': 'inventory', 'menu item 2': 'journal', 'menu item 3': 'stats', 'menu item 4': 'help' };
  const seen = new Set();
  const shots = JSON.parse(fs.readFileSync(`${HERE}${app}-${size}.json`)).filter((s) => {
    const t = s.lines.map((l) => l.map(([, x]) => x).join('')).join('\n');
    if (!t.trim() || seen.has(t)) return false;
    seen.add(t); s.name = RENAME[s.name] ?? s.name; return true;
  });
  boards.push(`<section class="board" data-name="${app} ${size}"><h2>${app}<small>${size.replace('x', ' × ')} cells · ${shots.length} screens</small></h2><div class="shots">${shots.map(screen).join('\n')}</div></section>`);
}

const swatches = [...usage.entries()].sort((a, b) => b[1].count - a[1].count).map(([k, u]) => {
  const [fg, bg, bold] = k.split('|').map(Number);
  const label = `${fg === 511 ? 'default' : NAMES[fg] ?? fg} on ${bg === 511 ? 'default' : NAMES[bg] ?? bg}${bold ? ', bold' : ''}`;
  return `<div class="sw"><div class="chip" style="background:${color(bg, DEF_BG)};color:${color(fg, DEF_FG)};${bold ? 'font-weight:700' : ''}">Aa ─│┌</div><div><b>${label}</b><br>${u.count} chars · ${[...u.apps].join(', ')}</div></div>`;
}).join('');
const issues = issuesFile !== '-' ? JSON.parse(fs.readFileSync(issuesFile)) : [];

const notes = `<section class="board notes" data-name="Read me"><h1>Shellcraft · as-is terminal UI (blessed)</h1>
<p>Every reachable screen of the four demo apps, captured on ${new Date().toISOString().slice(0, 10)} from blessed's own cell buffer: each app's real router and UI code ran against a fake SSH stream at 100 × 30 and 80 × 24 cells. Admin data (hostname, processes, services, addresses) is invented demo data; the adventure game's LLM reply is a fixed stub. Text is editable; one text layer per terminal row.</p>
<p>Colors use the VS Code Dark+ terminal palette. The apps only name ANSI colors, so on a user's terminal they follow that terminal's theme: the same screen looks different on every machine.</p>
<h3>Colors in use (fg on bg, by characters drawn)</h3><div class="sws">${swatches}</div>
${issues.length ? `<h3>Observed issues</h3><ol>${issues.map((i) => `<li><b>${esc(i.where)}</b> — ${esc(i.what)}</li>`).join('')}</ol>` : ''}
</section>`;

fs.writeFileSync(out, `<!doctype html><html><head><meta charset="utf-8"><title>Shellcraft as-is</title><style>
body{margin:0;background:#f4f4f2;font-family:Inter,Helvetica,Arial,sans-serif;color:#222}
.board{display:block;width:max-content;vertical-align:top;margin:24px;padding:24px 28px;background:#fff;border-radius:12px}
.board h2{margin:0 0 16px;font-size:22px}.board h2 small{margin-left:12px;font-weight:400;color:#777;font-size:14px}
.shots{display:grid;grid-template-columns:repeat(4,max-content);gap:36px 28px}
.shot{margin:0}.shot figcaption{font-size:14px;font-weight:600;margin-bottom:6px}.shot figcaption span{font-weight:400;color:#888;margin-left:10px;font-size:12px}
.term{position:relative;background:${DEF_BG};font-family:'JetBrains Mono','Roboto Mono',Menlo,monospace;font-size:14px;line-height:${LH}px;border-radius:6px;box-shadow:0 0 0 10px ${DEF_BG}}
.term .line{position:absolute;left:0;margin:0;white-space:pre;font:inherit;line-height:${LH}px;color:${DEF_FG}}
.term .bg{position:absolute;height:${LH}px}
.notes{max-width:900px}.notes h1{margin:0 0 12px;font-size:28px}.notes p{line-height:1.5}
.sws{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px}.sw{display:flex;gap:12px;align-items:center;font-size:13px}
.chip{font-family:'JetBrains Mono',Menlo,monospace;padding:6px 10px;border-radius:4px;white-space:pre;min-width:70px}
.notes ol{line-height:1.5;padding-left:20px}
</style></head><body>${notes}${boards.join('\n')}</body></html>`);
console.log('wrote', out, fs.statSync(out).size, 'bytes,', boards.length, 'boards');
