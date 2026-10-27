// The part of serve() and renderLocal() that does not care where the
// terminal is: Ink options, alternate screen, Ctrl-C, redraw on resize.
import './color.js';
import React, { useLayoutEffect } from 'react';
import { render, useApp, useInput } from 'ink';
import { TerminalSizeContext } from './size.js';

const h = React.createElement;

const ESC = '\u001B[';
export const ENTER_ALT_SCREEN = `${ESC}?1049h`;
export const LEAVE_ALT_SCREEN = `${ESC}?1049l`;
export const CURSOR_HOME = `${ESC}H`;
export const ERASE_SCREEN = `${ESC}2J`;
export const SHOW_CURSOR = `${ESC}?25h`;
export const RESET_STYLE = `${ESC}0m`;

/**
 * Cleanup functions of the serve()/renderLocal() sessions still running.
 * A server never needs it; the testing helpers end what a failed test left
 * behind (cleanupTerminals), so a spinner or interval cannot keep the test
 * process alive.
 */
export const liveSessions = new Set();

export const toSize = (value, fallback) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/**
 * Ink needs stdin.isTTY and a setRawMode() to take keys. An SSH channel
 * has neither (the client's terminal is already raw), nor has a piped
 * stdin; give them a no-op.
 */
export function prepareInput(stream) {
  if (stream.isTTY !== true || typeof stream.setRawMode !== 'function') {
    if (typeof stream.setRawMode !== 'function') {
      stream.setRawMode = function setRawMode() {
        return this;
      };
    }
    stream.isTTY = true;
  }
}

/**
 * Ends the app on Ctrl-C, and on `quitKeys` (e.g. ['q']; off by default,
 * since a text field needs the letter). Runs `onUnmount` synchronously while
 * Ink unmounts, also when Ink unmounts from a signal handler, so the
 * alternate screen is always left.
 */
function SessionRoot({ quitKeys, onUnmount, children }) {
  const { exit } = useApp();
  useInput((input, key) => {
    if (key.ctrl && input === 'c') exit();
    else if (!key.ctrl && !key.meta && quitKeys.includes(input)) exit();
  });
  useLayoutEffect(() => onUnmount, [onUnmount]);
  return children;
}

/**
 * Mount `element` full screen on stdin/stdout.
 *   size(): the current { columns, rows }
 *   write(data): best-effort write to the terminal
 * Returns { instance, exitPromise, redraw(), leave() }.
 */
export function startFullScreen({
  stdin,
  stdout,
  element,
  size,
  write,
  altScreen = true,
  incrementalRendering = true,
  quitKeys = []
}) {
  let left = !altScreen;
  const leave = () => {
    if (left) return;
    left = true;
    write(RESET_STYLE + LEAVE_ALT_SCREEN + SHOW_CURSOR);
  };

  const keys = Array.isArray(quitKeys) ? quitKeys : [];
  const tree = () =>
    h(
      TerminalSizeContext.Provider,
      { value: size() },
      h(SessionRoot, { quitKeys: keys, onUnmount: leave }, element)
    );

  // Enter the alternate screen with the cursor home, so the first frame
  // starts at the top instead of on the shell prompt's row.
  if (altScreen) write(ENTER_ALT_SCREEN + CURSOR_HOME + ERASE_SCREEN);

  const instance = render(tree(), {
    stdin,
    stdout,
    exitOnCtrlC: false,
    patchConsole: false,
    // Ink would otherwise turn itself off in CI (is-in-ci) and when the
    // process has no TTY; the terminal on the other end is what counts.
    interactive: true,
    // Rewrite only the rows that changed instead of the whole screen.
    incrementalRendering
  });

  // waitUntilExit() also hooks process 'beforeExit' to unmount when the
  // event loop runs dry. A server's loop never does, and one listener per
  // session trips Node's MaxListeners warning at 11 users: take it off.
  const beforeExitListeners = new Set(process.listeners('beforeExit'));
  const exitPromise = instance.waitUntilExit();
  for (const listener of process.listeners('beforeExit')) {
    if (!beforeExitListeners.has(listener)) process.removeListener('beforeExit', listener);
  }

  /**
   * After the terminal changed size: forget the old frame, start again from
   * the top-left corner and lay the tree out for the new size synchronously.
   * Call it before Ink sees 'resize'; in the other order Ink first draws the
   * old layout, which scrolls a smaller terminal for one frame.
   */
  const redraw = () => {
    instance.clear();
    write(CURSOR_HOME + ERASE_SCREEN);
    instance.rerender(tree());
  };

  return { instance, exitPromise, redraw, leave };
}
