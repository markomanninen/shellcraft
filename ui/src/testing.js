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

/**
 * Style of the first character of `needle` in a raw (ANSI) frame:
 * { fg, bg, bold, underline } with ANSI color names, undefined = default.
 * Returns null when the text is not on screen. `occurrence` picks the n-th
 * match (0-based).
 */
export function styleAt(raw, needle, occurrence = 0) {
  const chars = [];
  let style = { fg: undefined, bg: undefined, bold: false, underline: false };
  // eslint-disable-next-line no-control-regex
  const token = /\u001B\[([0-9;]*)m|\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001B]*(?:\u0007|\u001B\\)|[@-Z\\-_])|([\s\S])/gu;
  for (const match of String(raw).matchAll(token)) {
    if (match[1] !== undefined) {
      const codes = match[1] === '' ? [0] : match[1].split(';').map(Number);
      style = { ...style };
      for (const code of codes) {
        if (code === 0) style = { fg: undefined, bg: undefined, bold: false, underline: false };
        else if (code === 1) style.bold = true;
        else if (code === 22) style.bold = false;
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
  }

  setRawMode() {}
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

  const lastFrame = () => stdout.frames.at(-1) ?? '';

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
    /** Write raw input; resolves after the app had a chance to re-render. */
    async write(data, wait = 20) {
      stdin.write(data);
      await tick(wait);
    },
    /** Press keys by name (see `keys`) or literal text, one after another. */
    async press(...names) {
      for (const name of names) {
        stdin.write(keys[name] ?? name);
        // A lone ESC waits for the rest of a possible escape sequence.
        await tick(name === 'escape' ? 80 : 20);
      }
    },
    async resize(nextColumns, nextRows) {
      stdout.columns = nextColumns;
      stdout.rows = nextRows;
      stdout.emit('resize');
      await tick(20);
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
