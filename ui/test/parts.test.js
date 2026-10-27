import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { useState } from 'react';
import {
  InfoRow,
  infoRows,
  BlankRow,
  useData,
  useAnimation,
  SelectList,
  ScrollView,
  Screen,
  Box,
  Text,
  wrappedRowCount,
  maxScrollOffset,
  wrapSegments,
  truncateToWidth,
  hintsWidth,
  textWidth
} from '../src/index.js';
import { renderTerminal, cleanupTerminals, styleAt, boldDimText, tick } from '../src/testing.js';

const h = React.createElement;

afterEach(() => cleanupTerminals());

describe('InfoRow / infoRows', () => {
  it('muted label column, value after it, both truncated', async () => {
    const t = renderTerminal(
      h(Box, { flexDirection: 'column', width: 30 },
        h(InfoRow, { label: 'Hostname', value: 'demo-server' }),
        h(InfoRow, { label: 'Architecture', value: 'x64', labelWidth: 8 }),
        h(InfoRow, { label: 'Objective', value: 'none', tone: 'muted', bold: true }),
        h(InfoRow, { label: 'Threat', value: 'Goblin 3/7 HP and a very long description', tone: 'warning', bold: true })
      ),
      { columns: 40, rows: 6 }
    );
    await tick(20);
    const lines = t.lines();
    assert.equal(lines[0], 'Hostname   demo-server');
    assert.equal(lines[1], 'Archit… x64', 'a cut label still leaves one cell before the value');
    assert.equal(lines[2], 'Objective  none');
    assert.equal(textWidth(lines[3]), 30);
    assert.ok(lines[3].endsWith('…'));
    const raw = t.lastFrame();
    assert.equal(styleAt(raw, 'Hostname').dim, true);
    assert.equal(styleAt(raw, 'demo-server').dim, false);
    assert.deepEqual(styleAt(raw, 'none'), { fg: undefined, bg: undefined, bold: false, dim: true, underline: false }, 'muted value is not bold');
    assert.equal(styleAt(raw, 'Goblin').fg, 'yellow');
    assert.equal(styleAt(raw, 'Goblin').bold, true);
    assert.equal(boldDimText(raw), '');
    t.unmount();
  });

  it('infoRows: [label, value, tone] rows, null for a blank row', async () => {
    const rows = infoRows([['CPU', '41%'], null, ['Load', 'high', 'danger']], 6);
    assert.equal(rows.length, 3);
    assert.equal(rows[1].type, BlankRow);
    const t = renderTerminal(h(Box, { flexDirection: 'column', width: 20 }, ...rows), { columns: 20, rows: 4 });
    await tick(20);
    assert.deepEqual(t.lines().slice(0, 3), ['CPU   41%', '', 'Load  high']);
    assert.equal(styleAt(t.lastFrame(), 'high').fg, 'red');
    t.unmount();
  });
});

describe('useData', () => {
  function View({ load, interval }) {
    const { data, error, loading } = useData(load, { interval });
    return h(Text, null, `${loading ? 'loading' : 'ready'} ${data ?? '-'} ${error ?? ''}`.trim());
  }

  it('a sync loader renders data on the first frame and reloads on an interval', async () => {
    let n = 0;
    const t = renderTerminal(h(View, { load: () => ++n, interval: 30 }), { columns: 30, rows: 2 });
    assert.equal(t.frames[0].trim(), 'ready 1');
    await tick(110);
    assert.ok(n >= 3, `reloaded ${n} times`);
    t.unmount();
    const after = n;
    await tick(80);
    assert.equal(n, after, 'no reloads after unmount');
  });

  it('an async loader shows loading, then data; errors keep the data', async () => {
    let fail = false;
    let calls = 0;
    const load = () => {
      calls++;
      return new Promise((resolve, reject) => setTimeout(() => (fail ? reject(new Error('ps failed')) : resolve(`v${calls}`)), 10));
    };
    let refresh;
    function Probe() {
      const state = useData(load);
      refresh = state.refresh;
      return h(Text, null, `${state.loading ? 'loading' : 'ready'} ${state.data ?? '-'} ${state.error ?? ''}`.trim());
    }
    const t = renderTerminal(h(Probe), { columns: 40, rows: 2 });
    assert.equal(t.text().trim(), 'loading -');
    await tick(40);
    assert.equal(t.text().trim(), 'ready v1');
    fail = true;
    assert.equal(await refresh(), true);
    await tick(20);
    assert.equal(t.text().trim(), 'ready v1 ps failed');
    t.unmount();
  });

  it('skips a tick while a load is running and drops stale and late results', async () => {
    const resolvers = [];
    let calls = 0;
    const load = () => {
      calls++;
      return new Promise((resolve) => resolvers.push(resolve));
    };
    let refresh;
    function Probe() {
      const state = useData(load, { interval: 20 });
      refresh = state.refresh;
      return h(Text, null, String(state.data ?? '-'));
    }
    const t = renderTerminal(h(Probe), { columns: 20, rows: 2 });
    await tick(90);
    assert.equal(calls, 1, 'no new load while the first is running');
    const second = refresh(); // a newer load: the first one's result is stale now
    resolvers[0]('old');
    resolvers[1]('new');
    assert.equal(await second, true);
    await tick(20);
    assert.equal(t.text().trim(), 'new');
    const late = refresh();
    t.unmount();
    resolvers.at(-1)('too late');
    assert.equal(await late, false, 'a result after unmount is dropped');
  });
});

describe('useAnimation', () => {
  it('is re-exported from Ink', async () => {
    function Frames() {
      const { frame } = useAnimation({ interval: 20 });
      return h(Text, null, `frame ${frame}`);
    }
    const t = renderTerminal(h(Frames), { columns: 20, rows: 2 });
    await tick(90);
    assert.match(t.text(), /frame [1-9]/);
    t.unmount();
  });
});

describe('SelectList focused={false}', () => {
  it('shows the items without a selection bar and takes no keys', async () => {
    const chosen = [];
    const items = [{ label: 'Look around', hint: '1' }, { label: 'Open the door', hint: '2', disabled: true }];
    const t = renderTerminal(
      h(Box, { width: 30 }, h(SelectList, { items, focused: false, onSelect: (i) => chosen.push(i) })),
      { columns: 30, rows: 3 }
    );
    await tick(20);
    assert.deepEqual(t.lines().slice(0, 2), ['   Look around              1', '   Open the door            2']);
    assert.ok(!t.lastFrame().includes('\u001B[46m'), 'no cyan bar');
    assert.equal(styleAt(t.lastFrame(), 'Open the door').dim, true, 'disabled items stay muted');
    await t.press('enter', 'down');
    assert.deepEqual(chosen, []);
    t.unmount();
  });
});

describe('ScrollView: page keys and styled segments', () => {
  it("keys: 'page' scrolls with PgUp/PgDn/Home/End only, so ↑↓ can drive a list", async () => {
    const picked = [];
    function Room() {
      const [index, setIndex] = useState(0);
      return h(
        Box,
        { flexDirection: 'column', width: 30 },
        h(ScrollView, { text: Array.from({ length: 12 }, (_, i) => `story ${i + 1}`).join('\n'), height: 4, keys: 'page' }),
        h(SelectList, { items: [{ label: 'a' }, { label: 'b' }], selectedIndex: index, onChange: (i) => { picked.push(i); setIndex(i); } })
      );
    }
    const t = renderTerminal(h(Room), { columns: 30, rows: 8 });
    await tick(40);
    assert.equal(t.lines()[0], 'story 1');
    await t.press('down');
    assert.equal(t.lines()[0], 'story 1', '↓ went to the list');
    assert.deepEqual(picked, [1]);
    await t.press('\u001B[6~');
    assert.equal(t.lines()[0], '↑ 2 more');
    await t.press('\u001B[F');
    assert.equal(t.lines()[0], '↑ 9 more');
    await t.press('\u001B[H');
    assert.equal(t.lines()[0], 'story 1');
    t.unmount();
  });

  it('lines with segments: a muted turn number and the entry, wrapped under the text', async () => {
    const lines = [
      { segments: [{ text: 'T1  ', tone: 'muted' }, { text: 'Arrived at the square and met the innkeeper' }], hangingIndent: 4, keepIndent: false },
      { segments: [{ text: 'T12 ', tone: 'muted' }, { text: 'Found the ' }, { text: 'Elder Seal', tone: 'success', bold: true }] , hangingIndent: 4 }
    ];
    const t = renderTerminal(h(ScrollView, { lines, width: 24, height: 6 }), { columns: 30, rows: 7 });
    await tick(20);
    assert.deepEqual(t.lines().slice(0, 4), [
      'T1  Arrived at the',
      '    square and met the',
      '    innkeeper',
      'T12 Found the Elder Seal'
    ]);
    const raw = t.lastFrame();
    assert.equal(styleAt(raw, 'T1').dim, true);
    assert.equal(styleAt(raw, 'Arrived').dim, false);
    assert.equal(styleAt(raw, 'square').dim, false, 'wrapped text keeps its own style');
    assert.equal(styleAt(raw, 'Elder').fg, 'green');
    assert.equal(styleAt(raw, 'Elder').bold, true);
    assert.equal(boldDimText(raw), '');
    assert.equal(wrappedRowCount(lines, 24), 4);
    t.unmount();
  });

  it('wrapSegments splits styles at wrap points', () => {
    const muted = { text: 'T1 ', tone: 'muted' };
    const body = { text: 'one two three' };
    const out = wrapSegments([muted, body], 9, { hangingIndent: 3, keepIndent: false });
    assert.deepEqual(out.map((line) => line.map((p) => p.text)), [['T1 ', 'one'], ['   ', 'two'], ['   ', 'three']]);
    assert.equal(out[0][0].style, muted);
    assert.equal(out[1][0].style, null, 'the indent has no style');
    assert.equal(out[1][1].style, body);
  });

  it('wrappedRowCount + maxScrollOffset drive a controlled view to its end', async () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1} with a few more words`);
    const rowsNeeded = wrappedRowCount(lines, 14);
    assert.equal(rowsNeeded, 20, 'two rows a line: "line 1 with a" / "few more words"');
    const offset = maxScrollOffset(rowsNeeded, 5);
    const t = renderTerminal(h(ScrollView, { lines, width: 14, height: 5, offset, onOffsetChange: () => {} }), { columns: 20, rows: 6 });
    await tick(20);
    assert.equal(t.lines()[4], 'few more words');
    assert.equal(wrappedRowCount('a b c', 1), 3, 'a text string works too');
    t.unmount();
  });
});

describe('StatusBar: the message gives way before the hints', () => {
  const hints = [['↑↓', 'move'], ['tab', 'ask'], ['i', 'items'], ['j', 'journal'], ['m', 'map'], ['h', 'menu'], ['q', 'quit']];
  const message = { tone: 'error', text: 'The Game Master failed: connect ECONNREFUSED 127.0.0.1:11434' };

  it('shortens the message with … and keeps every hint', async () => {
    const t = renderTerminal(h(Screen, { app: 'A', hints, message }, h(Text, null, 'x')), { columns: 80, rows: 5 });
    await tick(20);
    const status = t.lines().at(-1);
    assert.equal(textWidth(status), 79);
    assert.ok(status.startsWith(' ↑↓ move  tab ask  i items  j journal  m map  h menu  q quit  ✗ The Game'), status);
    assert.ok(status.endsWith('…'), status);
    assert.equal(hintsWidth(hints), textWidth('↑↓ move  tab ask  i items  j journal  m map  h menu  q quit'));
    t.unmount();
  });

  it('a message that fits is shown whole, right-aligned', async () => {
    const t = renderTerminal(h(Screen, { app: 'A', hints: hints.slice(0, 2), message }, h(Text, null, 'x')), { columns: 100, rows: 5 });
    await tick(20);
    assert.ok(t.lines().at(-1).endsWith('✗ The Game Master failed: connect ECONNREFUSED 127.0.0.1:11434'));
    t.unmount();
  });

  it('on a very narrow screen the message keeps 12 cells and the hints are cut', async () => {
    const t = renderTerminal(h(Screen, { app: 'A', hints, message }, h(Text, null, 'x')), { columns: 40, rows: 4 });
    await tick(20);
    const status = t.lines().at(-1);
    assert.ok(textWidth(status) <= 40);
    assert.ok(status.endsWith('  ✗ The Game…'), status);
    assert.ok(status.includes('…  ✗'), 'the hints were cut, not dropped');
    t.unmount();
  });

  it('truncateToWidth', () => {
    assert.equal(truncateToWidth('hello world', 5), 'hell…');
    assert.equal(truncateToWidth('hello world', 7), 'hello…', 'no space before the ellipsis');
    assert.equal(truncateToWidth('hello', 5), 'hello');
    assert.equal(truncateToWidth('日本語', 4), '日…');
  });
});
