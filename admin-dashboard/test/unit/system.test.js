import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { SystemModel } from '../../src/models/system.js';

describe('SystemModel', () => {
  it('should return system info', () => {
    const model = new SystemModel();
    const info = model.getSystemInfo();
    assert.ok(info.hostname, 'Should have hostname');
    assert.ok(info.platform, 'Should have platform');
    assert.ok(info.arch, 'Should have architecture');
    assert.ok(info.cpus > 0, 'Should have CPU count');
    assert.ok(info.totalMemory, 'Should have total memory');
    assert.ok(info.freeMemory, 'Should have free memory');
  });

  it('should return CPU usage', () => {
    const model = new SystemModel();
    const cpuUsage = model.getCPUUsage();
    assert.ok(Array.isArray(cpuUsage), 'Should return array');
    assert.ok(cpuUsage.length > 0, 'Should have CPU data');
    cpuUsage.forEach(cpu => {
      assert.ok(typeof cpu.core === 'number', 'Should have core number');
      assert.ok(cpu.model, 'Should have model');
      assert.ok(cpu.usage, 'Should have usage');
    });
  });

  it('should return memory usage', () => {
    const model = new SystemModel();
    const mem = model.getMemoryUsage();
    assert.ok(mem.total, 'Should have total');
    assert.ok(mem.used, 'Should have used');
    assert.ok(mem.free, 'Should have free');
    assert.ok(mem.percent, 'Should have percent');
  });

  it('should measure CPU usage between samples', () => {
    const model = new SystemModel();
    const first = model.getCPUUsage();
    const second = model.getCPUUsage();
    assert.equal(second.length, first.length);
    for (const core of second) {
      assert.ok(core.percent >= 0 && core.percent <= 100, `core ${core.core}: ${core.percent}`);
      assert.equal(core.usage, `${core.percent.toFixed(1)}%`);
    }
    const average = model.getCPUPercent();
    assert.ok(average >= 0 && average <= 100);
  });

  it('should report memory use as a number too', () => {
    const mem = new SystemModel().getMemoryUsage();
    assert.ok(mem.usedPercent > 0 && mem.usedPercent <= 100);
    assert.equal(mem.percent, `${mem.usedPercent.toFixed(1)}%`);
  });

  it('should return the server environment', () => {
    const env = new SystemModel().getEnvironment();
    assert.equal(env.node, process.version);
    for (const key of ['platform', 'release', 'arch', 'home', 'tmp', 'shell', 'term', 'sshPort']) {
      assert.ok(env[key], `environment has ${key}`);
    }
  });

  it('should return simulated logs with fixed-width times', () => {
    const logs = new SystemModel().getMockLogs();
    assert.equal(logs.length, 20);
    for (const log of logs) {
      assert.match(log.timestamp, /^\d\d:\d\d:\d\d$/);
      assert.ok(['INFO', 'WARN', 'ERROR', 'DEBUG'].includes(log.level));
      assert.ok(log.message);
    }
    const entry = new SystemModel().createMockLog(new Date(2026, 0, 1, 7, 5, 9));
    assert.equal(entry.timestamp, '07:05:09');
  });

  it('should format bytes correctly', () => {
    const model = new SystemModel();
    // Test the formatBytes method
    const result = model.formatBytes(1024 * 1024 * 1024);
    assert.ok(result.includes('GB'), 'Should format as GB');
  });
});
