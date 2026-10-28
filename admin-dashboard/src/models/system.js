import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const LOG_LEVELS = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
const LOG_MESSAGES = [
  'User authentication successful',
  'Database connection established',
  'API request received',
  'Cache cleared',
  'Background job completed',
  'Email sent successfully',
  'File upload completed',
  'Session created'
];

const pad2 = (n) => String(n).padStart(2, '0');

/** HH:MM:SS (24 h, local time), so log lines line up. */
export const clockTime = (date) =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;

/**
 * System data for the dashboard. One instance per SSH session: CPU usage is
 * measured between two calls (see getCPUUsage), so each session keeps its
 * own previous sample.
 */
export class SystemModel {
  constructor() {
    this.previousCpuTimes = null;
    this.previousCpuPercents = [];
  }

  getSystemInfo() {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: this.formatBytes(os.totalmem()),
      freeMemory: this.formatBytes(os.freemem()),
      uptime: this.formatUptime(os.uptime()),
      loadAvg: os.loadavg().map(l => l.toFixed(2))
    };
  }

  /**
   * Per-core CPU usage. The first call measures since boot; later calls
   * measure the time since the previous call, so a screen that refreshes
   * every few seconds shows the current load, not the average since boot.
   * `usage` is a string ("41.0%"), `percent` the same as a number.
   */
  getCPUUsage() {
    const cpus = os.cpus();
    const times = cpus.map((cpu) => ({
      total: Object.values(cpu.times).reduce((a, b) => a + b, 0),
      idle: cpu.times.idle
    }));
    const previous = this.previousCpuTimes;
    const percents = times.map((now, i) => {
      const before = previous?.[i];
      if (before && now.total <= before.total) {
        // No time passed for this core since the last sample: keep its value.
        return this.previousCpuPercents[i] ?? 0;
      }
      const total = now.total - (before?.total ?? 0);
      const idle = now.idle - (before?.idle ?? 0);
      return total > 0 ? Math.min(Math.max(((total - idle) / total) * 100, 0), 100) : 0;
    });
    this.previousCpuTimes = times;
    this.previousCpuPercents = percents;

    return cpus.map((cpu, i) => ({
      core: i,
      model: cpu.model,
      usage: `${percents[i].toFixed(1)}%`,
      percent: percents[i]
    }));
  }

  /** Average usage of all cores in percent (a number), see getCPUUsage(). */
  getCPUPercent() {
    const cores = this.getCPUUsage();
    if (cores.length === 0) return 0;
    return cores.reduce((sum, core) => sum + core.percent, 0) / cores.length;
  }

  getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usedPercent = total > 0 ? (used / total) * 100 : 0;

    return {
      total: this.formatBytes(total),
      used: this.formatBytes(used),
      free: this.formatBytes(free),
      percent: `${usedPercent.toFixed(1)}%`,
      usedPercent
    };
  }

  getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const result = [];
    for (const [name, addrs] of Object.entries(interfaces)) {
      for (const addr of addrs) {
        result.push({
          interface: name,
          address: addr.address,
          family: addr.family,
          netmask: addr.netmask,
          internal: addr.internal ? 'Yes' : 'No'
        });
      }
    }
    return result;
  }

  async getServices() {
    try {
      if (os.platform() === 'darwin') {
        const { stdout } = await execAsync('launchctl list | head -n 20');
        return stdout;
      } else if (os.platform() === 'linux') {
        const { stdout } = await execAsync('systemctl list-units --type=service --state=running --no-pager | head -n 20');
        return stdout;
      }
      return 'Service listing not available on this platform';
    } catch (error) {
      return 'Error fetching services';
    }
  }

  async getProcesses() {
    try {
      if (os.platform() === 'darwin' || os.platform() === 'linux') {
        const { stdout } = await execAsync('ps aux | head -n 10');
        return stdout;
      }
      return 'Process listing not available on this platform';
    } catch (error) {
      return 'Error fetching processes';
    }
  }

  /** Server environment shown on the Settings screen. */
  getEnvironment() {
    return {
      node: process.version,
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      home: os.homedir(),
      tmp: os.tmpdir(),
      shell: process.env.SHELL || 'N/A',
      term: process.env.TERM || 'N/A',
      sshPort: process.env.SSH_PORT || '2222'
    };
  }

  /** One simulated log entry at `date`. */
  createMockLog(date = new Date()) {
    const level = LOG_LEVELS[Math.floor(Math.random() * LOG_LEVELS.length)];
    const message = LOG_MESSAGES[Math.floor(Math.random() * LOG_MESSAGES.length)];
    return { timestamp: clockTime(date), level, message };
  }

  /** `count` simulated log entries from the last hour, oldest first. */
  getMockLogs(count = 20) {
    const now = Date.now();
    return Array.from({ length: count }, () => now - Math.random() * 3600000)
      .sort((a, b) => a - b)
      .map((time) => this.createMockLog(new Date(time)));
  }

  formatBytes(bytes) {
    const gb = bytes / (1024 ** 3);
    return `${gb.toFixed(2)} GB`;
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  }
}
