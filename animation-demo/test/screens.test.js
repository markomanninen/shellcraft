import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { textProps } from '@shellcraft/ui';
import { renderTerminal, cleanupTerminals, styleAt, styleAtCell, boldDimText, tick } from '@shellcraft/ui/testing';
import { App, LIST_WIDTH, frameInterval, speedLabel, stageInnerSize, MIN_INTERVAL } from '../app.js';
import { animations, normalize } from '../animations.js';

const h = React.createElement;

afterEach(() => cleanupTerminals());

const SIZES = [[80, 24], [100, 30]];
const width = (line) => Array.from(line).length;

async function open({ columns = 80, rows = 24, initial } = {}) {
  const t = renderTerminal(h(App, { initial }), { columns, rows });
  await tick(15);
  return t;
}

/** A full screen: title on row 0, the two panels, the status bar last. */
function assertScreen(t, columns, rows, name) {
  const lines = t.lines();
  assert.equal(lines.length, rows, `${name}: ${rows} rows`);
  for (const [i, line] of lines.entries()) {
    assert.ok(width(line) <= columns, `${name}: row ${i} is ${width(line)} wide: "${line}"`);
  }
  assert.ok(lines[0].startsWith(` Animation Demo › ${name}`), `row 0: "${lines[0]}"`);
  assert.ok(lines[1].startsWith(`╭─ ${name} ─`), `row 1: "${lines[1]}"`);
  assert.ok(lines[1].endsWith('╮╭─ Animations ─────────────╮'), `row 1: "${lines[1]}"`);
  assert.ok(lines[rows - 2].startsWith('╰'), `row ${rows - 2}: "${lines[rows - 2]}"`);
  assert.ok(lines[rows - 2].endsWith('╯'), `row ${rows - 2}: "${lines[rows - 2]}"`);
  assert.ok(lines[rows - 1].startsWith(' space '), `status: "${lines[rows - 1]}"`);
  for (const frame of t.frames) assert.equal(boldDimText(frame), '', `${name}: nothing is bold and dim at once`);
  return lines;
}

/** Row and column where every line of `block` appears, one under the other. */
function findBlock(lines, block) {
  for (let row = 0; row + block.length <= lines.length; row++) {
    let column = lines[row].indexOf(block[0]);
    while (column !== -1) {
      if (block.every((text, i) => lines[row + i].slice(column, column + text.length) === text)) {
        return { row, column };
      }
      column = lines[row].indexOf(block[0], column + 1);
    }
  }
  return null;
}

const statusRow = (t) => t.lines().at(-1).trimEnd();
const titleRow = (t) => t.lines()[0].trimEnd();
const shownFrame = (t) => Number(/rame (\d+)\//.exec(statusRow(t))?.[1]);

describe('frames', () => {
  it('normalize pads lines and frames to one size', () => {
    const a = normalize({ name: 'x', interval: 100, tone: 'default', frames: [['ab', 'c'], ['abcd']] });
    assert.equal(a.width, 4);
    assert.equal(a.height, 2);
    assert.deepEqual(a.frames, [['ab  ', 'c   '], ['abcd', '    ']]);
  });

  it('every animation has a theme tone, a name and frames of one size', () => {
    assert.equal(animations.length, 7);
    for (const a of animations) {
      assert.doesNotThrow(() => textProps(a.tone), `${a.name}: tone ${a.tone}`);
      assert.ok(a.interval > 0);
      for (const frame of a.frames) {
        assert.equal(frame.length, a.height);
        for (const line of frame) assert.equal(width(line), a.width);
      }
    }
  });

  it('the largest frame of every animation fits the stage at 80x24', () => {
    const inner = stageInnerSize(80, 24);
    assert.deepEqual(inner, { columns: 48, rows: 18 });
    for (const a of animations) {
      assert.ok(a.width <= inner.columns, `${a.name}: ${a.width} columns`);
      assert.ok(a.height <= inner.rows, `${a.name}: ${a.height} rows`);
    }
    // The smallest terminal that still fits them all (README).
    const widest = Math.max(...animations.map((a) => a.width));
    const tallest = Math.max(...animations.map((a) => a.height));
    assert.deepEqual([widest, tallest], [25, 14]);
    assert.deepEqual(stageInnerSize(57, 20), { columns: 25, rows: 14 });
  });

  it('speed: 0.2× steps, interval rounded, never under 50 ms', () => {
    assert.equal(frameInterval(350), 350);
    assert.equal(frameInterval(350, 6), 292);
    assert.equal(frameInterval(350, 1), 1750);
    assert.equal(frameInterval(350, 25), 70);
    assert.equal(frameInterval(150, 25), MIN_INTERVAL);
    assert.equal(speedLabel(5), '1.0×');
    assert.equal(speedLabel(1), '0.2×');
    assert.equal(speedLabel(25), '5.0×');
  });
});

for (const [columns, rows] of SIZES) {
  describe(`every animation at ${columns}x${rows}`, () => {
    const inner = stageInnerSize(columns, rows);

    for (const [index, animation] of animations.entries()) {
      it(`${animation.name}: every frame whole and centered in the stage`, async () => {
        const count = animation.frames.length;
        for (let frame = 0; frame < count; frame++) {
          const t = await open({ columns, rows, initial: { index, frame, paused: true } });
          const lines = assertScreen(t, columns, rows, animation.name);
          assert.ok(statusRow(t).endsWith(`! Paused · frame ${frame + 1}/${count}`), statusRow(t));

          const block = animation.frames[frame];
          const at = findBlock(lines, block);
          assert.ok(at, `${animation.name} frame ${frame + 1} is on screen whole`);
          // Inside the stage: border and one cell of padding on each side.
          const left = at.column - 2;
          const right = inner.columns - left - animation.width;
          const top = at.row - 3;
          const bottom = inner.rows - top - animation.height;
          assert.ok(left >= 0 && right >= 0 && top >= 0 && bottom >= 0, `inside the stage: ${JSON.stringify({ left, right, top, bottom })}`);
          assert.ok(Math.abs(left - right) <= 1, `centered horizontally: ${left} | ${right}`);
          assert.ok(Math.abs(top - bottom) <= 1, `centered vertically: ${top} | ${bottom}`);
          t.unmount();
        }
      });
    }

    it('the stage takes what the list column leaves', async () => {
      const t = await open({ columns, rows, initial: { paused: true } });
      const lines = t.lines();
      assert.equal(lines[1].indexOf('╮╭'), columns - LIST_WIDTH - 1);
      assert.equal(lines[2].length, columns);
      t.unmount();
    });
  });
}

describe('look (80x24)', () => {
  it('list focused, selection bar, frame in the animation tone', async () => {
    for (const [index, animation] of animations.entries()) {
      const t = await open({ initial: { index, paused: true } });
      const raw = t.lastFrame();
      assert.equal(styleAt(raw, 'Animations').fg, 'cyan', 'the list panel has focus');
      assert.equal(styleAt(raw, '╭', 1).fg, 'cyan');
      assert.equal(styleAt(raw, '╭', 0).dim, true, 'the stage border is dim');
      assert.deepEqual(styleAt(raw, animation.name, 1), { fg: undefined, bg: undefined, bold: true, dim: false, underline: false }, 'stage title');
      assert.deepEqual(styleAt(raw, animation.name, 2), { fg: 'black', bg: 'cyan', bold: true, dim: false, underline: false }, 'selected row');

      // The first visible character of the frame carries the tone's color.
      const at = findBlock(t.lines(), animation.frames[0]);
      const row = animation.frames[0].findIndex((line) => line.trim() !== '');
      const column = animation.frames[0][row].search(/\S/);
      const style = styleAtCell(raw, at.row + row, at.column + column);
      assert.equal(style.fg, textProps(animation.tone).color, `${animation.name}: ${animation.tone}`);
      assert.equal(style.bold, false);
      assert.equal(style.dim, false);
      t.unmount();
    }
  });

  it('title, meta, hints and the playing message', async () => {
    const t = await open();
    assert.ok(titleRow(t).startsWith(' Animation Demo › Crystal Ball'));
    assert.ok(titleRow(t).endsWith('speed 1.0×'));
    assert.equal(statusRow(t), ' space pause  +/- speed  ←→ switch  1-7 jump  q quit       i Frame 1/4 · 350 ms');
    const raw = t.lastFrame();
    assert.equal(styleAt(raw, 'space').fg, 'cyan');
    assert.equal(styleAt(raw, 'space').bold, true);
    assert.equal(styleAt(raw, 'pause').dim, true);
    assert.equal(styleAt(raw, 'speed 1.0×').dim, true);
    t.unmount();
  });
});

describe('keys (80x24)', () => {
  it('switch: ←/→ wrap, 1-7 jump, ↑↓ move the list, each starts at frame 1', async () => {
    const t = await open({ initial: { frame: 2, paused: true } });
    assert.ok(statusRow(t).endsWith('Paused · frame 3/4'));

    await t.press('right');
    assert.ok(titleRow(t).startsWith(' Animation Demo › Bubbling Cauldron'), titleRow(t));
    assert.ok(t.lines()[3].endsWith('│ › Bubbling Cauldron    2 │'), t.lines()[3]);
    assert.ok(statusRow(t).endsWith('Paused · frame 1/5'), 'switching keeps the pause, frame 1');

    await t.press('left', 'left');
    assert.ok(titleRow(t).startsWith(' Animation Demo › Watson Orb'), 'wraps from the first to the last');
    await t.press('right');
    assert.ok(titleRow(t).startsWith(' Animation Demo › Crystal Ball'), 'wraps from the last to the first');

    await t.press('3');
    assert.ok(titleRow(t).startsWith(' Animation Demo › Hourglass'));
    assert.ok(statusRow(t).endsWith('Paused · frame 1/9'));
    await t.press('9');
    assert.ok(titleRow(t).startsWith(' Animation Demo › Hourglass'), 'no 9th animation');
    await t.press('down');
    assert.ok(titleRow(t).startsWith(' Animation Demo › Atom Orbit'));
    await t.press('up', 'up');
    assert.ok(titleRow(t).startsWith(' Animation Demo › Bubbling Cauldron'));
    await t.press('7');
    assert.ok(titleRow(t).startsWith(' Animation Demo › Watson Orb'));
    assert.ok(findBlock(t.lines(), animations[6].frames[0]), 'the new animation is on the stage');
    t.unmount();
  });

  it('space pauses and plays on from the same frame', async () => {
    const t = await open({ initial: { index: 3 } }); // Atom Orbit, 150 ms
    assert.ok(statusRow(t).endsWith('i Frame 1/8 · 150 ms'), statusRow(t));
    await tick(400);
    const playing = shownFrame(t);
    assert.ok(playing > 1, `advanced to frame ${playing}`);

    await t.press(' ');
    assert.match(statusRow(t), /! Paused · frame \d\/8$/);
    assert.ok(statusRow(t).startsWith(' space play  '), statusRow(t));
    assert.equal(styleAt(t.lastFrame(), 'Paused').fg, 'yellow');
    const paused = shownFrame(t);
    const stage = t.lines().slice(2, 22).join('\n');
    await tick(400);
    assert.equal(shownFrame(t), paused, 'stays on its frame');
    assert.equal(t.lines().slice(2, 22).join('\n'), stage, 'the stage does not change');
    assert.ok(findBlock(t.lines(), animations[3].frames[paused - 1]));

    await t.press(' ');
    assert.ok(statusRow(t).endsWith(`i Frame ${paused}/8 · 150 ms`), `plays on from frame ${paused}: ${statusRow(t)}`);
    assert.ok(statusRow(t).startsWith(' space pause  '));
    await tick(400);
    assert.notEqual(shownFrame(t), paused, 'moving again');
    t.unmount();
  });

  it('+ = faster, - _ slower, from 0.2× to 5×, the frame stays', async () => {
    const t = await open({ initial: { frame: 2, paused: true } }); // Crystal Ball, 350 ms
    await t.press('+');
    assert.ok(titleRow(t).endsWith('speed 1.2×'), titleRow(t));
    assert.ok(statusRow(t).endsWith('Paused · frame 3/4'), 'still paused on frame 3');
    await t.press('=');
    assert.ok(titleRow(t).endsWith('speed 1.4×'));
    await t.press(' ');
    assert.ok(statusRow(t).endsWith('i Frame 3/4 · 250 ms'), statusRow(t));
    await t.press(' ');

    await t.press('-');
    assert.ok(titleRow(t).endsWith('speed 1.2×'));
    await t.press('_');
    assert.ok(titleRow(t).endsWith('speed 1.0×'));
    await t.press('-', '-', '-', '-');
    assert.ok(titleRow(t).endsWith('speed 0.2×'));
    await t.press('-');
    assert.ok(titleRow(t).endsWith('speed 0.2×'), 'no slower than 0.2×');
    await t.press(' ');
    assert.ok(statusRow(t).endsWith('i Frame 3/4 · 1750 ms'), statusRow(t));

    await t.press(...Array(30).fill('+'));
    assert.ok(titleRow(t).endsWith('speed 5.0×'), 'no faster than 5×');
    assert.match(statusRow(t), /Frame \d\/4 · 70 ms$/);
    await t.press('right', 'right', 'right'); // Atom Orbit: 150 / 5 = 30, floor 50
    assert.match(statusRow(t), /Frame \d\/8 · 50 ms$/);
    assert.ok(titleRow(t).endsWith('speed 5.0×'), 'switching keeps the speed');
    t.unmount();
  });

  it('changing the speed while playing goes on from the frame on screen', async () => {
    const t = await open({ initial: { index: 2 } }); // Hourglass, 500 ms
    await tick(1150);
    const before = shownFrame(t);
    assert.ok(before >= 3, `frame ${before}`);
    await t.press('+');
    const after = shownFrame(t);
    assert.ok(after === before || after === before + 1, `${before} → ${after}, not back to 1`);
    assert.ok(statusRow(t).endsWith('· 417 ms'), statusRow(t));
    await t.press('-', '-');
    const slower = shownFrame(t);
    assert.ok(slower >= after && slower <= after + 1, `${after} → ${slower}`);
    t.unmount();
  });

  it('a faster speed shows more frames in the same time', async () => {
    const t = await open({ initial: { index: 3, step: 25 } }); // Atom Orbit at 5×: 50 ms
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      await tick(30);
      seen.add(shownFrame(t));
    }
    assert.ok(seen.size >= 4, `frames seen in ~360 ms: ${[...seen]}`);
    t.unmount();
  });
});
