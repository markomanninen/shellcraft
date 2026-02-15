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

  it('should format bytes correctly', () => {
    const model = new SystemModel();
    // Test the formatBytes method
    const result = model.formatBytes(1024 * 1024 * 1024);
    assert.ok(result.includes('GB'), 'Should format as GB');
  });
});
