import React, { useState } from 'react';
import { Box, Panel, useTerminalSize } from '@shellcraft/ui';
import { AdminScreen, infoRows, screenHints, useScreenKeys, SUMMARY_LABEL_WIDTH } from './parts.js';

const h = React.createElement;

const pad2 = (n) => String(n).padStart(2, '0');

/** "2026-10-27 09:41:05" in the server's local time. */
export function formatDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** The client's terminal type from the pty request, else the server's TERM. */
const terminalType = (ctx, env) => ctx.terminal || env.term;

/** Home detail panel for "Settings". */
export function SettingsSummary({ ctx }) {
  const [env] = useState(() => ctx.system.getEnvironment());
  const { columns, rows } = useTerminalSize();
  return h(
    Box,
    { flexDirection: 'column' },
    ...infoRows([
      ['Node', env.node],
      ['Platform', `${env.platform} ${env.release}`],
      ['SSH port', env.sshPort],
      null,
      ['Session', ctx.session.id],
      ['Fingerprint', ctx.session.fingerprint],
      ['Screen', `${columns}×${rows}`]
    ], SUMMARY_LABEL_WIDTH)
  );
}

/** Settings: the server environment and this session, read-only. */
export function SettingsScreen({ ctx }) {
  const [env] = useState(() => ctx.system.getEnvironment());
  useScreenKeys(ctx);
  const { columns, rows } = useTerminalSize();
  const { session } = ctx;

  return h(
    AdminScreen,
    { ctx, screen: 'Settings', hints: screenHints() },
    h(
      Panel,
      { title: 'Settings', focused: true },
      ...infoRows([
        ['Node version', env.node],
        ['Platform', `${env.platform} ${env.release}`],
        ['Architecture', env.arch],
        ['Home', env.home],
        ['Temp', env.tmp],
        ['Shell', env.shell],
        ['Terminal', terminalType(ctx, env)],
        ['SSH port', env.sshPort],
        null,
        ['Session ID', session.id],
        ['Fingerprint', session.fingerprint],
        ['Connected', formatDateTime(session.createdAt)],
        ['Screen size', `${columns}×${rows}`]
      ])
    )
  );
}
