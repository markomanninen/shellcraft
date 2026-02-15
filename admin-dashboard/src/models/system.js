import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SystemModel {
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

  getCPUUsage() {
    const cpus = os.cpus();
    return cpus.map((cpu, i) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b);
      const idle = cpu.times.idle;
      const usage = ((total - idle) / total * 100).toFixed(1);
      return {
        core: i,
        model: cpu.model,
        usage: `${usage}%`
      };
    });
  }

  getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usagePercent = (used / total * 100).toFixed(1);

    return {
      total: this.formatBytes(total),
      used: this.formatBytes(used),
      free: this.formatBytes(free),
      percent: `${usagePercent}%`
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

  getMockLogs() {
    const levels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
    const messages = [
      'User authentication successful',
      'Database connection established',
      'API request received',
      'Cache cleared',
      'Background job completed',
      'Email sent successfully',
      'File upload completed',
      'Session created'
    ];

    const logs = [];
    for (let i = 0; i < 20; i++) {
      const level = levels[Math.floor(Math.random() * levels.length)];
      const message = messages[Math.floor(Math.random() * messages.length)];
      const timestamp = new Date(Date.now() - Math.random() * 3600000).toLocaleTimeString();
      logs.push({ timestamp, level, message });
    }
    return logs;
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
