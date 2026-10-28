import React from 'react';
import { Box, Panel, Meter, ScrollView, METER_WIDTH, useTerminalSize, BlankRow, InfoRow, infoRows, useData } from '@shellcraft/ui';
import { AdminScreen, meterTone, screenHints, useScreenKeys, SUMMARY_LABEL_WIDTH, LABEL_WIDTH } from './parts.js';

const h = React.createElement;

const METER_GAP = 4;

export function resourcesData(system) {
  const cores = system.getCPUUsage();
  const cpu = cores.length ? cores.reduce((sum, c) => sum + c.percent, 0) / cores.length : 0;
  return { cores, cpu, memory: system.getMemoryUsage() };
}

/** "Apple M2 Pro" or, for mixed cores, the distinct models joined. */
const cpuModels = (cores) => [...new Set(cores.map((c) => String(c.model ?? '').trim()))].filter(Boolean).join(', ') || 'unknown';

const coreMeter = (core) =>
  h(Meter, { key: `core-${core.core}`, label: `Core ${core.core}`, value: core.percent, tone: meterTone(core.percent) });

/** Per-core meters, `perRow` side by side, one element per row. */
function coreMeterRows(cores, perRow) {
  const rows = [];
  for (let i = 0; i < cores.length; i += perRow) {
    rows.push(
      h(
        Box,
        { key: `cores-${i}`, height: 1, flexShrink: 0 },
        ...cores.slice(i, i + perRow).map((core, j) =>
          h(Box, { key: `c${core.core}`, marginLeft: j === 0 ? 0 : METER_GAP, flexShrink: 0 }, coreMeter(core))
        )
      )
    );
  }
  return rows;
}

/** Home detail panel for "CPU & memory": totals, then one meter per core. */
export function ResourcesSummary({ ctx }) {
  const { data } = useData(() => resourcesData(ctx.system), { interval: ctx.refreshMs });
  const { cores, cpu, memory } = data;
  return h(
    Box,
    { flexDirection: 'column', flexGrow: 1 },
    ...infoRows([
      ['Model', cpuModels(cores)],
      ['Cores', String(cores.length)],
      ['Memory', `${memory.used} of ${memory.total}`]
    ], SUMMARY_LABEL_WIDTH),
    h(BlankRow),
    h(Meter, { label: 'CPU', value: cpu, tone: meterTone(cpu) }),
    h(Meter, { label: 'Memory', value: memory.usedPercent, tone: meterTone(memory.usedPercent) }),
    h(BlankRow),
    h(ScrollView, { rows: coreMeterRows(cores, 1), isActive: false })
  );
}

/**
 * CPU & memory: overall and per-core meters (as many side by side as fit),
 * memory totals. Refreshes every 2 s; scrolls when there are more cores
 * than rows.
 */
export function ResourcesScreen({ ctx }) {
  const { data, refresh } = useData(() => resourcesData(ctx.system), { interval: ctx.refreshMs });
  useScreenKeys(ctx, refresh);
  const { columns, rows } = useTerminalSize();
  const { cores, cpu, memory } = data;

  // Panel: two borders and one cell of padding on each side.
  const width = Math.max(columns - 4, 1);
  // Title bar, panel top and bottom, padding, status bar.
  const height = Math.max(rows - 6, 1);
  const perRow = Math.max(Math.floor((width + METER_GAP) / (METER_WIDTH + METER_GAP)), 1);

  const content = [
    h(InfoRow, { key: 'model', label: 'Model', value: cpuModels(cores), labelWidth: LABEL_WIDTH }),
    h(InfoRow, { key: 'cores', label: 'Cores', value: String(cores.length), labelWidth: LABEL_WIDTH }),
    h(BlankRow, { key: 'b1' }),
    h(Meter, { key: 'cpu', label: 'CPU', value: cpu, tone: meterTone(cpu) }),
    ...coreMeterRows(cores, perRow),
    h(BlankRow, { key: 'b2' }),
    h(Meter, { key: 'memory', label: 'Memory', value: memory.usedPercent, tone: meterTone(memory.usedPercent) }),
    h(InfoRow, { key: 'total', label: 'Total', value: memory.total, labelWidth: LABEL_WIDTH }),
    h(InfoRow, { key: 'used', label: 'Used', value: memory.used, labelWidth: LABEL_WIDTH }),
    h(InfoRow, { key: 'free', label: 'Free', value: memory.free, labelWidth: LABEL_WIDTH })
  ];

  return h(
    AdminScreen,
    { ctx, screen: 'CPU & memory', hints: screenHints({ scroll: content.length > height, refresh: true }) },
    h(
      Panel,
      { title: 'CPU & memory', focused: true },
      h(ScrollView, { rows: content, height, width })
    )
  );
}
