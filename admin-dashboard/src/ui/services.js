import React from 'react';
import { Box, Text, Panel, Table, ScrollView, EmptyState, useTerminalSize, BlankRow, infoRows, useData } from '@shellcraft/ui';
import { AdminScreen, loadMessage, screenHints, useScreenKeys, SUMMARY_LABEL_WIDTH } from './parts.js';
import { parseServices } from './tables.js';

const h = React.createElement;

/**
 * The model's service listing, parsed: { services } or { failure } with the
 * model's own text ("Error fetching services", "not available on this
 * platform") when it is not launchctl / systemctl output.
 */
export function useServices(ctx) {
  const state = useData(() => ctx.system.getServices());
  const services = state.data === undefined ? undefined : parseServices(state.data);
  const failure = state.error ?? (state.data !== undefined && services === null ? String(state.data).trim() : null);
  return { ...state, services, failure };
}

/** Home detail panel for "Services": how many, then their names. */
export function ServicesSummary({ ctx }) {
  const { services, failure } = useServices(ctx);
  if (failure) return h(EmptyState, { message: failure });
  if (services === undefined) return null;
  return h(
    Box,
    { flexDirection: 'column', flexGrow: 1 },
    ...infoRows([
      ['Listed', `${services.rows.length} services`],
      ['Manager', services.manager]
    ], SUMMARY_LABEL_WIDTH),
    h(BlankRow),
    h(ScrollView, {
      rows: services.names.map((name) => h(Text, { wrap: 'truncate-end' }, name)),
      isActive: false
    })
  );
}

/** Services: launchctl (macOS) or systemctl (Linux) as a table. r refreshes. */
export function ServicesScreen({ ctx }) {
  const state = useServices(ctx);
  const { services, failure, refresh } = state;
  useScreenKeys(ctx, refresh);
  const { rows } = useTerminalSize();
  // Title bar, panel top, table header, panel bottom, status bar.
  const height = Math.max(rows - 5, 1);

  let body = null;
  if (failure) body = h(EmptyState, { message: 'No service list.', hint: 'Try again:', k: 'r', label: 'refresh' });
  else if (services && services.rows.length === 0) body = h(EmptyState, { message: 'No running services listed.' });
  else if (services) body = h(Table, { columns: services.columns, rows: services.rows, selectedIndex: -1, height });

  return h(
    AdminScreen,
    {
      ctx,
      screen: 'Services',
      hints: screenHints({ scroll: (services?.rows.length ?? 0) > height, refresh: true }),
      message: failure ? { tone: 'error', text: failure } : loadMessage(state, 'services')
    },
    h(Panel, { title: 'Services', focused: true, padding: 0 }, body)
  );
}
