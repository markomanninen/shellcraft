import React from 'react';
import { Panel, Table, EmptyState, useTerminalSize } from '@shellcraft/ui';
import { AdminScreen, loadMessage, screenHints, useData, useScreenKeys } from './parts.js';
import { PROCESS_COLUMNS, parseProcesses, processRows, shortCommand } from './tables.js';

const h = React.createElement;

const SUMMARY_COLUMNS = [
  { label: 'Command', width: 20, grow: true },
  { label: 'CPU %', width: 5, align: 'right' },
  { label: 'Mem %', width: 5, align: 'right' }
];

/**
 * The model's `ps aux` text, parsed: { processes } or { failure } with the
 * model's own text ("Error fetching processes") when it is not ps output.
 */
export function useProcesses(ctx, live = true) {
  const state = useData(() => ctx.system.getProcesses(), { interval: live ? ctx.refreshMs : null });
  const processes = state.data === undefined ? undefined : parseProcesses(state.data);
  const failure = state.error ?? (state.data !== undefined && processes === null ? String(state.data).trim() : null);
  return { ...state, processes, failure };
}

/** Home detail panel for "Processes": command, CPU and memory share. */
export function ProcessesSummary({ ctx }) {
  const { processes, failure } = useProcesses(ctx);
  if (failure) return h(EmptyState, { message: failure });
  if (processes === undefined) return null;
  if (processes.length === 0) return h(EmptyState, { message: 'No processes listed.' });
  return h(Table, {
    columns: SUMMARY_COLUMNS,
    rows: processes.map((p) => [shortCommand(p.command), p.cpu, p.mem]),
    selectedIndex: -1,
    isActive: false
  });
}

/** Processes: `ps aux` as a table, refreshed every 2 s. */
export function ProcessesScreen({ ctx }) {
  const state = useProcesses(ctx);
  const { processes, failure, refresh } = state;
  useScreenKeys(ctx, refresh);
  const { rows } = useTerminalSize();
  // Title bar, panel top, table header, panel bottom, status bar.
  const height = Math.max(rows - 5, 1);
  const list = processes ?? [];

  return h(
    AdminScreen,
    {
      ctx,
      screen: 'Processes',
      hints: screenHints({ scroll: list.length > height, refresh: true }),
      message: failure ? { tone: 'error', text: failure } : loadMessage(state, 'processes')
    },
    h(
      Panel,
      { title: 'Processes', focused: true, padding: 0 },
      failure
        ? h(EmptyState, { message: 'No process list.', hint: 'Try again:', k: 'r', label: 'refresh' })
        : h(Table, { columns: PROCESS_COLUMNS, rows: processRows(list), selectedIndex: -1, height })
    )
  );
}
