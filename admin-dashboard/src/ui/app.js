import React, { useRef, useState } from 'react';
import { useApp, useInput } from '@shellcraft/ui';
import { SystemModel } from '../models/system.js';
import { DashboardScreen } from './dashboard.js';
import { OverviewScreen } from './overview.js';
import { ResourcesScreen } from './resources.js';
import { ProcessesScreen } from './processes.js';
import { LogsScreen } from './logs.js';
import { NetworkScreen } from './network.js';
import { ServicesScreen } from './services.js';
import { SettingsScreen } from './settings.js';

const h = React.createElement;

export const screens = {
  dashboard: DashboardScreen,
  overview: OverviewScreen,
  resources: ResourcesScreen,
  processes: ProcessesScreen,
  logs: LogsScreen,
  network: NetworkScreen,
  services: ServicesScreen,
  settings: SettingsScreen
};

/** Live stats refresh period. */
export const REFRESH_MS = 2000;
/** The log screen keeps at most this many entries. */
export const MAX_LOGS = 500;

/**
 * The dashboard for one SSH session. Holds the current screen, the status
 * bar message, the highlighted menu item (kept when coming back) and the
 * simulated log; screens get a `ctx` to navigate and show messages.
 *
 * session: { id, fingerprint, createdAt } from SessionManager
 * system: a SystemModel (one per session by default; tests pass a stub)
 * terminal: the client's TERM from the pty request
 * refreshMs: live stats period (2 s)
 *
 * q quits from every screen (Ctrl-C too, handled by serve()).
 */
export function AdminApp({ session, system, terminal, initialScreen = 'dashboard', refreshMs = REFRESH_MS }) {
  const { exit } = useApp();
  const [model] = useState(() => system ?? new SystemModel());
  const [hostname] = useState(() => model.getSystemInfo().hostname);
  const [route, setRoute] = useState({ name: screens[initialScreen] ? initialScreen : 'dashboard', visit: 0 });
  const [message, setMessage] = useState({ tone: 'success', text: 'Connected' });
  const [menuIndex, setMenuIndex] = useState(0);
  const [logs, setLogs] = useState(() => model.getMockLogs());
  const visits = useRef(0);

  useInput((input, key) => {
    if (input === 'q' && !key.ctrl && !key.meta) exit();
  });

  const ctx = {
    session,
    system: model,
    hostname,
    terminal,
    refreshMs,
    message,
    menuIndex,
    setMenuIndex,
    logs,
    navigate(name) {
      visits.current += 1;
      setRoute({ name: screens[name] ? name : 'dashboard', visit: visits.current });
      setMessage(null);
    },
    /** Show a status bar message; notify(null) clears it. */
    notify(tone, text) {
      setMessage(tone ? { tone, text } : null);
    },
    /** One new simulated entry at the end of the log (live tail). */
    appendLog() {
      setLogs((previous) => [...previous, model.createMockLog()].slice(-MAX_LOGS));
    },
    /** A fresh simulated log (r on the Logs screen). */
    reloadLogs() {
      setLogs(model.getMockLogs());
    },
    quit: exit
  };

  const Current = screens[route.name];
  return h(Current, { key: `${route.name}-${route.visit}`, ctx });
}
