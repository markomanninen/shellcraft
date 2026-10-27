import React from 'react';
import { Box, Panel, ScrollView, useInterval, useTerminalSize } from '@shellcraft/ui';
import { AdminScreen, Blank, infoRows, screenHints, useScreenKeys, SUMMARY_LABEL_WIDTH } from './parts.js';

const h = React.createElement;

const LEVEL_TONES = { WARN: 'warning', ERROR: 'danger', DEBUG: 'muted' };
const LEVEL_WIDTH = 5;
// Wrapped message text lines up under the message: "HH:MM:SS  LEVEL  ".
const MESSAGE_INDENT = 8 + 2 + LEVEL_WIDTH + 2;

/** One ScrollView line per entry: WARN yellow, ERROR red, DEBUG muted. */
export const logLines = (logs) =>
  logs.map((log) => ({
    text: `${log.timestamp}  ${String(log.level).padEnd(LEVEL_WIDTH)}  ${log.message}`,
    tone: LEVEL_TONES[log.level] ?? 'default',
    hangingIndent: MESSAGE_INDENT
  }));

export const countLevel = (logs, level) => logs.filter((log) => log.level === level).length;

/** Home detail panel for "Logs": counts, then the latest entries. */
export function LogsSummary({ ctx }) {
  const { logs } = ctx;
  const errors = countLevel(logs, 'ERROR');
  const warnings = countLevel(logs, 'WARN');
  return h(
    Box,
    { flexDirection: 'column', flexGrow: 1 },
    ...infoRows([
      ['Entries', String(logs.length)],
      ['Errors', String(errors), errors > 0 ? 'danger' : 'default'],
      ['Warnings', String(warnings), warnings > 0 ? 'warning' : 'default']
    ], SUMMARY_LABEL_WIDTH),
    h(Blank),
    h(ScrollView, { lines: logLines(logs), follow: true, isActive: false })
  );
}

/**
 * Logs (simulated): follows the end as entries arrive (one every 2 s while
 * the screen is open); scrolling up stops following, End resumes. r loads a
 * fresh set.
 */
export function LogsScreen({ ctx }) {
  useInterval(ctx.appendLog, ctx.refreshMs);
  useScreenKeys(ctx, () => {
    ctx.reloadLogs();
    return true;
  });
  const { columns, rows } = useTerminalSize();
  // Title bar, panel top and bottom, status bar; one cell padding left and right.
  const height = Math.max(rows - 4, 1);
  const width = Math.max(columns - 4, 1);

  return h(
    AdminScreen,
    { ctx, screen: 'Logs', hints: screenHints({ scroll: ctx.logs.length > height, refresh: true }) },
    h(
      Panel,
      { title: 'Logs', focused: true, paddingX: 1, paddingY: 0 },
      h(ScrollView, { lines: logLines(ctx.logs), follow: true, height, width })
    )
  );
}
