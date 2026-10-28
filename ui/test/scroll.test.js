import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { useState } from 'react';
import { ScrollView, Table, SelectList, TextField, Panel, Screen, Box, Text, wrapText, textWidth } from '../src/index.js';
import { scrollLayout, maxScrollOffset, scrollToVisible } from '../src/selection.js';
import { renderTerminal, cleanupTerminals, styleAt, styleAtCell, boldDimText, tick } from '../src/testing.js';

const h = React.createElement;

afterEach(() => cleanupTerminals());

const widthOf = (line) => textWidth(line);

describe('wrapText', () => {
  it('wraps words and keeps the paragraph indent on wrapped lines', () => {
    const lines = wrapText('  Lanterns sway over the village square. A dry fountain stands at its centre.', 30);
    assert.deepEqual(lines, [
      '  Lanterns sway over the',
      '  village square. A dry',
      '  fountain stands at its',
      '  centre.'
    ]);
  });

  it('adds a hanging indent', () => {
    const lines = wrapText('T1 Arrived at the square and met the innkeeper', 20, { hangingIndent: 3 });
    assert.deepEqual(lines, ['T1 Arrived at the', '   square and met', '   the innkeeper']);
  });

  it('can drop the indent', () => {
    assert.deepEqual(wrapText('    indented text here', 12, { keepIndent: false }), ['indented', 'text here']);
  });

  it('breaks words longer than a line and keeps blank paragraphs', () => {
    assert.deepEqual(wrapText('abcdefghij\n\nok', 4), ['abcd', 'efgh', 'ij', '', 'ok']);
  });

  it('keeps runs of spaces inside a line', () => {
    assert.deepEqual(wrapText('PID   NAME', 20), ['PID   NAME']);
  });

  it('measures wide characters as two cells', () => {
    const lines = wrapText('日本語のテキスト', 6);
    assert.deepEqual(lines, ['日本語', 'のテキ', 'スト']);
    for (const line of lines) assert.ok(widthOf(line) <= 6);
  });

  it('never returns a line wider than the width', () => {
    const text = 'The quick brown fox jumps over the lazy dog, again and again, supercalifragilistic.';
    for (let width = 1; width <= 40; width++) {
      for (const line of wrapText(`   ${text}`, width, { hangingIndent: 2 })) {
        assert.ok(widthOf(line) <= width, `width ${width}: "${line}"`);
      }
    }
  });
});

describe('scroll window arithmetic', () => {
  it('rows add up and every index can be brought into view', () => {
    for (let total = 0; total <= 30; total++) {
      for (let height = 1; height <= 12; height++) {
        const max = maxScrollOffset(total, height);
        for (let offset = 0; offset <= max; offset++) {
          const l = scrollLayout(total, height, offset);
          const used = l.count + (l.top ? 1 : 0) + (l.bottom ? 1 : 0);
          assert.ok(used <= height, `${total}/${height}/${offset}`);
          if (total >= height) assert.equal(used, height);
          assert.equal(l.above + l.count + l.below, total);
          assert.equal(l.top, l.above > 0 && height >= 3);
          assert.equal(l.bottom, l.below > 0 && height >= 3);
        }
        assert.equal(scrollLayout(total, height, max).below, 0, 'max offset reaches the end');
        let offset = 0;
        for (let index = 0; index < total; index++) {
          offset = scrollToVisible(total, height, offset, index);
          const l = scrollLayout(total, height, offset);
          assert.ok(index >= l.offset && index < l.offset + l.count, `index ${index} visible (${total}/${height})`);
        }
      }
    }
  });
});

describe('ScrollView', () => {
  const longText = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`).join('\n');

  it('shows a window with dim "↓ N more" / "↑ N more" rows', async () => {
    const t = renderTerminal(h(ScrollView, { text: longText, height: 5, width: 20 }), { columns: 40, rows: 10 });
    await tick(20);
    assert.deepEqual(t.lines().slice(0, 5), ['Line 1', 'Line 2', 'Line 3', 'Line 4', '↓ 16 more']);
    const raw = t.lastFrame();
    assert.equal(styleAt(raw, '↓ 16 more').dim, true);
    assert.equal(styleAt(raw, '↓ 16 more').fg, undefined, 'no colored scrollbar');
    assert.equal(styleAt(raw, 'Line 1').dim, false);

    await t.press('down');
    assert.deepEqual(t.lines().slice(0, 5), ['↑ 1 more', 'Line 2', 'Line 3', 'Line 4', '↓ 16 more']);
    t.unmount();
  });

  it('PgDn, End, PgUp, Home and k/j', async () => {
    const t = renderTerminal(h(ScrollView, { text: longText, height: 6, width: 20 }), { columns: 40, rows: 10 });
    await tick(20);
    await t.press('\u001B[6~'); // PgDn: a page is height - 2 rows
    assert.equal(t.lines()[0], '↑ 4 more');
    await t.press('\u001B[F'); // End
    assert.deepEqual(t.lines().slice(0, 6), ['↑ 15 more', 'Line 16', 'Line 17', 'Line 18', 'Line 19', 'Line 20']);
    await t.press('\u001B[5~'); // PgUp
    assert.equal(t.lines()[0], '↑ 11 more');
    await t.press('k');
    assert.equal(t.lines()[0], '↑ 10 more');
    await t.press('\u001B[H'); // Home
    assert.equal(t.lines()[0], 'Line 1');
    await t.press('j');
    assert.equal(t.lines()[0], '↑ 1 more');
    t.unmount();
  });

  it('wraps lines with a hanging indent and keeps the first-line indent', async () => {
    const lines = [
      '  Lanterns sway over the village square, and a notice board creaks.',
      { text: '✓ Your journey begins.', tone: 'success' },
      { text: 'T1 Arrived at the square and met the innkeeper', hangingIndent: 3 }
    ];
    const t = renderTerminal(h(ScrollView, { lines, height: 8, width: 24 }), { columns: 40, rows: 10 });
    await tick(20);
    assert.deepEqual(t.lines().slice(0, 7), [
      '  Lanterns sway over the',
      '  village square, and a',
      '  notice board creaks.',
      '✓ Your journey begins.',
      'T1 Arrived at the square',
      '   and met the innkeeper',
      ''
    ]);
    assert.equal(styleAt(t.lastFrame(), '✓ Your').fg, 'green', 'line tone');
    t.unmount();
  });

  it('follow: stays at the end as content grows, until scrolled up', async () => {
    function Log({ count }) {
      return h(ScrollView, { lines: Array.from({ length: count }, (_, i) => `event ${i + 1}`), height: 4, width: 20, follow: true });
    }
    const t = renderTerminal(h(Log, { count: 10 }), { columns: 40, rows: 6 });
    await tick(20);
    assert.deepEqual(t.lines().slice(0, 4), ['↑ 7 more', 'event 8', 'event 9', 'event 10']);
    t.rerender(h(Log, { count: 12 }));
    await tick(20);
    assert.deepEqual(t.lines().slice(0, 4), ['↑ 9 more', 'event 10', 'event 11', 'event 12']);
    await t.press('up');
    t.rerender(h(Log, { count: 14 }));
    await tick(20);
    assert.deepEqual(t.lines().slice(0, 4), ['↑ 8 more', 'event 9', 'event 10', '↓ 4 more'], 'user scrolled up: no jump');
    t.unmount();
  });

  it('controlled offset', async () => {
    const seen = [];
    function Controlled() {
      const [offset, setOffset] = useState(3);
      return h(ScrollView, { text: longText, height: 5, width: 20, offset, onOffsetChange: (o) => { seen.push(o); setOffset(o); } });
    }
    const t = renderTerminal(h(Controlled), { columns: 40, rows: 8 });
    await tick(20);
    assert.equal(t.lines()[1], 'Line 4');
    await t.press('down');
    assert.deepEqual(seen, [4]);
    assert.equal(t.lines()[1], 'Line 5');
    t.unmount();
  });

  it('rows: arbitrary one-row nodes', async () => {
    const rows = Array.from({ length: 8 }, (_, i) => h(Text, { key: i, bold: i === 0 }, `row ${i}`));
    const t = renderTerminal(h(ScrollView, { rows, height: 4 }), { columns: 30, rows: 6 });
    await tick(20);
    assert.deepEqual(t.lines().slice(0, 4), ['row 0', 'row 1', 'row 2', '↓ 5 more']);
    t.unmount();
  });

  it('fills a panel and measures itself when no size is given', async () => {
    const t = renderTerminal(
      h(
        Screen,
        { app: 'Admin', screen: 'Logs', hints: [['↑↓', 'scroll']] },
        h(Panel, { title: 'Logs', focused: true }, h(ScrollView, { text: Array.from({ length: 50 }, (_, i) => `log line ${i + 1} ${'x'.repeat(i % 7 === 0 ? 120 : 10)}`).join('\n') }))
      ),
      { columns: 80, rows: 24 }
    );
    await tick(40);
    const lines = t.lines();
    assert.equal(lines.length, 24);
    // Panel body: rows 3..20 inside the padding, wrapped to the 76-cell width;
    // a word longer than the line starts on its own line and is broken.
    assert.equal(lines[3], `│ log line 1${' '.repeat(66)} │`);
    assert.equal(lines[4], `│ ${'x'.repeat(76)} │`);
    assert.equal(lines[5], `│ ${'x'.repeat(44)}${' '.repeat(32)} │`);
    assert.ok(lines[20].startsWith('│ ↓ '), lines[20]);
    for (const line of lines) assert.ok(widthOf(line) <= 80);
    assert.equal(boldDimText(t.lastFrame()), '');
    t.unmount();
  });

  it('a short text needs no indicators', async () => {
    const t = renderTerminal(h(ScrollView, { text: 'one\ntwo', height: 5, width: 10 }), { columns: 20, rows: 6 });
    await tick(20);
    assert.ok(!t.text().includes('more'));
    t.unmount();
  });
});

describe('Table and SelectList with height', () => {
  const columns = [
    { label: 'PID', width: 5, align: 'right' },
    { label: 'Name', width: 12, grow: true }
  ];
  const rows = Array.from({ length: 30 }, (_, i) => [String(100 + i), `proc-${i}`]);

  it('header stays, the selected row stays visible, more-indicators show', async () => {
    const t = renderTerminal(h(Box, { width: 30 }, h(Table, { columns, rows, height: 6 })), { columns: 40, rows: 10 });
    await tick(20);
    let out = t.lines();
    assert.ok(out[0].includes('PID') && out[0].includes('Name'));
    assert.equal(out[1].trim(), '100 proc-0');
    assert.equal(out[6].trim(), '↓ 25 more');
    for (let i = 1; i < 30; i++) {
      await t.press('down');
      out = t.lines();
      assert.ok(out[0].includes('PID'), 'header stays');
      assert.equal(styleAt(t.lastFrame(), `proc-${i}`)?.bg, 'cyan', `row ${i} selected and visible`);
      assert.ok(out.length <= 8);
    }
    assert.equal(t.lines()[1].trim(), '↑ 25 more');
    assert.equal(styleAt(t.lastFrame(), '↑ 25 more').dim, true);
    t.unmount();
  });

  it('PgDn / End / Home move the selection', async () => {
    const t = renderTerminal(h(Box, { width: 30 }, h(Table, { columns, rows, height: 6 })), { columns: 40, rows: 10 });
    await tick(20);
    await t.press('\u001B[6~');
    assert.equal(styleAt(t.lastFrame(), 'proc-4').bg, 'cyan');
    await t.press('\u001B[F');
    assert.equal(styleAt(t.lastFrame(), 'proc-29').bg, 'cyan');
    await t.press('\u001B[H');
    assert.equal(styleAt(t.lastFrame(), 'proc-0').bg, 'cyan');
    t.unmount();
  });

  it('without a selection bar the keys scroll the rows', async () => {
    const t = renderTerminal(h(Box, { width: 30 }, h(Table, { columns, rows, height: 5, selectedIndex: -1 })), { columns: 40, rows: 10 });
    await tick(20);
    await t.press('down', 'down');
    const out = t.lines();
    assert.equal(out[1].trim(), '↑ 2 more');
    assert.equal(out[2].trim(), '102 proc-2');
    assert.ok(!t.lastFrame().includes('\u001B[46m'), 'no selection bar');
    t.unmount();
  });

  it('SelectList scrolls with indicators aligned to the labels', async () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ label: `Item ${i}` }));
    const t = renderTerminal(h(Box, { width: 24 }, h(SelectList, { items, height: 5 })), { columns: 30, rows: 8 });
    await tick(20);
    assert.equal(t.lines()[4], '   ↓ 8 more');
    await t.press('\u001B[B', '\u001B[B', '\u001B[B', '\u001B[B');
    assert.equal(t.lines()[0], '   ↑ 2 more');
    assert.ok(t.lines().some((l) => l.startsWith(' › Item 4')));
    t.unmount();
  });
});

describe('TextField across the width', () => {
  it("valueWidth 'fill' takes the rest of the row; a long value scrolls with the cursor at the end", async () => {
    function Prompt() {
      const [value, setValue] = useState('');
      return h(Box, { width: 40 }, h(TextField, { label: '>', labelWidth: 2, valueWidth: 'fill', value, focused: true, onChange: setValue }));
    }
    const t = renderTerminal(h(Prompt), { columns: 60, rows: 4 });
    await tick(30);
    assert.equal(t.lines()[0], '> █' + ' '.repeat(37), 'cursor right after the label column, underline to cell 40');
    assert.equal(styleAtCell(t.lastFrame(), 0, 39).underline, true, 'underline reaches cell 40');
    await t.write('talk to the innkeeper about the old map and the elder seal');
    const line = t.lines()[0];
    assert.equal(widthOf(line), 40);
    assert.ok(line.startsWith('> …'), line);
    assert.ok(line.endsWith('the elder seal█'), line);
    t.unmount();
  });

  it('counts wide characters as two cells', async () => {
    const t = renderTerminal(h(Box, { width: 30 }, h(TextField, { label: 'Name', value: '日本語のテキストとても長い名前です', valueWidth: 16, labelWidth: 6 })), { columns: 40, rows: 3 });
    await tick(20);
    assert.ok(widthOf(t.lines()[0]) <= 22, t.lines()[0]);
    assert.ok(t.lines()[0].trimEnd().endsWith('…'), t.lines()[0]);
    t.unmount();
  });
});

