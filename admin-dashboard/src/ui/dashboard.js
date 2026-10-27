import React from 'react';
import { Box, Panel, SelectList } from '@shellcraft/ui';
import { AdminScreen } from './parts.js';
import { OverviewSummary } from './overview.js';
import { ResourcesSummary } from './resources.js';
import { ProcessesSummary } from './processes.js';
import { LogsSummary } from './logs.js';
import { NetworkSummary } from './network.js';
import { ServicesSummary } from './services.js';
import { SettingsSummary } from './settings.js';

const h = React.createElement;

/**
 * The menu: label, number hint, the screen ⏎ opens and the summary the
 * detail panel shows while the item is highlighted. `flush`: the summary
 * is a table, whose rows bring their own one-cell padding.
 */
export const MENU = [
  { label: 'System overview', hint: '1', screen: 'overview', Summary: OverviewSummary },
  { label: 'CPU & memory', hint: '2', screen: 'resources', Summary: ResourcesSummary },
  { label: 'Processes', hint: '3', screen: 'processes', Summary: ProcessesSummary, flush: true },
  { label: 'Logs', hint: '4', screen: 'logs', Summary: LogsSummary },
  { label: 'Network', hint: '5', screen: 'network', Summary: NetworkSummary },
  { label: 'Services', hint: '6', screen: 'services', Summary: ServicesSummary },
  { label: 'Settings', hint: '7', screen: 'settings', Summary: SettingsSummary }
];

export const MENU_WIDTH = 30;

/**
 * Home, the Figma "Menu + detail" template: the menu (30 cells) has focus,
 * the detail panel beside it summarises the highlighted item and follows
 * the selection; ⏎ opens the full screen, 1-7 jump. No Exit item: q quits.
 */
export function DashboardScreen({ ctx }) {
  const index = Math.min(Math.max(ctx.menuIndex, 0), MENU.length - 1);
  const item = MENU[index];

  return h(
    AdminScreen,
    {
      ctx,
      screen: 'Dashboard',
      hints: [['↑↓', 'move'], ['⏎', 'open'], [`1-${MENU.length}`, 'jump'], ['q', 'quit']]
    },
    h(
      Box,
      { flexGrow: 1 },
      h(
        Panel,
        { title: 'Menu', focused: true, width: MENU_WIDTH, padding: 0 },
        h(SelectList, {
          items: MENU,
          selectedIndex: index,
          onChange: ctx.setMenuIndex,
          onSelect: (_i, selected) => ctx.navigate(selected.screen)
        })
      ),
      h(
        Panel,
        { title: item.label, paddingX: item.flush ? 0 : 1 },
        // Keyed by item: moving the selection mounts the next summary and
        // unmounts the last one (and its refresh timer).
        h(item.Summary, { key: item.screen, ctx })
      )
    )
  );
}
