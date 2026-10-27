// Test helpers for apps built on @shellcraft/ui: render on a fake terminal
// of a given size and drive it with keys (like ink-testing-library, but
// with rows, columns and resize()), read styles back from frames, and fake
// an ssh2 channel/session for serve().
import './color.js';
import { EventEmitter } from 'node:events';
import { Duplex } from 'node:stream';
import { render } from 'ink';

export const keys = Object.freeze({
  up: '\u001B[A',
  down: '\u001B[B',
  right: '\u001B[C',
  left: '\u001B[D',
  enter: '\r',
  escape: '\u001B',
  backspace: '\u007F',
  tab: '\t',
  ctrlC: '\u0003'
});

// CSI / OSC / single-char escape sequences.
// eslint-disable-next-line no-control-regex
const ANSI = /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001B]*(?:\u0007|\u001B\\)|[@-Z\\-_])/g;

export const stripAnsi = (text) => String(text ?? '').replace(ANSI, '');

const FG = {
  30: 'black', 31: 'red', 32: 'green', 33: 'yellow', 34: 'blue', 35: 'magenta', 36: 'cyan', 37: 'white',
  90: 'gray', 91: 'redBright', 92: 'greenBright', 93: 'yellowBright', 94: 'blueBright',
  95: 'magentaBright', 96: 'cyanBright', 97: 'whiteBright'
};

const PLAIN = Object.freeze({ fg: undefined, bg: undefined, bold: false, dim: false, underline: false });

/**
 * Style of the first character of `needle` in a raw (ANSI) frame:
 * { fg, bg, bold, dim, underline } with ANSI color names, undefined =
 * default. Returns null when the text is not on screen. `occurrence` picks
 * the n-th match (0-based).
 */
export function styleAt(raw, needle, occurrence = 0) {
  const chars = styledChars(raw);
  const target = Array.from(needle);
  let seen = 0;
  for (let i = 0; i + target.length <= chars.length; i++) {
    if (target.every((ch, j) => chars[i + j].ch === ch)) {
      if (seen === occurrence) return { ...chars[i].style };
      seen++;
    }
  }
  return null;
}

/** Style of the cell at (row, column) of a raw frame (0-based), or null. */
export function styleAtCell(raw, row, column) {
  let r = 0;
  let c = 0;
  for (const { ch, style } of styledChars(raw)) {
    if (ch === '\n') {
      r++;
      c = 0;
      continue;
    }
    if (r === row && c === column) return { ...style };
    c++;
  }
  return null;
}

/** Characters of a raw frame that are both bold and dim (see theme.js). */
export function boldDimText(raw) {
  return styledChars(raw)
    .filter(({ ch, style }) => style.bold && style.dim && ch.trim() !== '')
    .map(({ ch }) => ch)
    .join('');
}

function styledChars(raw) {
  const chars = [];
  let style = { ...PLAIN };
  // eslint-disable-next-line no-control-regex
  const token = /\u001B\[([0-9;]*)m|\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001B]*(?:\u0007|\u001B\\)|[@-Z\\-_])|([\s\S])/gu;
  for (const match of String(raw).matchAll(token)) {
    if (match[1] !== undefined) {
      const codes = match[1] === '' ? [0] : match[1].split(';').map(Number);
      style = { ...style };
      for (const code of codes) {
        if (code === 0) style = { ...PLAIN };
        else if (code === 1) style.bold = true;
        else if (code === 2) style.dim = true;
        // One reset for both: SGR 1 and 2 are one "intensity" in ECMA-48.
        else if (code === 22) Object.assign(style, { bold: false, dim: false });
        else if (code === 4) style.underline = true;
        else if (code === 24) style.underline = false;
        else if (code === 39) style.fg = undefined;
        else if (code === 49) style.bg = undefined;
        else if (FG[code]) style.fg = FG[code];
        else if (FG[code - 10]) style.bg = FG[code - 10];
      }
    } else if (match[2] !== undefined) {
      chars.push({ ch: match[2], style });
    }
  }
  return chars;
}

export const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

class FakeStdout extends EventEmitter {
  constructor(columns, rows) {
    super();
    this.columns = columns;
    this.rows = rows;
    this.isTTY = true;
    this.frames = [];
  }

  write(frame, encoding, callback) {
    if (typeof encoding === 'function') callback = encoding;
    if (frame !== '') this.frames.push(String(frame));
    if (typeof callback === 'function') callback();
    return true;
  }
}

class FakeStdin extends EventEmitter {
  constructor() {
    super();
    this.isTTY = true;
    this.queue = [];
    this.rawMode = false;
  }

  setRawMode(enabled) {
    this.rawMode = Boolean(enabled);
  }
  setEncoding() {}
  resume() {}
  pause() {}
  ref() {}
  unref() {}

  read() {
    return this.queue.length > 0 ? this.queue.shift() : null;
  }

  write(data) {
    this.queue.push(String(data));
    this.emit('readable');
  }
}

const mounted = new Set();

/**
 * Unmount everything renderTerminal() mounted and is still mounted. Call it
 * from afterEach, so a failing test cannot leave an animated tree (spinner)
 * keeping the test process alive.
 */
export function cleanupTerminals() {
  for (const instance of mounted) {
    try {
      instance.unmount();
    } catch {
      // Already gone.
    }
  }
  mounted.clear();
}

/**
 * Render on a columns x rows fake terminal. Frames are whole screens (Ink
 * debug mode), so lastFrame() is what the user would see.
 */
export function renderTerminal(element, { columns = 80, rows = 24 } = {}) {
  const stdout = new FakeStdout(columns, rows);
  const stderr = new FakeStdout(columns, rows);
  const stdin = new FakeStdin();
  const instance = render(element, {
    stdout,
    stderr,
    stdin,
    debug: true,
    interactive: false,
    exitOnCtrlC: false,
    patchConsole: false
  });
  // Unmounting twice is a no-op in Ink, so finished instances can stay listed.
  mounted.add(instance);

  const lastFrame = () => stdout.frames.at(-1) ?? '';

  // After input: wait at least `min` ms, then for the frame the input causes
  // (if it causes one), then until no new frame has come for `quiet` ms. A
  // fixed sleep was enough on a fast machine but not on a loaded CI runner.
  // `max` bounds screens that animate without pause.
  async function settle(before, min = 20, { appear = 200, quiet = 20, max = 600 } = {}) {
    const start = Date.now();
    await tick(min);
    while (stdout.frames.length === before && Date.now() - start < appear) await tick(5);
    let count = stdout.frames.length;
    let still = Date.now();
    while (Date.now() - start < max) {
      await tick(5);
      if (stdout.frames.length !== count) {
        count = stdout.frames.length;
        still = Date.now();
      } else if (Date.now() - still >= quiet) {
        break;
      }
    }
  }

  return {
    stdout,
    stdin,
    frames: stdout.frames,
    lastFrame,
    /** The last frame without ANSI codes. */
    text: () => stripAnsi(lastFrame()),
    /** The last frame's rows without ANSI codes. */
    lines: () => stripAnsi(lastFrame()).split('\n'),
    rerender: (next) => instance.rerender(next),
    unmount: () => instance.unmount(),
    waitUntilExit: () => instance.waitUntilExit(),
    /** Write raw input; resolves once the app has re-rendered (see settle). */
    async write(data, wait = 20) {
      const before = stdout.frames.length;
      stdin.write(data);
      await settle(before, wait);
    },
    /** Press keys by name (see `keys`) or literal text, one after another. */
    async press(...names) {
      for (const name of names) {
        const before = stdout.frames.length;
        stdin.write(keys[name] ?? name);
        // A lone ESC waits for the rest of a possible escape sequence.
        await settle(before, name === 'escape' ? 80 : 20);
      }
    },
    async resize(nextColumns, nextRows) {
      const before = stdout.frames.length;
      stdout.columns = nextColumns;
      stdout.rows = nextRows;
      stdout.emit('resize');
      await settle(before);
    }
  };
}

/**
 * Stand-in for an ssh2 session channel: a Duplex whose output goes to
 * `onOutput` (e.g. a headless terminal) and whose input is what the client
 * types (`type()`). Like ssh2 it has exit(code) and emits 'close' when the
 * client goes away (`disconnect()`).
 */
export class FakeSshChannel extends Duplex {
  constructor(onOutput = () => {}) {
    super();
    this.onOutput = onOutput;
    this.output = [];
    this.exitCode = null;
    this.writesAfterClose = 0;
    this.gone = false;
  }

  _read() {}

  _write(chunk, encoding, callback) {
    if (this.gone) {
      // ssh2 silently drops writes to a closed channel and never calls back.
      this.writesAfterClose++;
      return;
    }
    const text = chunk.toString();
    this.output.push(text);
    this.onOutput(text, callback);
  }

  exit(code) {
    this.exitCode = code;
  }

  type(data) {
    this.push(data);
  }

  disconnect() {
    this.gone = true;
    this.push(null);
    this.emit('close');
  }

  takeOutput() {
    const all = this.output.join('');
    this.output = [];
    return all;
  }
}

/** Stand-in for the ssh2 Session that emits 'window-change'. */
export class FakeSshSession extends EventEmitter {
  windowChange(cols, rows) {
    let accepted = false;
    this.emit('window-change', () => { accepted = true; }, () => {}, { cols, rows, width: 0, height: 0 });
    return accepted;
  }
}

/**
 * A local terminal for renderLocal() tests: a TTY stdin (records raw mode)
 * and a TTY stdout of columns x rows whose bytes go to onOutput(text, done)
 * (e.g. a headless xterm) and to .output.
 *   type(data): the user types; resize(cols, rows): SIGWINCH.
 */
export function createFakeTty({ columns = 80, rows = 24, onOutput = (_text, done) => done() } = {}) {
  const stdin = new FakeStdin();
  const output = [];
  const stdout = new (class extends EventEmitter {
    constructor() {
      super();
      this.isTTY = true;
      this.columns = columns;
      this.rows = rows;
      this.writable = true;
    }

    write(data, encoding, callback) {
      if (typeof encoding === 'function') callback = encoding;
      const text = String(data);
      output.push(text);
      onOutput(text, () => {
        if (typeof callback === 'function') callback();
      });
      return true;
    }
  })();
  return {
    stdin,
    stdout,
    output,
    takeOutput() {
      return output.splice(0).join('');
    },
    type(data) {
      stdin.write(data);
    },
    resize(nextColumns, nextRows) {
      stdout.columns = nextColumns;
      stdout.rows = nextRows;
      stdout.emit('resize');
    }
  };
}
