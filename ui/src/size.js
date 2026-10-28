import React, { createContext, useContext, useEffect, useState } from 'react';
import { useStdout } from 'ink';

const DEFAULT_SIZE = Object.freeze({ columns: 80, rows: 24 });

// Size of the screen being drawn. Screen provides it so deeper components
// (Panel's top edge, StatusBar) do not each subscribe to 'resize'.
export const SizeContext = createContext(null);

// Terminal size pushed down by serve(). On a window change serve() re-renders
// the tree with the new size synchronously, *before* Ink handles 'resize'.
// A state update from a 'resize' listener would only commit after Ink has
// already drawn the old layout (e.g. 24 rows into an 18-row terminal, which
// scrolls for one frame).
export const TerminalSizeContext = createContext(null);

const readSize = (stdout) => ({
  columns: stdout?.columns > 0 ? stdout.columns : DEFAULT_SIZE.columns,
  rows: stdout?.rows > 0 ? stdout.rows : DEFAULT_SIZE.rows
});

/**
 * Terminal size: from serve() when running over SSH, otherwise from Ink's
 * stdout columns/rows, updated on its 'resize' event. Unlike Ink's
 * useWindowSize it never shells out to guess a size: an unknown size is
 * 80x24, the design target.
 */
export function useTerminalSize() {
  const pushed = useContext(TerminalSizeContext);
  const { stdout } = useStdout();
  const [size, setSize] = useState(() => readSize(stdout));

  useEffect(() => {
    if (pushed || !stdout || typeof stdout.on !== 'function') return undefined;
    const onResize = () => {
      const next = readSize(stdout);
      setSize((prev) => (prev.columns === next.columns && prev.rows === next.rows ? prev : next));
    };
    stdout.on('resize', onResize);
    onResize();
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout, pushed]);

  return pushed ?? size;
}

/** The enclosing Screen's size, or 80x24 outside a Screen. */
export function useScreenSize() {
  return useContext(SizeContext) ?? DEFAULT_SIZE;
}

export const SizeProvider = ({ value, children }) =>
  React.createElement(SizeContext.Provider, { value }, children);
