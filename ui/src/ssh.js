import { startFullScreen, prepareInput, toSize, liveSessions, ENTER_ALT_SCREEN, LEAVE_ALT_SCREEN } from './fullscreen.js';

export { ENTER_ALT_SCREEN, LEAVE_ALT_SCREEN };

/**
 * Ink writes "\n" between rows and expects the terminal to return the
 * carriage (a local tty does that: ONLCR). An ssh2 server has no pty and
 * the ssh client puts its terminal in raw mode (OPOST off), so a bare LF
 * only moves down: every row would start where the previous one ended.
 */
export const toCrlf = (text) => text.replace(/\r?\n/g, '\r\n');

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
 * - Ctrl-C, options.quitKeys (e.g. ['q'], off by default), or the app
 *   calling useApp().exit() unmounts, leaves the alternate screen, sends
 *   exit status 0 and ends the stream.
 * - A client disconnect unmounts quietly; nothing is written to the dead
 *   channel.
 *
 * Options: session, quitKeys, altScreen (true), incrementalRendering
 * (true), onExit.
 * Returns cleanup(): idempotent; also has .resize(cols, rows),
 * .exited (Promise resolved when the session is over) and .instance.
 */
export function serve(stream, ptyInfo, element, options = {}) {
  const { session = null, altScreen = true, onExit, incrementalRendering = true, quitKeys = [] } = options;

  stream.columns = toSize(ptyInfo?.cols, 80);
  stream.rows = toSize(ptyInfo?.rows, 24);
  prepareInput(stream);

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

  let resolveExited;
  const exited = new Promise((resolve) => {
    resolveExited = resolve;
  });

  const screen = startFullScreen({
    stdin: stream,
    stdout: stream,
    element,
    size: () => ({ columns: stream.columns, rows: stream.rows }),
    write: safeWrite,
    altScreen,
    incrementalRendering,
    quitKeys
  });
  const { instance } = screen;

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
      screen.leave(); // normally done already, while Ink unmounted
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
    liveSessions.delete(cleanup);
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
    screen.redraw();
    // Then Ink, and any useWindowSize() users.
    stream.emit('resize');
  }

  screen.exitPromise.then(finish, finish);
  liveSessions.add(cleanup);
  stream.on('close', onClose);
  if (session) session.on('window-change', onWindowChange);

  cleanup.resize = resize;
  cleanup.exited = exited;
  cleanup.instance = instance;
  return cleanup;
}
