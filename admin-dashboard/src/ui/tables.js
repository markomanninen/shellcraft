// The model returns command output as text (`ps aux`, `launchctl list`,
// `systemctl list-units`). These functions turn it into table columns and
// rows; null when the text is not that output (e.g. "Error fetching
// processes"), so the screen can show the text as an error instead.

const lines = (text) => String(text ?? '').split(/\r?\n/);

/** RSS in KB (as ps prints it) → "512K", "123.4M", "1.2G". */
export function formatKB(value) {
  const kb = Number(value);
  if (!Number.isFinite(kb) || String(value).trim() === '') return String(value ?? '');
  if (kb < 1024) return `${kb}K`;
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)}M`;
  return `${(kb / 1024 / 1024).toFixed(1)}G`;
}

/**
 * A command line with its leading executable path cut to the file name:
 * "/usr/sbin/sshd -D" → "sshd -D". The path ends at the first space that
 * is followed by an option or another path, so paths with spaces (macOS
 * app bundles) are kept whole.
 */
export function shortCommand(command) {
  const text = String(command ?? '').trim();
  if (!text.startsWith('/')) return text;
  const executable = text.match(/^.*?(?=\s[-/]|$)/)[0];
  return executable.slice(executable.lastIndexOf('/') + 1) + text.slice(executable.length);
}

export const PROCESS_COLUMNS = [
  { label: 'PID', width: 7, align: 'right' },
  { label: 'User', width: 10 },
  { label: 'CPU %', width: 5, align: 'right' },
  { label: 'Mem %', width: 5, align: 'right' },
  { label: 'RSS', width: 7, align: 'right' },
  { label: 'Time', width: 9, align: 'right' },
  { label: 'Command', width: 20, grow: true }
];

/**
 * `ps aux` output (Linux or macOS) → [{ user, pid, cpu, mem, rss, time,
 * command }], or null when the text has no ps header. COMMAND is the last
 * column and keeps its spaces.
 */
export function parseProcesses(text) {
  const all = lines(text).filter((line) => line.trim() !== '');
  if (all.length === 0) return null;
  const header = all[0].trim().split(/\s+/);
  if (header.at(-1) !== 'COMMAND' || !header.includes('PID')) return null;
  const before = header.length - 1;
  const row = new RegExp(`^\\s*${'(\\S+)\\s+'.repeat(before)}(.*)$`);
  const at = (fields, name) => {
    const i = header.indexOf(name);
    return i >= 0 ? fields[i] : '';
  };
  return all.slice(1).flatMap((line) => {
    const match = line.match(row);
    if (!match) return [];
    const fields = match.slice(1);
    return [{
      user: at(fields, 'USER'),
      pid: at(fields, 'PID'),
      cpu: at(fields, '%CPU'),
      mem: at(fields, '%MEM'),
      rss: at(fields, 'RSS'),
      time: at(fields, 'TIME'),
      command: fields[before].trim()
    }];
  });
}

export const processRows = (processes) =>
  processes.map((p) => [p.pid, p.user, p.cpu, p.mem, formatKB(p.rss), p.time, p.command]);

const LAUNCHD_COLUMNS = [
  { label: 'PID', width: 7, align: 'right' },
  { label: 'Status', width: 6, align: 'right' },
  { label: 'Label', width: 30, grow: true }
];

const SYSTEMD_COLUMNS = [
  { label: 'Unit', width: 30 },
  { label: 'Load', width: 6 },
  { label: 'Active', width: 6 },
  { label: 'Sub', width: 7 },
  { label: 'Description', width: 16, grow: true }
];

/** Rows after the header up to the first blank line (systemctl's legend follows it). */
function body(all, headerIndex) {
  const rows = [];
  for (const line of all.slice(headerIndex + 1)) {
    if (line.trim() === '') break;
    rows.push(line);
  }
  return rows;
}

/**
 * `launchctl list` (macOS) or `systemctl list-units` (Linux) output →
 * { manager, columns, rows, names }, or null for anything else.
 * names: the service labels / unit names, for the summary.
 */
export function parseServices(text) {
  const all = lines(text);
  const headerIndex = all.findIndex((line) => line.trim() !== '');
  if (headerIndex < 0) return null;
  const header = all[headerIndex].trim();

  if (/^PID\s+Status\s+Label$/.test(header)) {
    const rows = body(all, headerIndex).flatMap((line) => {
      const match = line.trim().match(/^(\S+)\s+(\S+)\s+(.+)$/);
      return match ? [[match[1], match[2], match[3].trim()]] : [];
    });
    return { manager: 'launchd', columns: LAUNCHD_COLUMNS, rows, names: rows.map((r) => r[2]) };
  }

  if (/^UNIT\s+LOAD\s+ACTIVE\s+SUB\s+DESCRIPTION/.test(header)) {
    const rows = body(all, headerIndex).flatMap((line) => {
      // Failed units are marked with ● (or * without UTF-8).
      const match = line.trim().replace(/^[●*]\s*/, '').match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*(.*)$/);
      return match ? [[match[1], match[2], match[3], match[4], match[5].trim()]] : [];
    });
    return { manager: 'systemd', columns: SYSTEMD_COLUMNS, rows, names: rows.map((r) => r[0]) };
  }

  return null;
}

export const NETWORK_COLUMNS = [
  { label: 'Interface', width: 10 },
  { label: 'Address', width: 26, grow: true },
  { label: 'Family', width: 6 },
  { label: 'Netmask', width: 15 },
  { label: 'Internal', width: 8 }
];

/**
 * Netmask as shown: IPv4 as is ("255.255.255.0"), IPv6 as its prefix
 * length ("/64"), since the full IPv6 mask is 39 characters.
 */
export function netmaskLabel(family, netmask) {
  const mask = String(netmask ?? '');
  const v6 = family === 'IPv6' || family === 6 || mask.includes(':');
  if (!v6) return mask;
  let bits = 0;
  for (const group of mask.split(':')) {
    if (group === '') continue;
    let value = parseInt(group, 16);
    if (Number.isNaN(value)) return mask;
    while (value & 0x8000) {
      bits++;
      value = (value << 1) & 0xffff;
    }
    if (value !== 0) return mask; // not a prefix mask
  }
  return `/${bits}`;
}

export const networkRows = (interfaces) =>
  interfaces.map((i) => [i.interface, i.address, String(i.family), netmaskLabel(i.family, i.netmask), i.internal]);
