import './color.js';
import React from 'react';
import { render, useApp, useInput } from 'ink';
import { TerminalSizeContext } from './size.js';

const h = React.createElement;

const ESC = '\u001B[';
export const ENTER_ALT_SCREEN = `${ESC}?1049h`;
export const LEAVE_ALT_SCREEN = `${ESC}?1049l`;
const CURSOR_HOME = `${ESC}H`;
const ERASE_SCREEN = `${ESC}2J`;
const SHOW_CURSOR = `${ESC}?25h`;
const RESET_STYLE = `${ESC}0m`;

const toSize = (value, fallback) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/**
 * Ink writes "\n" between rows and expects the terminal to return the
 * carriage (a local tty does that: ONLCR). An ssh2 server has no pty and
 * the ssh client puts its terminal in raw mode (OPOST off), so a bare LF
 * only moves down: every row would start where the previous one ended.
 */
export const toCrlf = (text) => text.replace(/\r?\n/g, '\r\n');

/** Ends the app on Ctrl-C. (q is the app's job: a text field needs it.) */
function SessionRoot({ children }) {
  const { exit } = useApp();
  useInput((input, key) => {
    if (key.ctrl && input === 'c') exit();
  });
  return children;
}

/**
 * Render an Ink element on an ssh2 session stream (the channel from
 * `shell` accept()) and return a cleanup function.
 *
 *   const cleanup = serve(stream, ptyInfo, h(App, props), { session });
 *
 * - stream.columns/rows/isTTY come from ptyInfo (80x24 without a pty), and
 *   a no-op setRawMode is added, so Ink accepts the channel as its stdin
 *   and stdout.
 * - The app runs in the alternate screen; the user's terminal comes back
 *   untouched on exit.
 * - With options.session (the ssh2 Session that emitted 'pty'/'shell'),
 *   'window-change' resizes the screen. cleanup.resize(cols, rows) does
 *   the same by hand.
 * - Ctrl-C, or the app calling useApp().exit() (e.g. on q), unmounts,
 *   leaves the alternate screen, sends exit status 0 and ends the stream.
 * - A client disconnect unmounts quietly; nothing is written to the dead
 *   channel.
 *
 * Returns cleanup(): idempotent; also has .resize(cols, rows),
 * .exited (Promise resolved when the session is over) and .instance.
 */
export function serve(stream, ptyInfo, element, options = {}) {
  const { session = null, altScreen = true, onExit, incrementalRendering = true } = options;

  stream.columns = toSize(ptyInfo?.cols, 80);
  stream.rows = toSize(ptyInfo?.rows, 24);
  stream.isTTY = true;
  if (typeof stream.setRawMode !== 'function') {
    // Raw mode is the client's business (ssh puts its own terminal in raw
    // mode); Ink only needs the method to exist.
    stream.setRawMode = function setRawMode() {
      return this;
    };
  }

  let closed = false;
  let finished = false;
  const hadOwnWrite = Object.prototype.hasOwnProperty.call(stream, 'write');
  const ownWrite = stream.write;
  const originalWrite = ownWrite.bind(stream);

  stream.write = function write(chunk, encoding, callback) {
    if (typeof encoding === 'function') {
      callback = encoding;
      encoding = undefined;
    }
    // ssh2 never calls back for writes to a closed channel, which would
    // leave Ink waiting forever on unmount; drop them instead.
    if (closed || stream.writableEnded || stream.destroyed) {
      if (typeof callback === 'function') process.nextTick(callback);
      return false;
    }
    const data = typeof chunk === 'string' ? toCrlf(chunk) : chunk;
    return originalWrite(data, encoding, callback);
  };

  const restoreWrite = () => {
    if (hadOwnWrite) stream.write = ownWrite;
    else delete stream.write;
  };

  const safeWrite = (data) => {
    try {
      stream.write(data);
    } catch {
      // The channel may already be gone.
    }
  };

  if (altScreen) safeWrite(ENTER_ALT_SCREEN + CURSOR_HOME + ERASE_SCREEN);

  let resolveExited;
  const exited = new Promise((resolve) => {
    resolveExited = resolve;
  });

  const tree = () =>
    h(
      TerminalSizeContext.Provider,
      { value: { columns: stream.columns, rows: stream.rows } },
      h(SessionRoot, null, element)
    );

  const instance = render(tree(), {
    stdin: stream,
    stdout: stream,
    exitOnCtrlC: false,
    patchConsole: false,
    // Ink would otherwise turn itself off in CI (is-in-ci) and when the
    // server process has no TTY; the client terminal is what counts.
    interactive: true,
    // Rewrite only the rows that changed instead of the whole screen.
    incrementalRendering
  });

  const onWindowChange = (accept, _reject, info) => {
    if (typeof accept === 'function') accept();
    resize(info?.cols, info?.rows);
  };

  const onClose = () => {
    closed = true;
    cleanup();
  };

  function finish() {
    if (finished) return;
    finished = true;
    if (session) session.removeListener('window-change', onWindowChange);
    stream.removeListener('close', onClose);
    if (!closed && !stream.writableEnded) {
      safeWrite(RESET_STYLE + (altScreen ? LEAVE_ALT_SCREEN : '') + SHOW_CURSOR);
      try {
        if (typeof stream.exit === 'function') stream.exit(0);
      } catch {
        // Not a session channel (tests) or already closing.
      }
      try {
        stream.end();
      } catch {
        // Already ended.
      }
    }
    restoreWrite();
    // Ink no longer reads the channel. Drain it, or ssh2 never emits 'end'
    // and 'close' for it, and the app's own 'close' handler (session
    // cleanup) would never run.
    try {
      stream.resume();
    } catch {
      // Not a readable stream.
    }
    resolveExited();
    if (typeof onExit === 'function') onExit();
  }

  function cleanup() {
    if (finished) return;
    try {
      instance.unmount();
    } catch {
      // Unmounting a tree whose stream is gone must not take the server down.
    }
    finish();
  }

  function resize(cols, rows) {
    const columns = toSize(cols, stream.columns);
    const nextRows = toSize(rows, stream.rows);
    if (finished || (columns === stream.columns && nextRows === stream.rows)) return;
    stream.columns = columns;
    stream.rows = nextRows;
    // The terminal has already reflowed the old frame. Forget it and start
    // again from the top-left corner.
    instance.clear();
    safeWrite(CURSOR_HOME + ERASE_SCREEN);
    // Lay the tree out for the new size first (synchronous), then let Ink
    // and any useWindowSize() users handle 'resize'. In the other order Ink
    // draws one frame of the old layout, which scrolls a smaller terminal.
    instance.rerender(tree());
    stream.emit('resize');
  }

  // waitUntilExit() also hooks process 'beforeExit' to unmount when the
  // event loop runs dry. A server's loop never does, and one listener per
  // session trips Node's MaxListeners warning at 11 users: take it off.
  const beforeExitListeners = new Set(process.listeners('beforeExit'));
  instance.waitUntilExit().then(finish, finish);
  for (const listener of process.listeners('beforeExit')) {
    if (!beforeExitListeners.has(listener)) process.removeListener('beforeExit', listener);
  }
  stream.on('close', onClose);
  if (session) session.on('window-change', onWindowChange);

  cleanup.resize = resize;
  cleanup.exited = exited;
  cleanup.instance = instance;
  return cleanup;
}
