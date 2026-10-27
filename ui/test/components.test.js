import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { useState } from 'react';
import { render, cleanup } from 'ink-testing-library';
import {
  theme,
  textProps,
  borderProps,
  borderTextProps,
  DIM,
  KeyHint,
  Message,
  TitleBar,
  StatusBar,
  Panel,
  SelectList,
  ListItem,
  Table,
  TextField,
  Button,
  Meter,
  meterCells,
  METER_WIDTH,
  EmptyState,
  Box,
  Text
} from '../src/index.js';
import { stripAnsi, styleAt, styleAtCell, boldDimText, keys, tick } from '../src/testing.js';

const h = React.createElement;
const plain = (r) => stripAnsi(r.lastFrame());
const lines = (r) => plain(r).split('\n');
const width = (line) => Array.from(line).length;

/** Muted = the default foreground dimmed (SGR 2): no color, dim, not bold. */
function assertMuted(style, what = 'text') {
  assert.ok(style, `${what} is on screen`);
  assert.equal(style.fg, undefined, `${what}: no color`);
  assert.equal(style.dim, true, `${what}: dim`);
  assert.equal(style.bold, false, `${what}: not bold + dim`);
}

afterEach(() => cleanup());

describe('theme', () => {
  it('uses ANSI color names, or dim, only', () => {
    const names = new Set(['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']);
    for (const group of Object.values(theme)) {
      for (const value of Object.values(group)) {
        if (value !== undefined && value !== DIM) assert.ok(names.has(value), `${value} is not an ANSI name`);
      }
    }
    assert.equal(theme.text.default, undefined);
    assert.equal(theme.text.muted, DIM);
    assert.equal(theme.border.default, DIM);
    assert.equal(theme.surface.accent, 'cyan');
  });

  it('turns tokens into Ink props', () => {
    assert.deepEqual(textProps('muted'), { dimColor: true });
    assert.deepEqual(textProps('default'), {});
    assert.deepEqual(textProps('accent'), { color: 'cyan' });
    assert.deepEqual(textProps('danger'), { color: 'red' });
    assert.deepEqual(textProps('onAccent'), { color: 'black' });
    assert.deepEqual(borderProps('default'), { borderDimColor: true });
    assert.deepEqual(borderProps('focus'), { borderColor: 'cyan' });
    assert.deepEqual(borderProps('danger'), { borderColor: 'red' });
    assert.deepEqual(borderTextProps('default'), { dimColor: true });
    assert.deepEqual(borderTextProps('focus'), { color: 'cyan' });
    assert.throws(() => textProps('grey'), /Unknown text token/);
  });
});

describe('KeyHint', () => {
  it('renders key, one space, label', () => {
    const r = render(h(KeyHint, { k: 'q', label: 'quit' }));
    assert.equal(plain(r), 'q quit');
    assert.deepEqual(styleAt(r.lastFrame(), 'q'), { fg: 'cyan', bg: undefined, bold: true, dim: false, underline: false });
    assertMuted(styleAt(r.lastFrame(), 'quit'), 'verb');
  });
});

describe('Message', () => {
  const cases = [
    ['info', 'i', 'cyan', undefined],
    ['success', '✓', 'green', 'green'],
    ['warning', '!', 'yellow', 'yellow'],
    ['error', '✗', 'red', 'red']
  ];
  for (const [tone, glyph, glyphColor, textColor] of cases) {
    it(`${tone}: ${glyph} + text`, () => {
      const r = render(h(Message, { tone }, 'Saved it'));
      assert.equal(plain(r), `${glyph} Saved it`);
      assert.equal(styleAt(r.lastFrame(), glyph).fg, glyphColor);
      assert.equal(styleAt(r.lastFrame(), 'Saved').fg, textColor);
    });
  }

  it('busy: braille spinner in cyan and muted (dim) text', async () => {
    const r = render(h(Message, { tone: 'busy' }, 'Thinking'));
    assert.match(plain(r), /^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Thinking$/);
    const spinner = plain(r)[0];
    assert.equal(styleAt(r.lastFrame(), spinner).fg, 'cyan');
    assertMuted(styleAt(r.lastFrame(), 'Thinking'));
    await tick(250);
    assert.ok(r.frames.length > 1, 'spinner animates');
  });

  it('is one line', () => {
    const r = render(h(Box, { width: 20 }, h(Message, { tone: 'error' }, 'A very long error message that does not fit')));
    assert.equal(lines(r).length, 1);
    assert.ok(width(lines(r)[0]) <= 20);
  });
});

describe('TitleBar', () => {
  it('app › screen on the left, meta on the right, 1 cell padding', () => {
    const r = render(h(Box, { width: 60 }, h(TitleBar, { app: 'Demo Shop', screen: 'Products', meta: 'cart: 1' })));
    const line = lines(r)[0];
    assert.ok(line.startsWith(' Demo Shop › Products'));
    // Ink trims trailing blanks: meta ends one cell before the right edge.
    assert.ok(line.endsWith('cart: 1'));
    assert.equal(width(line), 59);
    const raw = r.lastFrame();
    assert.deepEqual(styleAt(raw, 'Demo Shop'), { fg: 'cyan', bg: undefined, bold: true, dim: false, underline: false });
    assertMuted(styleAt(raw, '›'), 'separator');
    assert.equal(styleAt(raw, 'Products').fg, undefined);
    assert.equal(styleAt(raw, 'Products').bold, true);
    assertMuted(styleAt(raw, 'cart: 1'), 'meta');
  });
});

describe('StatusBar', () => {
  it('hints separated by two spaces, message right-aligned', () => {
    const r = render(
      h(Box, { width: 70 }, h(StatusBar, {
        hints: [['↑↓', 'move'], ['a', 'add to cart'], ['b', 'back']],
        message: { tone: 'success', text: 'Added to cart' }
      }))
    );
    const line = lines(r)[0];
    assert.ok(line.startsWith(' ↑↓ move  a add to cart  b back'));
    assert.ok(line.endsWith('✓ Added to cart'));
    assert.equal(width(line), 69, 'message right-aligned, 1 cell padding');
    assert.equal(styleAt(r.lastFrame(), 'a add').fg, 'cyan');
    assert.equal(styleAt(r.lastFrame(), 'Added').fg, 'green');
  });

  it('accepts a plain string message as info', () => {
    const r = render(h(Box, { width: 40 }, h(StatusBar, { hints: [['q', 'quit']], message: 'Hello' })));
    assert.ok(lines(r)[0].endsWith('i Hello'));
    assert.equal(width(lines(r)[0]), 39);
  });

  it('stays one line when hints and message do not fit', () => {
    const r = render(
      h(Box, { width: 30 }, h(StatusBar, {
        hints: [['↑↓', 'move'], ['a', 'add to cart'], ['c', 'cart'], ['b', 'back']],
        message: { tone: 'success', text: 'Added Developer Blend' }
      }))
    );
    assert.equal(lines(r).length, 1);
    assert.ok(width(lines(r)[0]) <= 30);
    assert.ok(lines(r)[0].includes('Added Developer Blend'));
  });
});

describe('Panel', () => {
  it('draws the title into the top border', () => {
    const r = render(h(Panel, { title: 'Products', width: 30, height: 5 }, h(Text, null, 'body')));
    const out = lines(r);
    assert.equal(out[0], '╭─ Products ─────────────────╮');
    assert.equal(out[1], '│                            │');
    assert.equal(out[2], '│ body                       │');
    assert.equal(out[4], '╰────────────────────────────╯');
    assert.equal(out.length, 5);
    for (const line of out) assert.equal(width(line), 30);
  });

  it('has a dim border (top edge too) and a bold default title when not focused', () => {
    const raw = render(h(Panel, { title: 'Menu', width: 20, height: 4 })).lastFrame();
    assertMuted(styleAt(raw, '╭─'), 'top edge');
    assertMuted(styleAt(raw, '─╮'), 'top edge');
    assertMuted(styleAt(raw, '│'), 'side');
    assertMuted(styleAt(raw, '╰'), 'bottom');
    assert.deepEqual(styleAt(raw, 'Menu'), { fg: undefined, bg: undefined, bold: true, dim: false, underline: false });
  });

  it('is cyan with a cyan title when focused', () => {
    const raw = render(h(Panel, { title: 'Menu', focused: true, width: 20, height: 4 })).lastFrame();
    assert.equal(styleAt(raw, '╭').fg, 'cyan');
    assert.equal(styleAt(raw, '│').fg, 'cyan');
    assert.equal(styleAt(raw, '╯').fg, 'cyan');
    assert.equal(styleAt(raw, '╯').dim, false);
    assert.equal(styleAt(raw, 'Menu').fg, 'cyan');
    assert.equal(styleAt(raw, 'Menu').bold, true);
  });

  it('works without a title and with padding 0', () => {
    const r = render(h(Panel, { width: 12, height: 3, padding: 0 }, h(Text, null, 'x')));
    assert.deepEqual(lines(r), ['╭──────────╮', '│x         │', '╰──────────╯']);
  });

  it('truncates a title longer than the panel', () => {
    const r = render(h(Panel, { title: 'A very long panel title', width: 16, height: 3 }));
    const top = lines(r)[0];
    assert.equal(width(top), 16);
    assert.ok(top.startsWith('╭─ A very'));
    assert.ok(top.endsWith('╮'));
  });

  it('only paints the screen background nowhere', () => {
    const raw = render(h(Panel, { title: 'P', focused: true, width: 20, height: 4 }, h(Text, null, 'x'))).lastFrame();
    assert.ok(!/\u001B\[4[0-7]m|\u001B\[10[0-7]m/.test(raw), 'no background color codes');
  });
});

describe('SelectList / ListItem', () => {
  const items = [
    { label: 'Browse products', hint: '1' },
    { label: 'View cart', hint: '2' },
    { label: 'Checkout', hint: '3', disabled: true },
    { label: 'Settings', hint: '4' }
  ];

  it('renders marker column, label and right-aligned hint with 1 cell padding', () => {
    const r = render(h(Box, { width: 30 }, h(SelectList, { items, isActive: false })));
    const out = lines(r);
    // 1 padding + 2 marker + label + 1 gap + hint + 1 padding = 30 cells;
    // the selected row paints its padding, plain rows end at the hint.
    assert.equal(out[0], ' › ' + 'Browse products'.padEnd(24) + ' 1 ');
    assert.equal(out[1], '   ' + 'View cart'.padEnd(24) + ' 2');
    assert.equal(out.length, 4);
  });

  it('selected row: cyan background, black bold text, marker ›', () => {
    const raw = render(h(Box, { width: 30 }, h(SelectList, { items, selectedIndex: 1, isActive: false }))).lastFrame();
    assert.deepEqual(styleAt(raw, 'View cart'), { fg: 'black', bg: 'cyan', bold: true, dim: false, underline: false });
    assert.equal(styleAt(raw, '›').bg, 'cyan');
    assert.equal(styleAt(raw, 'Browse').bg, undefined);
  });

  it('disabled rows and hints are muted', () => {
    const raw = render(h(Box, { width: 30 }, h(SelectList, { items, isActive: false }))).lastFrame();
    assertMuted(styleAt(raw, 'Checkout'), 'disabled row');
    assertMuted(styleAt(raw, '2'), 'hint');
    assert.equal(styleAt(raw, 'View cart').fg, undefined);
    assert.equal(styleAt(raw, 'View cart').dim, false);
  });

  it('truncates long labels at the end', () => {
    const r = render(h(Box, { width: 16 }, h(ListItem, { label: 'A really long label', hint: '9' })));
    const line = lines(r)[0];
    assert.equal(line, '   A really … 9');
  });

  it('moves with arrows, skips disabled, jumps with numbers, selects with enter', async () => {
    const selected = [];
    function Harness() {
      const [index, setIndex] = useState(0);
      return h(Box, { width: 30 }, h(SelectList, {
        items,
        selectedIndex: index,
        onChange: setIndex,
        onSelect: (i, item) => selected.push([i, item.label])
      }));
    }
    const r = render(h(Harness));
    const selectedLabel = () => lines(r).find((l) => l.startsWith(' ›'));
    r.stdin.write(keys.down);
    await tick(20);
    assert.match(selectedLabel(), /View cart/);
    r.stdin.write(keys.down); // skips disabled Checkout
    await tick(20);
    assert.match(selectedLabel(), /Settings/);
    r.stdin.write('1');
    await tick(20);
    assert.match(selectedLabel(), /Browse products/);
    r.stdin.write('3'); // disabled: no jump
    await tick(20);
    assert.match(selectedLabel(), /Browse products/);
    r.stdin.write(keys.enter);
    await tick(20);
    assert.deepEqual(selected, [[0, 'Browse products']]);
  });

  it('handles several keys arriving in one chunk', async () => {
    const r = render(h(Box, { width: 30 }, h(SelectList, { items: items.filter((i) => !i.disabled) })));
    r.stdin.write(keys.down + keys.down);
    await tick(20);
    assert.match(lines(r).find((l) => l.startsWith(' ›')), /Settings/);
  });
});

describe('Table', () => {
  const columns = [
    { label: 'ID', width: 10 },
    { label: 'Name', width: 12 },
    { label: 'Price', width: 9, align: 'right' }
  ];
  const rows = [
    ['prod_001', 'Developer Blend', '$24.99'],
    ['prod_002', 'Espresso', '$9.99']
  ];

  it('header muted and underlined, no rule row, 1 space between columns', () => {
    const r = render(h(Box, { width: 36 }, h(Table, { columns, rows, isActive: false })));
    const out = lines(r);
    assert.equal(out.length, 3, 'header + 2 rows, no rule row');
    assert.equal(out[0], ' ' + 'ID'.padEnd(10) + ' ' + 'Name'.padEnd(12) + ' ' + 'Price'.padStart(9));
    const raw = r.lastFrame();
    // dim + underline; not bold + dim, which some terminals show as one of the two
    assert.deepEqual(styleAt(raw, 'Name'), { fg: undefined, bg: undefined, bold: false, dim: true, underline: true });
    assert.ok(!/[─│┼]/.test(plain(r)), 'no column or row rules');
  });

  it('truncates cells at their width and right-aligns numbers', () => {
    const r = render(h(Box, { width: 36 }, h(Table, { columns, rows, selectedIndex: -1, isActive: false })));
    const out = lines(r);
    assert.equal(out[1], ' prod_001   Developer B…' + '$24.99'.padStart(10));
    assert.equal(out[2], ' prod_002   Espresso    ' + '$9.99'.padStart(10));
    // Right edges of the price column line up.
    assert.equal(out[1].lastIndexOf('9'), out[2].lastIndexOf('9'));
    assert.equal(out[0].indexOf('Price') + 'Price'.length, out[1].lastIndexOf('9') + 1);
  });

  it('selected row as in SelectList', () => {
    const raw = render(h(Box, { width: 36 }, h(Table, { columns, rows, selectedIndex: 1, isActive: false }))).lastFrame();
    assert.deepEqual(styleAt(raw, 'Espresso'), { fg: 'black', bg: 'cyan', bold: true, dim: false, underline: false });
    assert.equal(styleAt(raw, 'Developer').bg, undefined);
  });

  it('a grow column takes the spare width', () => {
    const grow = [{ label: 'Name', width: 6, grow: true }, { label: 'Price', width: 6, align: 'right' }];
    const r = render(h(Box, { width: 30 }, h(Table, { columns: grow, rows: [['Tea', '$1.00']], selectedIndex: -1, isActive: false })));
    // 30 - 2 padding - 1 gap - 6 price = 21 cells for the name
    assert.equal(lines(r)[1], ' ' + 'Tea'.padEnd(21) + ' ' + '$1.00'.padStart(6));
  });

  it('moves the selection with arrows', async () => {
    const r = render(h(Box, { width: 36 }, h(Table, { columns, rows })));
    r.stdin.write(keys.down);
    await tick(20);
    assert.equal(styleAt(r.lastFrame(), 'Espresso').bg, 'cyan');
  });

  it('scrolls to keep the selection visible', () => {
    const many = Array.from({ length: 10 }, (_, i) => [`id_${i}`, `Item ${i}`, `$${i}.00`]);
    const r = render(h(Box, { width: 36 }, h(Table, { columns, rows: many, selectedIndex: 8, height: 3, isActive: false })));
    const out = lines(r);
    assert.equal(out.length, 4);
    assert.ok(out.some((l) => l.includes('Item 8')));
  });
});

describe('TextField', () => {
  it('label column 11 cells, value 30 cells underlined', () => {
    const r = render(h(TextField, { label: 'Email', value: 'marko@example.com' }));
    const line = lines(r)[0];
    assert.equal(line.indexOf('marko'), 11);
    assert.equal(width(line.trimEnd()), 11 + 'marko@example.com'.length);
    const raw = r.lastFrame();
    assertMuted(styleAt(raw, 'Email'), 'label');
    // The rest of the 30 value cells: underlined spaces, dim like a border.
    const rest = styleAtCell(raw, 0, 11 + 'marko@example.com'.length + 1);
    assert.equal(rest.underline, true);
    assert.equal(rest.dim, true);
    assert.equal(styleAtCell(raw, 0, 40).underline, true, 'up to cell 41');
    assert.equal(styleAt(raw, 'marko').underline, true);
    assert.equal(styleAt(raw, 'marko').fg, undefined);
  });

  it('placeholder in muted', () => {
    const raw = render(h(TextField, { label: 'Name', placeholder: 'Your name' })).lastFrame();
    assertMuted(styleAt(raw, 'Your name'), 'placeholder');
  });

  it('focused: bold cyan label and a cyan cursor', () => {
    const r = render(h(TextField, { label: 'Address', value: 'Main Street 1', focused: true }));
    assert.ok(lines(r)[0].startsWith('Address    Main Street 1█'));
    const raw = r.lastFrame();
    assert.deepEqual(styleAt(raw, 'Address'), { fg: 'cyan', bg: undefined, bold: true, dim: false, underline: false });
    assert.equal(styleAt(raw, '█').fg, 'cyan');
  });

  it('focused but not editing: accent label, no cursor', () => {
    const r = render(h(TextField, { label: 'Address', value: 'Main', focused: true, editing: false }));
    assert.ok(!plain(r).includes('█'));
    assert.equal(styleAt(r.lastFrame(), 'Address').fg, 'cyan');
  });

  it('error: red bold label and a ✗ line under the value column', () => {
    const r = render(h(TextField, { label: 'Email', value: 'marko@', error: 'Enter a full address' }));
    const out = lines(r);
    assert.equal(out.length, 2);
    assert.equal(out[1], `${' '.repeat(11)}✗ Enter a full address`);
    const raw = r.lastFrame();
    assert.deepEqual(styleAt(raw, 'Email'), { fg: 'red', bg: undefined, bold: true, dim: false, underline: false });
    assert.equal(styleAt(raw, '✗').fg, 'red');
  });

  it('never grows past label + value width', () => {
    const r = render(h(TextField, { label: 'Address', value: 'x'.repeat(60), focused: true }));
    assert.ok(width(lines(r)[0].trimEnd()) <= 41);
    assert.ok(lines(r)[0].includes('█'));
  });

  it('typing, backspace, enter and escape', async () => {
    const events = [];
    function Harness() {
      const [value, setValue] = useState('ab');
      return h(TextField, {
        label: 'Name',
        value,
        focused: true,
        onChange: setValue,
        onSubmit: (v) => events.push(['submit', v]),
        onCancel: () => events.push(['cancel'])
      });
    }
    const r = render(h(Harness));
    r.stdin.write('cd');
    await tick(20);
    assert.ok(lines(r)[0].startsWith('Name       abcd█'));
    r.stdin.write(keys.backspace);
    await tick(20);
    assert.ok(lines(r)[0].startsWith('Name       abc█'));
    r.stdin.write(keys.enter);
    await tick(20);
    r.stdin.write(keys.escape);
    await tick(80);
    assert.deepEqual(events, [['submit', 'abc'], ['cancel']]);
  });
});

describe('Button', () => {
  it('brackets muted, label bold', () => {
    const r = render(h(Button, { label: 'Submit order' }));
    assert.equal(plain(r), '[ Submit order ]');
    assertMuted(styleAt(r.lastFrame(), '['), 'bracket');
    assert.equal(styleAt(r.lastFrame(), 'Submit').bold, true);
    assert.equal(styleAt(r.lastFrame(), 'Submit').bg, undefined);
  });

  it('focused: cyan background, black bold', () => {
    const raw = render(h(Button, { label: 'Submit order', focused: true })).lastFrame();
    assert.deepEqual(styleAt(raw, '['), { fg: 'black', bg: 'cyan', bold: true, dim: false, underline: false });
    assert.deepEqual(styleAt(raw, 'Submit'), { fg: 'black', bg: 'cyan', bold: true, dim: false, underline: false });
  });
});

describe('Meter', () => {
  it('label 8, bar 20, value 8 right-aligned', () => {
    const r = render(h(Meter, { label: 'CPU', value: 41 }));
    assert.equal(plain(r), 'CPU     ████████░░░░░░░░░░░░     41%');
    assert.equal(width(plain(r)), METER_WIDTH);
    const raw = r.lastFrame();
    assertMuted(styleAt(raw, 'CPU'), 'label');
    assert.equal(styleAt(raw, '█').fg, 'cyan');
    assertMuted(styleAt(raw, '░'), 'empty bar');
  });

  it('tones color the bar', () => {
    assert.equal(styleAt(render(h(Meter, { label: 'M', value: 82, tone: 'warning' })).lastFrame(), '█').fg, 'yellow');
    assert.equal(styleAt(render(h(Meter, { label: 'M', value: 99, tone: 'danger' })).lastFrame(), '█').fg, 'red');
  });

  it('round(value / max × 20) cells, clamped', () => {
    assert.equal(meterCells(41, 100), 8);
    assert.equal(meterCells(82, 100), 16);
    assert.equal(meterCells(5, 4), 20);
    assert.equal(meterCells(-3, 10), 0);
    assert.equal(meterCells(1, 0), 0);
  });

  it('is never longer than 36 cells', () => {
    const cases = [
      { label: 'A very long label', value: 1e9, max: 1, display: '123456789012345' },
      { label: 'Memory', value: 3.5, max: 8, display: '3.5/8 GiB' },
      { label: '', value: 0 },
      { label: 'X', value: -50 }
    ];
    for (const props of cases) {
      const r = render(h(Box, { width: 100 }, h(Meter, props)));
      const out = lines(r);
      assert.equal(out.length, 1, `one line for ${JSON.stringify(props)}`);
      assert.ok(width(out[0].trimEnd()) <= METER_WIDTH, `≤ 36 cells: "${out[0]}"`);
    }
  });
});

describe('EmptyState', () => {
  it('centered message, muted hint and a key hint, no red, no box', () => {
    const r = render(
      h(Box, { width: 40, height: 7 }, h(EmptyState, { message: 'Your cart is empty.', hint: 'Browse with', k: 'b', label: 'back' }))
    );
    const out = lines(r);
    const messageRow = out.findIndex((l) => l.includes('Your cart is empty.'));
    assert.equal(messageRow, 2);
    const text = out[messageRow].trim();
    const left = out[messageRow].indexOf(text);
    assert.ok(Math.abs(left - (40 - text.length - left)) <= 1, 'horizontally centered');
    assert.equal(out[messageRow + 1].trim(), 'Browse with b back');
    const raw = r.lastFrame();
    assert.equal(styleAt(raw, 'Your cart').fg, undefined);
    assertMuted(styleAt(raw, 'Browse'), 'hint');
    assert.equal(styleAt(raw, 'b back').fg, 'cyan');
    assert.ok(!raw.includes('\u001B[31m'), 'no red');
    assert.ok(!/[╭│]/.test(plain(r)), 'no box');
  });
});
