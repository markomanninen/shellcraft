import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { Screen, Panel, SelectList, Table, Meter, TextField, Button, EmptyState, Message, Box, Text } from '../src/index.js';
import { renderTerminal, cleanupTerminals, stripAnsi, styleAt, boldDimText } from '../src/testing.js';

const h = React.createElement;
const width = (line) => Array.from(line).length;

afterEach(() => {
  cleanup();
  cleanupTerminals();
});

const hints = [['↑↓', 'move'], ['⏎', 'open'], ['q', 'quit']];

// The "Menu + detail" template from the Figma file.
const menuDetail = (props = {}) =>
  h(
    Screen,
    { app: 'Admin', screen: 'Dashboard', meta: 'demo-server', hints, message: { tone: 'success', text: 'Connected' }, ...props },
    h(
      Box,
      { flexGrow: 1 },
      h(
        Panel,
        { title: 'Menu', focused: true, width: 30, padding: 0 },
        h(SelectList, {
          isActive: false,
          items: ['System overview', 'CPU & memory', 'Processes', 'Logs'].map((label, i) => ({ label, hint: String(i + 1) }))
        })
      ),
      h(
        Panel,
        { title: 'System overview' },
        h(Text, null, 'Hostname  demo-server'),
        h(Meter, { label: 'CPU', value: 41 })
      )
    )
  );

// The "Table" template.
const tableScreen = (props = {}) =>
  h(
    Screen,
    { app: 'Demo Shop', screen: 'Products', meta: 'cart: 1 · $24.99', hints, ...props },
    h(
      Panel,
      { title: 'Products', focused: true, padding: 0 },
      h(Table, {
        isActive: false,
        columns: [
          { label: 'ID', width: 10 },
          { label: 'Name', width: 24 },
          { label: 'Description', width: 30, grow: true },
          { label: 'Price', width: 9, align: 'right' }
        ],
        rows: [['prod_001', 'Developer Blend', 'Dark roast for late nights', '$24.99']]
      })
    )
  );

function assertLayout(frame, columns, rows, { title, status }) {
  const out = stripAnsi(frame).split('\n');
  assert.equal(out.length, rows, `${rows} rows`);
  for (const [i, line] of out.entries()) {
    assert.ok(width(line) <= columns, `row ${i} is ${width(line)} cells wide (max ${columns}): "${line}"`);
  }
  assert.ok(out[0].startsWith(` ${title}`), `row 0 is the title bar: "${out[0]}"`);
  assert.ok(out[rows - 1].startsWith(` ${status}`), `last row is the status bar: "${out[rows - 1]}"`);
  // The body fills everything in between: first and last body rows are panel edges.
  assert.ok(out[1].startsWith('╭'), 'body starts on row 1');
  assert.ok(out[rows - 2].startsWith('╰'), 'body ends on the row above the status bar');
  return out;
}

describe('Screen', () => {
  for (const [columns, rows] of [[80, 24], [100, 30]]) {
    it(`menu + detail at ${columns}x${rows} (explicit size)`, () => {
      const r = render(menuDetail({ width: columns, height: rows }));
      const out = assertLayout(r.lastFrame(), columns, rows, { title: 'Admin › Dashboard', status: '↑↓ move' });
      assert.ok(out[0].endsWith('demo-server'));
      assert.ok(out[rows - 1].endsWith('✓ Connected'));
      // Menu panel is 30 cells, the detail panel takes the rest of the row.
      assert.equal(out[1].indexOf('╮'), 29);
      assert.equal(width(out[1]), columns);
    });

    it(`table at ${columns}x${rows} (size from the terminal)`, () => {
      const t = renderTerminal(tableScreen(), { columns, rows });
      const out = assertLayout(t.lastFrame(), columns, rows, { title: 'Demo Shop › Products', status: '↑↓ move' });
      // Price stays right-aligned against the panel's right padding.
      const row = out.find((l) => l.includes('prod_001'));
      assert.ok(row.endsWith('$24.99 │'), row);
      t.unmount();
    });
  }

  it('title bar: app bold cyan, separator muted, screen bold', () => {
    const raw = render(menuDetail({ width: 80, height: 24 })).lastFrame();
    assert.deepEqual(styleAt(raw, 'Admin'), { fg: 'cyan', bg: undefined, bold: true, dim: false, underline: false });
    assert.equal(styleAt(raw, '›').fg, undefined);
    assert.equal(styleAt(raw, '›').dim, true);
    assert.equal(styleAt(raw, 'Dashboard').bold, true);
  });

  it('follows the terminal on resize', async () => {
    const t = renderTerminal(menuDetail(), { columns: 80, rows: 24 });
    assertLayout(t.lastFrame(), 80, 24, { title: 'Admin', status: '↑↓' });
    await t.resize(100, 30);
    assertLayout(t.lastFrame(), 100, 30, { title: 'Admin', status: '↑↓' });
    await t.resize(60, 18);
    assertLayout(t.lastFrame(), 60, 18, { title: 'Admin', status: '↑↓' });
    t.unmount();
  });

  it('wide content stays inside a flexible panel', () => {
    const t = renderTerminal(
      h(
        Screen,
        { app: 'Admin', screen: 'Logs', hints },
        h(
          Box,
          { flexGrow: 1 },
          h(Panel, { title: 'Menu', width: 30 }),
          h(Panel, { title: 'Detail' }, h(Text, { wrap: 'truncate-end' }, 'y'.repeat(120)), h(Text, null, 'x'.repeat(120)))
        )
      ),
      { columns: 80, rows: 12 }
    );
    const out = assertLayout(t.lastFrame(), 80, 12, { title: 'Admin', status: '↑↓' });
    assert.ok(out[1].endsWith('╮'));
    assert.equal(width(out[1]), 80);
    assert.ok(out[3].endsWith('y… │'), out[3]);
    t.unmount();
  });

  it('never combines bold and dim (one intensity attribute on some terminals)', () => {
    const everything = h(
      Screen,
      { app: 'Admin', screen: 'All', meta: 'meta', hints, message: { tone: 'busy', text: 'Working' } },
      h(
        Box,
        { flexGrow: 1 },
        h(
          Panel,
          { title: 'Menu', width: 30, padding: 0 },
          h(SelectList, { isActive: false, items: [{ label: 'One', hint: '1' }, { label: 'Off', hint: '2', disabled: true }] }),
          h(Table, { isActive: false, selectedIndex: -1, columns: [{ label: 'Head', width: 8 }], rows: [['cell']] })
        ),
        h(
          Panel,
          { title: 'Detail', focused: true },
          h(Meter, { label: 'CPU', value: 50 }),
          h(TextField, { label: 'Name', placeholder: 'Your name' }),
          h(TextField, { label: 'Email', value: 'x@', error: 'Enter a full address' }),
          h(Button, { label: 'Save' }),
          h(Message, { tone: 'info' }, 'Info'),
          h(Box, { height: 4 }, h(EmptyState, { message: 'Nothing here.', hint: 'Go', k: 'b', label: 'back' }))
        )
      )
    );
    const t = renderTerminal(everything, { columns: 80, rows: 24 });
    assert.ok(t.lastFrame().includes('\u001B[2m'), 'muted text is dim');
    assert.equal(boldDimText(t.lastFrame()), '');
    t.unmount();
  });

  it('a narrow terminal still gets one title row and one status row', () => {
    const t = renderTerminal(tableScreen({ message: { tone: 'success', text: 'Added Developer Blend to cart' } }), { columns: 40, rows: 12 });
    assertLayout(t.lastFrame(), 40, 12, { title: 'Demo Shop', status: '↑↓' });
    t.unmount();
  });
});
