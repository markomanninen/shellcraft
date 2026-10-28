import React from 'react';
import { Box, Panel, Table, ScrollView, EmptyState, useTerminalSize, BlankRow, InfoRow, infoRows, useData } from '@shellcraft/ui';
import { AdminScreen, screenHints, useScreenKeys, SUMMARY_LABEL_WIDTH } from './parts.js';
import { NETWORK_COLUMNS, networkRows } from './tables.js';

const h = React.createElement;

const isIPv4 = (iface) => iface.family === 'IPv4' || iface.family === 4;

/** Home detail panel for "Network": counts, then each IPv4 address. */
export function NetworkSummary({ ctx }) {
  const { data, error } = useData(() => ctx.system.getNetworkInfo());
  if (error) return h(EmptyState, { message: error });
  const interfaces = data ?? [];
  const names = new Set(interfaces.map((i) => i.interface));
  return h(
    Box,
    { flexDirection: 'column', flexGrow: 1 },
    ...infoRows([
      ['Interfaces', String(names.size)],
      ['Addresses', String(interfaces.length)]
    ], SUMMARY_LABEL_WIDTH),
    h(BlankRow),
    h(ScrollView, {
      rows: interfaces
        .filter(isIPv4)
        .map((i) => h(InfoRow, { label: i.interface, value: i.address, labelWidth: SUMMARY_LABEL_WIDTH })),
      isActive: false
    })
  );
}

/** Network: every address of every interface. r refreshes. */
export function NetworkScreen({ ctx }) {
  const { data, error, refresh } = useData(() => ctx.system.getNetworkInfo());
  useScreenKeys(ctx, refresh);
  const { rows } = useTerminalSize();
  // Title bar, panel top, table header, panel bottom, status bar.
  const height = Math.max(rows - 5, 1);
  const interfaces = data ?? [];

  let body;
  if (error) body = h(EmptyState, { message: 'No network information.', hint: 'Try again:', k: 'r', label: 'refresh' });
  else if (interfaces.length === 0) body = h(EmptyState, { message: 'No network interfaces.' });
  else body = h(Table, { columns: NETWORK_COLUMNS, rows: networkRows(interfaces), selectedIndex: -1, height });

  return h(
    AdminScreen,
    {
      ctx,
      screen: 'Network',
      hints: screenHints({ scroll: interfaces.length > height, refresh: true }),
      message: error ? { tone: 'error', text: error } : undefined
    },
    h(Panel, { title: 'Network interfaces', focused: true, padding: 0 }, body)
  );
}
