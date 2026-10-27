import React, { useReducer, useRef } from 'react';
import {
  useAnimation,
  Screen,
  Panel,
  SelectList,
  Box,
  Text,
  useInput,
  useTerminalSize,
  textProps,
  renderLocal
} from '@shellcraft/ui';
import { animations as ANIMATIONS } from './animations.js';

const h = React.createElement;

export const APP_NAME = 'Animation Demo';

// The list column: wide enough for "› Bubbling Cauldron  2" with the
// panel border; the old sidebar was 28 columns too.
export const LIST_WIDTH = 28;

// Speed in steps of 0.2×, from 0.2× to 5× (as before); 5 steps = 1×.
export const SPEED_STEPS_PER_X = 5;
export const MIN_SPEED_STEP = 1;
export const MAX_SPEED_STEP = 25;
export const MIN_INTERVAL = 50;

/** Milliseconds per frame for a base interval at a speed step. */
export function frameInterval(base, step = SPEED_STEPS_PER_X) {
  return Math.max(MIN_INTERVAL, Math.round((base * SPEED_STEPS_PER_X) / step));
}

/** `1.0×`, `0.2×`, `5.0×`. */
export function speedLabel(step) {
  return `${(step / SPEED_STEPS_PER_X).toFixed(1)}×`;
}

/**
 * Cells inside the stage panel for a terminal of columns x rows: the body
 * (rows minus title and status bar) minus the panel's edges and its one
 * cell of padding, next to the list column.
 */
export function stageInnerSize(columns, rows) {
  return {
    columns: columns - LIST_WIDTH - 2 - 2,
    rows: rows - 2 - 2 - 2
  };
}

const clampStep = (step) => Math.min(MAX_SPEED_STEP, Math.max(MIN_SPEED_STEP, step));

// The frame on screen is (base + ticks) % frames, where ticks is
// useAnimation's counter. Every change that restarts the counter (pause,
// speed, switch) moves the frame on screen into base first, so the
// animation goes on from where it was, as it did before. `shown` is the
// frame on screen when the key came in.
function reducer(state, action) {
  switch (action.type) {
    case 'select':
      return { ...state, index: action.index, base: 0 };
    case 'step': {
      const count = action.count;
      return { ...state, index: (state.index + action.delta + count) % count, base: 0 };
    }
    case 'pause':
      return { ...state, paused: !state.paused, base: action.shown };
    case 'speed':
      // Rebase even at the limits: the key handler restarts the counter.
      return { ...state, step: clampStep(state.step + action.delta), base: action.shown };
    default:
      return state;
  }
}

/** The current frame, centered in a panel titled with the animation's name. */
function Stage({ animation, frame }) {
  const lines = animation.frames[frame];
  const style = textProps(animation.tone);
  return h(
    Panel,
    { title: animation.name },
    h(
      Box,
      {
        flexGrow: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      },
      h(
        Box,
        { flexDirection: 'column', flexShrink: 0 },
        ...lines.map((line, i) => h(Text, { key: i, ...style, wrap: 'truncate-end' }, line))
      )
    )
  );
}

/**
 * ASCII animation viewer: the current animation in a panel, the list of
 * animations (focused) beside it.
 *
 * Keys: space pause/play, + = faster, - _ slower, ←/→ previous/next
 * (wraps), 1-9 or ↑↓ pick from the list. q and Ctrl-C quit (renderLocal).
 *
 * Props for tests: animations, and initial { index, frame, paused, step }.
 */
export function App({ animations = ANIMATIONS, initial = {} }) {
  const [state, dispatch] = useReducer(reducer, null, () => ({
    index: initial.index ?? 0,
    base: initial.frame ?? 0,
    paused: initial.paused ?? false,
    step: clampStep(initial.step ?? SPEED_STEPS_PER_X)
  }));
  const { rows } = useTerminalSize();

  const animation = animations[state.index];
  const count = animation.frames.length;
  const interval = frameInterval(animation.interval, state.step);
  const { frame: ticks, reset } = useAnimation({ interval, isActive: !state.paused });
  const shown = (state.base + (state.paused ? 0 : ticks)) % count;

  // What is on screen, for keys that arrive before the next render.
  const shownRef = useRef(shown);
  shownRef.current = shown;

  const select = (index) => {
    dispatch({ type: 'select', index });
    shownRef.current = 0;
    reset();
  };

  useInput((input, key) => {
    if (input === ' ') {
      dispatch({ type: 'pause', shown: shownRef.current });
      reset();
    } else if (input === '+' || input === '=') {
      dispatch({ type: 'speed', delta: +1, shown: shownRef.current });
      reset();
    } else if (input === '-' || input === '_') {
      dispatch({ type: 'speed', delta: -1, shown: shownRef.current });
      reset();
    } else if (key.leftArrow || key.rightArrow) {
      dispatch({ type: 'step', delta: key.rightArrow ? +1 : -1, count: animations.length });
      shownRef.current = 0;
      reset();
    }
  });

  const items = animations.map((a, i) => ({ label: a.name, hint: i < 9 ? String(i + 1) : undefined }));
  const progress = `${shown + 1}/${count}`;
  const message = state.paused
    ? { tone: 'warning', text: `Paused · frame ${progress}` }
    : { tone: 'info', text: `Frame ${progress} · ${interval} ms` };

  return h(
    Screen,
    {
      app: APP_NAME,
      screen: animation.name,
      meta: `speed ${speedLabel(state.step)}`,
      hints: [
        ['space', state.paused ? 'play' : 'pause'],
        ['+/-', 'speed'],
        ['←→', 'switch'],
        [`1-${Math.min(animations.length, 9)}`, 'jump'],
        ['q', 'quit']
      ],
      message
    },
    h(
      Box,
      { flexGrow: 1 },
      h(Stage, { animation, frame: shown }),
      h(
        Panel,
        { title: 'Animations', focused: true, width: LIST_WIDTH, padding: 0 },
        h(SelectList, {
          items,
          selectedIndex: state.index,
          onChange: select,
          // Body minus the panel's top edge and bottom border.
          height: Math.max(rows - 4, 1)
        })
      )
    )
  );
}

/**
 * Full screen on the local terminal (alternate screen; q and Ctrl-C quit).
 * Options go to renderLocal (tests pass a fake TTY's stdin/stdout).
 */
export function run(options = {}) {
  const { props, ...rest } = options;
  return renderLocal(h(App, props), { quitKeys: ['q'], ...rest });
}
