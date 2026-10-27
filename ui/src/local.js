import { startFullScreen, prepareInput, toSize, liveSessions } from './fullscreen.js';

/**
 * Full-screen Ink on the local terminal (process.stdin/stdout), for apps
 * that run without SSH (animation-demo). Same behaviour as serve():
 * alternate screen with the cursor homed, a Screen exactly the terminal's
 * size, resize without a frame of the old layout, Ctrl-C (and quitKeys)
 * unmount and give the terminal back as it was. The alternate screen is
 * also left when the process is killed (Ink unmounts on SIGINT/SIGTERM).
 *
 *   const cleanup = renderLocal(h(App), { quitKeys: ['q'] });
 *   await cleanup.exited;   // the process exits by itself afterwards
 *
 * Options: stdin, stdout (default process.*; tests pass fakes), quitKeys
 * ([] by default), altScreen (true), incrementalRendering (true), onExit.
 * Returns cleanup(): idempotent; also has .exited (Promise) and .instance.
 */
export function renderLocal(element, options = {}) {
  const {
    stdin = process.stdin,
    stdout = process.stdout,
    altScreen = true,
    incrementalRendering = true,
    quitKeys = [],
    onExit
  } = options;

  prepareInput(stdin);

  const size = () => ({ columns: toSize(stdout.columns, 80), rows: toSize(stdout.rows, 24) });
  const write = (data) => {
    try {
      stdout.write(data);
    } catch {
      // Closed terminal.
    }
  };

  let finished = false;
  let resolveExited;
  const exited = new Promise((resolve) => {
    resolveExited = resolve;
  });

  const screen = startFullScreen({ stdin, stdout, element, size, write, altScreen, incrementalRendering, quitKeys });
  const { instance } = screen;

  // Node updates stdout.columns/rows and then emits 'resize' (SIGWINCH).
  // Run before Ink's own handler, like serve() does on window-change.
  let last = size();
  const onResize = () => {
    const next = size();
    if (finished || (next.columns === last.columns && next.rows === last.rows)) return;
    last = next;
    screen.redraw();
  };
  if (typeof stdout.prependListener === 'function') stdout.prependListener('resize', onResize);
  else stdout.on('resize', onResize);

  function finish() {
    if (finished) return;
    finished = true;
    stdout.removeListener('resize', onResize);
    screen.leave();
    liveSessions.delete(cleanup);
    resolveExited();
    if (typeof onExit === 'function') onExit();
  }

  function cleanup() {
    if (finished) return;
    try {
      instance.unmount();
    } catch {
      // Already gone.
    }
    finish();
  }

  screen.exitPromise.then(finish, finish);
  liveSessions.add(cleanup);

  cleanup.exited = exited;
  cleanup.instance = instance;
  return cleanup;
}
