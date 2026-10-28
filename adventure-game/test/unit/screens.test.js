import { describe, it, before, after, afterEach } from 'node:test';
import { strict as assert } from 'assert';
import fs from 'fs';
import React from 'react';
import { renderTerminal, cleanupTerminals, styleAt, boldDimText, tick, waitFor } from '@shellcraft/ui/testing';
import { AdventureApp } from '../../src/ui/app.js';
import { createInitialGameState } from '../../src/models/game-state.js';
import { SessionManager } from '../../src/server/session.js';
import { stubLlm, tempSessions, testKey } from '../helpers/adventure.js';

const h = React.createElement;

// SessionManager logs every load and save; keep the test output readable.
let log;
before(() => {
  log = console.log;
  console.log = (...args) => {
    if (typeof args[0] === 'string' && args[0].startsWith('[session]')) return;
    log(...args);
  };
});
after(() => {
  console.log = log;
});

const stores = [];
afterEach(() => {
  cleanupTerminals();
  while (stores.length > 0) stores.pop().remove();
});

// Signed in with a key unless key: null (anonymous).
function open({ columns = 80, rows = 24, llm = stubLlm(), gameState, initialScreen, username = 'tester', key = testKey(username) } = {}) {
  const store = tempSessions();
  stores.push(store);
  const session = store.manager.createSession(username, key);
  if (gameState) session.gameState = gameState;
  const saveGame = () => store.manager.saveSession(session.id);
  const t = renderTerminal(h(AdventureApp, { session, saveGame, llm, initialScreen }), { columns, rows });
  return { t, session, store, llm };
}

const width = (line) => Array.from(line).length;
const statusRow = (t) => t.lines().at(-1);
const typeText = (t, text) => t.press(...Array.from(text));
const PG_UP = '\u001B[5~';

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
 * Every frame is a full screen: the title bar on row 0, panels below,
 * the status bar on the last row; no line wider than the terminal,
 * nothing bold and dim at once, at most one focused panel.
 */
function assertScreen(t, columns, rows, screen, { focused = 1 } = {}) {
  const lines = t.lines();
  assert.equal(lines.length, rows, `${screen}: ${rows} rows`);
  for (const [i, line] of lines.entries()) {
    assert.ok(width(line) <= columns, `${screen}: row ${i} is ${width(line)} wide: "${line}"`);
  }
  assert.ok(lines[0].startsWith(` Terminal Adventure › ${screen}`), `row 0: "${lines[0]}"`);
  assert.ok(lines[1].startsWith('╭─ '), `row 1: "${lines[1]}"`);
  assert.ok(lines[rows - 2].startsWith('╰'), `row ${rows - 2}: "${lines[rows - 2]}"`);
  const raw = t.lastFrame();
  // Every frame drawn since the last check, not only the last one.
  for (let i = t.checkedFrames ?? 0; i < t.frames.length; i++) {
    assert.equal(boldDimText(t.frames[i]), '', `${screen}: frame ${i} has nothing bold and dim at once`);
  }
  t.checkedFrames = t.frames.length;
  assert.equal(focusedPanels(raw), focused, `${screen}: ${focused} focused panel(s)`);
  return lines;
}

/** Start a new game from the menu and wait for the first narration. */
async function startGame(t) {
  await tick(20);
  await t.press('enter');
  await tick(40);
}

describe('Adventure screens (80x24)', () => {
  it('menu without a game: focused menu, campaign empty state, no Exit item', async () => {
    const { t } = open();
    await tick(20);
    const lines = assertScreen(t, 80, 24, 'Menu');
    assert.ok(lines[0].endsWith('no game'));
    assert.ok(lines[1].startsWith('╭─ Menu ─'));
    assert.ok(lines[1].includes('╮╭─ Campaign ─'));
    assert.ok(lines[2].startsWith('│ › Start new adventure    1 │'));
    assert.ok(lines[3].startsWith('│   Inventory              2 │'));
    assert.ok(lines[6].startsWith('│   Help                   5 │'));
    assert.ok(!t.text().includes('Exit'), 'no Exit item');
    assert.ok(!t.text().includes('Continue'), 'nothing to continue');
    assert.ok(t.text().includes('No adventure yet.'));
    assert.ok(t.text().includes('Pick Start new adventure: ⏎ select'));
    assert.equal(statusRow(t), ' ↑↓ move  ⏎ select  1-5 jump  q quit');

    const raw = t.lastFrame();
    assert.equal(styleAt(raw, 'Menu', 1).fg, 'cyan', 'menu panel has focus');
    assert.equal(styleAt(raw, 'Campaign').fg, undefined);
    assert.deepEqual(styleAt(raw, 'Start new adventure'), { fg: 'black', bg: 'cyan', bold: true, dim: false, underline: false });
    assert.equal(styleAt(raw, 'Pick Start').dim, true, 'empty-state hint muted');
  });

  it('journal, stats and inventory without a game: empty state with h menu, never red', async () => {
    const { t } = open();
    await tick(20);
    for (const [key, screen] of [['3', 'Journal'], ['4', 'Stats'], ['2', 'Inventory']]) {
      await t.press(key, 'enter');
      const lines = assertScreen(t, 80, 24, screen, { focused: 0 });
      assert.ok(lines[0].endsWith('no game'), lines[0]);
      assert.ok(lines[1].startsWith(`╭─ ${screen} ─`));
      assert.ok(t.text().includes('No adventure yet.'));
      assert.ok(t.text().includes('Start one from the menu: h menu'));
      assert.equal(statusRow(t), ' h menu  b back  q quit');
      const raw = t.lastFrame();
      assert.ok(!raw.includes('\u001B[31m'), `${screen}: no red`);
      assert.deepEqual(styleAt(raw, 'No adventure yet.'), { fg: undefined, bg: undefined, bold: false, dim: false, underline: false });
      assert.equal(styleAt(raw, 'Start one').dim, true);
      assert.equal(styleAt(raw, 'h menu', 0).fg, 'cyan', 'the next step is a key hint');
      await t.press(key === '2' ? 'b' : 'h');
      assertScreen(t, 80, 24, 'Menu');
    }
  });

  it('start → busy → first narration → action → busy → the narrative updates', async () => {
    const llm = stubLlm({ gate: true });
    const { t, store, session } = open({ llm });
    await startGame(t);

    // Waiting for the LLM: a status bar spinner, not a separate screen.
    let lines = assertScreen(t, 80, 24, 'Village Square');
    assert.ok(statusRow(t).includes('The Game Master is thinking'), statusRow(t));
    assert.equal(statusRow(t), ` i items  j journal  m map  h menu  q quit${' '.repeat(8)}${statusRow(t).slice(-29)}`);
    assert.equal(styleAt(t.lastFrame(), 'The Game Master').dim, true, 'busy text muted');
    assert.ok(lines[13].startsWith('│   Waiting for the first turn'), lines[13]);
    assert.equal(llm.calls.length, 1);
    assert.equal(llm.calls[0].action_type, 'start');
    await t.press('1');
    assert.equal(llm.calls.length, 1, 'no input while waiting');

    llm.release();
    await tick(40);
    lines = assertScreen(t, 80, 24, 'Village Square');
    assert.ok(lines[0].endsWith('turn 1'));
    assert.equal(lines[1], '╭─ Village Square ───────────────────────╮╭─ Status ───────────────────────────╮');
    assert.equal(lines[2], '│ Lanterns sway over the village square. ││                                    │');
    assert.equal(lines[3], '│ A dry fountain stands at its centre,   ││HP      ████████████████████   20/20│');
    assert.equal(lines[4], '│ and a notice board creaks in the wind  ││Tension █████░░░░░░░░░░░░░░░  25/100│');
    assert.equal(lines[7], '│ ✓ Your journey begins. Seek the        ││ Objective  Earn the Elder Seal 0%  │');
    assert.equal(lines[8], '│   Village Elder to earn passage toward ││ Visible    torch, map              │', 'outcome wraps under its text');
    assert.equal(lines[12], '╭─ Actions ──────────────────────────────╮╭─ Journal ──────────────────────────╮');
    assert.equal(lines[13], '│ › Go north                           1 ││                                    │');
    assert.equal(lines[14], '│   Go east                            2 ││ T1  Arrived at Village Square      │');
    assert.equal(lines[21], '│ > Ask the Game Master…                 ││                                    │');
    assert.equal(statusRow(t), ' 1-6 act  tab ask  i items  j journal  m map  h menu  q quit');
    let raw = t.lastFrame();
    assert.equal(styleAt(raw, 'Actions').fg, 'cyan', 'actions panel focused');
    assert.equal(styleAt(raw, '✓ Your journey').fg, 'green', 'outcome in the success tone');
    assert.equal(styleAt(raw, 'Village Elder to earn').fg, 'green');
    assert.equal(styleAt(raw, 'T1').dim, true, 'journal turn muted');
    assert.equal(styleAt(raw, '█').fg, 'cyan', 'HP meter: default tone (accent)');
    assert.equal(styleAt(raw, '█', 20).fg, 'yellow', 'tension meter in the warning tone');
    assert.equal(styleAt(raw, 'empty').dim, true, 'empty inventory muted');

    // 1 = Go north, at once (as before the port)
    await t.press('1');
    lines = assertScreen(t, 80, 24, 'Village Square');
    assert.ok(statusRow(t).includes('The Game Master is thinking'));
    raw = t.lastFrame();
    assert.equal(styleAt(raw, 'Go north').dim, true, 'actions muted while waiting');
    assert.equal(styleAt(raw, 'Go north').bg, undefined, 'no selection while waiting');
    assert.ok(t.text().includes(' Threat     none'), 'the status waits for the narration too');
    assert.equal(llm.calls.length, 2);
    assert.equal(llm.calls[1].action_text, 'Go north');
    await t.press('2', 'tab');
    assert.equal(llm.calls.length, 2, 'actions and the prompt take no keys while waiting');

    llm.release();
    await tick(40);
    lines = assertScreen(t, 80, 24, 'Dark Forest');
    assert.ok(lines[0].endsWith('turn 2'));
    const text = t.text();
    assert.ok(text.includes('│ › Go north'), 'the action is echoed in the story');
    assert.ok(text.includes('│ Pines close overhead and the light'));
    assert.ok(text.includes('│ ✓ You move north and confront Shadow'));
    assert.ok(text.includes(' Threat     Shadow Wolf 8/8 HP'));
    assert.ok(text.includes('│ T2  Go north'));
    assert.ok(text.includes('│ T2  Arrived at Dark Forest'));
    assert.ok(lines[2].startsWith('│ ↑ '), 'older turns scrolled up');
    raw = t.lastFrame();
    assert.equal(styleAt(raw, '› Go north').dim, true, 'player action muted');
    assert.equal(styleAt(raw, 'Shadow Wolf 8/8').fg, 'yellow', 'threat in the warning tone');
    assert.equal(statusRow(t), ' 1-6 act  tab ask  i items  j journal  m map  h menu  q quit');

    // Saved after each turn
    const saved = store.read().find((entry) => entry.id === session.id);
    assert.equal(saved.gameState.currentRoom, 'forest');
    assert.equal(saved.gameState.story.length, 2);
    assert.equal(saved.gameState.lastResponse.room_name, 'Dark Forest');
    assert.equal(saved.gameState.pendingTurn, undefined);

    // PgUp scrolls the story back to the first turn
    await t.write(PG_UP);
    await t.write(PG_UP);
    lines = t.lines();
    assert.equal(lines[2], '│ Lanterns sway over the village square. ││                                    │');
  });

  it('free text: tab focuses the prompt, q is text, ⏎ asks the Game Master; esc cancels', async () => {
    const { t, llm } = open();
    await startGame(t);
    await t.press('tab');
    let lines = assertScreen(t, 80, 24, 'Village Square');
    assert.equal(statusRow(t), ' ⏎ send  esc cancel  tab actions');
    assert.ok(lines[21].startsWith('│ > █'), lines[21]);
    let raw = t.lastFrame();
    assert.equal(styleAt(raw, 'Go north').bg, undefined, 'one focused element: no selection bar');
    assert.equal(styleAt(raw, '>').fg, 'cyan');

    // tab back keeps the draft; esc clears it
    await typeText(t, 'xyz');
    await t.press('tab');
    assert.equal(statusRow(t), ' 1-6 act  tab ask  i items  j journal  m map  h menu  q quit');
    assert.ok(t.lines()[21].startsWith('│ > xyz '), t.lines()[21]);
    assert.deepEqual(styleAt(t.lastFrame(), 'Go north'), { fg: 'black', bg: 'cyan', bold: true, dim: false, underline: false });
    await t.press('tab', 'escape');
    assert.ok(t.lines()[21].startsWith('│ > Ask the Game Master…'), t.lines()[21]);
    assert.equal(statusRow(t), ' 1-6 act  tab ask  i items  j journal  m map  h menu  q quit');

    // q, h, i, j while typing are text
    await t.press('tab');
    let exited = false;
    t.waitUntilExit().then(() => { exited = true; });
    await typeText(t, 'who guards the temple? quick hint');
    await tick(20);
    assert.equal(exited, false, 'q while typing does not quit');
    assertScreen(t, 80, 24, 'Village Square');
    assert.ok(t.lines()[21].startsWith('│ > who guards the temple? quick hint█'), t.lines()[21]);
    await t.press('enter');
    await tick(40);
    lines = assertScreen(t, 80, 24, 'Village Square');
    const call = llm.calls.at(-1);
    assert.equal(call.action_type, 'custom');
    assert.equal(call.action_text, 'who guards the temple? quick hint');
    assert.ok(t.text().includes('› who guards the temple? quick hint'));
    assert.ok(t.text().includes('T2  who guards the temple? quick'));
    assert.ok(lines[21].startsWith('│ > Ask the Game Master…'));
    raw = t.lastFrame();
    assert.equal(styleAt(raw, 'Go north').bg, 'cyan', 'back on the actions');
  });

  it('a failed narration is an error in the status bar; r retries the same turn', async () => {
    const llm = stubLlm({ outcomes: [null, new Error('fetch failed')] });
    const { t, session } = open({ llm });
    await startGame(t);
    await t.press('1');
    await tick(40);
    let lines = assertScreen(t, 80, 24, 'Village Square');
    assert.ok(statusRow(t).startsWith(' r retry  h menu  q quit  '), statusRow(t));
    assert.ok(statusRow(t).endsWith('✗ The Game Master failed: fetch failed'), statusRow(t));
    const raw = t.lastFrame();
    assert.equal(styleAt(raw, '✗ The Game Master').fg, 'red');
    assert.equal(styleAt(raw, 'Go north').dim, true, 'actions disabled until the turn is narrated');
    assert.ok(!t.text().includes('┌') && lines.filter((l) => l.startsWith('╭')).length === 2, 'no floating box');
    assert.ok(session.gameState.pendingTurn, 'the resolved turn waits for its narration');
    assert.equal(session.gameState.currentRoom, 'forest');

    await t.press('1');
    assert.equal(llm.calls.length, 2, 'no new action while the turn is pending');
    await t.press('r');
    await tick(40);
    lines = assertScreen(t, 80, 24, 'Dark Forest');
    assert.equal(llm.calls.length, 3);
    assert.equal(llm.calls[2].action_text, 'Go north', 'the same turn is narrated again');
    assert.equal(statusRow(t), ' 1-6 act  tab ask  i items  j journal  m map  h menu  q quit');
  });

  it('m swaps the status panels for the map', async () => {
    const { t } = open();
    await startGame(t);
    await t.press('m');
    const lines = assertScreen(t, 80, 24, 'Village Square');
    assert.ok(lines[1].endsWith('╮╭─ Map ──────────────────────────────╮'), lines[1]);
    assert.ok(lines[5].endsWith('││ [ @ ]                              │'), lines[5]);
    assert.ok(t.text().includes('│ [VLG] Village  [CAV] Cave'));
    assert.equal(styleAt(t.lastFrame(), '[ @ ]').fg, 'green');
    assert.equal(statusRow(t), ' 1-6 act  tab ask  i items  j journal  m status  h menu  q quit');
    await t.press('1');
    await tick(40);
    assert.ok(t.text().includes('│ [ @ ]'));
    assert.ok(t.text().includes('│ [VLG]'), 'visited rooms on the map');
    await t.press('m');
    assert.ok(t.lines()[1].includes('╭─ Status ─'));
  });

  it('inventory, journal and stats with a game; b returns to the room, h to the menu', async () => {
    const { t } = open();
    await startGame(t);
    await t.press('4'); // Take torch
    await tick(40);

    await t.press('i');
    let lines = assertScreen(t, 80, 24, 'Inventory');
    assert.ok(lines[0].endsWith('1 item'));
    assert.ok(lines[2].startsWith('│   # Item'), lines[2]);
    assert.ok(lines[3].startsWith('│   1 torch'), lines[3]);
    assert.equal(statusRow(t), ' h menu  b back  q quit');
    await t.press('b');
    assertScreen(t, 80, 24, 'Village Square');

    await t.press('j');
    lines = assertScreen(t, 80, 24, 'Journal');
    assert.equal(lines[3], `│ Quests${' '.repeat(71)}│`);
    assert.ok(t.text().includes('│   Earn the Elder Seal · active · 0%'));
    assert.ok(t.text().includes('│     Speak with the Village Elder and earn sanction for temple entry.'));
    assert.equal(styleAt(t.lastFrame(), 'Quests').bold, true);
    assert.equal(styleAt(t.lastFrame(), 'Recover the Temple').dim, true, 'locked quests muted');
    assert.equal(statusRow(t), ' ↑↓ scroll  h menu  b back  q quit');
    await t.press('escape');
    assertScreen(t, 80, 24, 'Village Square');

    await t.press('h');
    assertScreen(t, 80, 24, 'Menu');
    assert.ok(t.lines()[2].startsWith('│ › Continue adventure     1 │'));
    assert.ok(t.text().includes(' Location   Village Square'));
    assert.ok(t.text().includes(' Inventory  1 item'));
    await t.press('5', 'enter');
    lines = assertScreen(t, 80, 24, 'Stats');
    assert.ok(lines[3].startsWith('│ Health      20/20'));
    assert.ok(t.text().includes('│ Skill checks                          Action profile'));
    assert.ok(t.text().includes('│ Total         1                       start         1'));
    assert.ok(t.text().includes('│ Passed        1                       take          1'));
    await t.press('b');
    assertScreen(t, 80, 24, 'Menu', { focused: 1 });
  });

  it('help scrolls in one focused panel', async () => {
    const { t } = open();
    await tick(20);
    await t.press('5', 'enter');
    const lines = assertScreen(t, 80, 24, 'Help');
    assert.ok(lines[1].startsWith('╭─ How to play ─'));
    assert.ok(t.text().includes('│   1-9         take a suggested action at once (room), jump (menu)'));
    assert.equal(styleAt(t.lastFrame(), '1-9').fg, 'cyan');
    assert.ok(lines[20].startsWith('│ ↓ '), lines[20]);
    await t.press('down', 'down', 'down');
    assert.ok(t.lines()[3].startsWith('│ ↑ '), t.lines()[3]);
    await t.press('b');
    assertScreen(t, 80, 24, 'Menu');
  });

  it('victory: the room ends the quest, ⏎ goes to the menu', async () => {
    const gameState = createInitialGameState();
    gameState.isFirstTurn = false;
    gameState.currentRoom = 'treasure';
    gameState.visitedRooms.add('treasure');
    gameState.inventory.push('amulet', 'vault_key');
    gameState.worldState.quests.claim_treasure.status = 'active';
    Object.assign(gameState.worldState.encounters.treasure_sentinel, { defeated: true, currentHp: 0 });
    gameState.pendingAction = 'Claim the treasure';
    const { t } = open({ gameState, initialScreen: 'room' });
    await tick(60);
    const lines = assertScreen(t, 80, 24, 'Treasure Chamber');
    assert.ok(t.text().includes('│ ✓ You claim the treasure and complete'));
    assert.ok(t.text().includes('│ Victory: the quest is complete.'));
    assert.ok(t.text().includes('The quest is complete.'));
    assert.ok(t.text().includes('Back to the menu: ⏎ menu'));
    assert.ok(!t.text().includes('Ask the Game Master'), 'no prompt after the end');
    assert.ok(statusRow(t).endsWith('✓ Victory! Quest complete'), statusRow(t));
    assert.ok(statusRow(t).startsWith(' ⏎ menu  i items'));
    const raw = t.lastFrame();
    assert.deepEqual(styleAt(raw, 'Victory: the quest'), { fg: 'green', bg: undefined, bold: true, dim: false, underline: false });
    assert.ok(lines[0].endsWith('turn 1'));
    await t.press('enter');
    assertScreen(t, 80, 24, 'Menu');
  });

  it('a saved game resumes without asking the LLM again', async () => {
    const first = open({ username: 'returning' });
    await startGame(first.t);
    first.t.unmount();

    const manager = new SessionManager({ sessionsFile: first.store.sessionsFile });
    const session = manager.createSession('returning', testKey('returning'));
    assert.ok(session.gameState.visitedRooms instanceof Set);
    const llm = stubLlm();
    const t = renderTerminal(h(AdventureApp, { session, saveGame: () => manager.saveSession(session.id), llm }));
    await tick(20);
    assert.ok(t.lines()[2].startsWith('│ › Continue adventure'));
    await t.press('enter');
    await tick(20);
    assertScreen(t, 80, 24, 'Village Square');
    assert.ok(t.text().includes('Lanterns sway over the village square.'));
    assert.equal(llm.calls.length, 0);
  });

  it('without an SSH key: the title bar says the game is not saved, and nothing is written', async () => {
    const { t, store } = open({ username: 'guest', key: null });
    await waitFor(() => t.lines()[0].endsWith('no game · not saved'), { message: 'the menu' });
    await startGame(t);
    await waitFor(() => t.lines()[0].endsWith('turn 1 · not saved'), { message: 'turn 1' });
    assert.equal(fs.existsSync(store.sessionsFile), false);
  });

  it('a saved turn the room cannot render is dropped and replayed', async () => {
    const gameState = createInitialGameState();
    gameState.isFirstTurn = false;
    gameState.moves = 3;
    gameState.lastResponse = { room_name: 'Village Square', description: 'Half a response.' };
    const error = console.error;
    console.error = () => {};
    try {
      const { t, llm, session } = open({ gameState });
      await tick(20);
      assert.equal(session.gameState.lastResponse, undefined);
      await t.press('enter'); // Continue adventure
      await tick(40);
      assertScreen(t, 80, 24, 'Village Square');
      assert.equal(llm.calls.length, 1);
      assert.equal(llm.calls[0].action_text, 'Investigate surroundings');
      assert.ok(statusRow(t).startsWith(' 1-'), statusRow(t));
    } finally {
      console.error = error;
    }
  });

  it('q quits from the room', async () => {
    const { t } = open();
    await startGame(t);
    let exited = false;
    t.waitUntilExit().then(() => { exited = true; });
    await t.press('q');
    await tick(20);
    assert.equal(exited, true);
  });
});

describe('Adventure screens (100x30)', () => {
  it('every screen fills the terminal', async () => {
    const { t } = open({ columns: 100, rows: 30 });
    await tick(20);
    assertScreen(t, 100, 30, 'Menu');
    await t.press('enter');
    await tick(40);
    let lines = assertScreen(t, 100, 30, 'Village Square');
    assert.ok(lines[1].startsWith('╭─ Village Square ─'));
    assert.equal(lines[15], `╭─ Actions ${'─'.repeat(41)}╮╭─ Journal ${'─'.repeat(35)}╮`);
    assert.ok(lines[2].startsWith('│ Lanterns sway over the village square. A dry      │'), lines[2]);
    assert.ok(lines[27].startsWith('│ > Ask the Game Master…'), lines[27]);
    await t.press('m');
    assertScreen(t, 100, 30, 'Village Square');
    for (const [key, screen] of [['i', 'Inventory'], ['j', 'Journal']]) {
      await t.press(key);
      assertScreen(t, 100, 30, screen, { focused: screen === 'Inventory' ? 0 : 1 });
      await t.press('b');
      assertScreen(t, 100, 30, 'Village Square');
    }
    await t.press('h', '5', 'enter');
    assertScreen(t, 100, 30, 'Stats');
    await t.press('h', '6', 'enter');
    assertScreen(t, 100, 30, 'Help');
  });

  it('the journal without a game is the Empty template', async () => {
    const { t } = open({ columns: 100, rows: 30 });
    await tick(20);
    await t.press('3', 'enter');
    assertScreen(t, 100, 30, 'Journal', { focused: 0 });
    assert.ok(t.text().includes('No adventure yet.'));
  });
});
