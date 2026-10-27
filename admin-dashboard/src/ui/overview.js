import React from 'react';
import { Box, Panel, Meter, BlankRow, infoRows, useData } from '@shellcraft/ui';
import { AdminScreen, meterTone, screenHints, useScreenKeys, SUMMARY_LABEL_WIDTH, LABEL_WIDTH } from './parts.js';

const h = React.createElement;

/** Everything the overview shows, sampled at once. */
export function overviewData(system) {
  return {
    info: system.getSystemInfo(),
    memory: system.getMemoryUsage(),
    cpu: system.getCPUPercent()
  };
}

/** The CPU and memory meters (tone warning ≥ 75 %, danger ≥ 90 %). */
export function UsageMeters({ cpu, memory }) {
  return h(
    Box,
    { flexDirection: 'column', flexShrink: 0 },
    h(Meter, { label: 'CPU', value: cpu, tone: meterTone(cpu) }),
    h(Meter, { label: 'Memory', value: memory.usedPercent, tone: meterTone(memory.usedPercent) })
  );
}

/** Home detail panel for "System overview" (the Figma Menu + detail template). */
export function OverviewSummary({ ctx }) {
  const { data } = useData(() => overviewData(ctx.system), { interval: ctx.refreshMs });
  const { info, memory, cpu } = data;
  return h(
    Box,
    { flexDirection: 'column' },
    ...infoRows([
      ['Hostname', info.hostname],
      ['Platform', `${info.platform} ${info.arch}`],
      ['CPUs', `${info.cpus} cores`],
      ['Uptime', info.uptime],
      ['Load', info.loadAvg.join('  ')]
    ], SUMMARY_LABEL_WIDTH),
    h(BlankRow),
    h(UsageMeters, { cpu, memory })
  );
}

/** System overview: host, uptime, load and memory; refreshes every 2 s. */
export function OverviewScreen({ ctx }) {
  const { data, refresh } = useData(() => overviewData(ctx.system), { interval: ctx.refreshMs });
  useScreenKeys(ctx, refresh);
  const { info, memory, cpu } = data;

  return h(
    AdminScreen,
    { ctx, screen: 'System overview', hints: screenHints({ refresh: true }) },
    h(
      Panel,
      { title: 'System overview', focused: true },
      ...infoRows([
        ['Hostname', info.hostname],
        ['Platform', info.platform],
        ['Architecture', info.arch],
        ['CPUs', `${info.cpus} cores`],
        ['Uptime', info.uptime],
        null,
        ['Load 1 min', info.loadAvg[0]],
        ['Load 5 min', info.loadAvg[1]],
        ['Load 15 min', info.loadAvg[2]],
        null,
        ['Total memory', memory.total],
        ['Used memory', memory.used],
        ['Free memory', memory.free]
      ], LABEL_WIDTH),
      h(BlankRow),
      h(UsageMeters, { cpu, memory })
    )
  );
}
