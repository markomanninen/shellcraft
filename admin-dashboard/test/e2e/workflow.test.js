import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { SystemModel } from '../../src/models/system.js';
import { SessionManager } from '../../src/server/session.js';

describe('Admin Dashboard Workflow', () => {
  it('should complete admin workflow', () => {
    // 1. Create session
    const sessionManager = new SessionManager();
    const session = sessionManager.createSession(null);
    assert.ok(session, 'Session should be created');

    // 2. Get system info
    const systemModel = new SystemModel();
    const info = systemModel.getSystemInfo();
    assert.ok(info, 'Should get system info');
    assert.ok(info.hostname, 'Should have hostname');
    assert.ok(info.platform, 'Should have platform');

    // 3. Get CPU usage
    const cpuUsage = systemModel.getCPUUsage();
    assert.ok(cpuUsage.length > 0, 'Should have CPU data');

    // 4. Get memory usage
    const memUsage = systemModel.getMemoryUsage();
    assert.ok(memUsage.total, 'Should have memory data');
    assert.ok(memUsage.percent, 'Should have usage percent');
  });

  it('should handle multiple concurrent admin sessions', () => {
    const sessionManager = new SessionManager();
    
    // Create multiple sessions
    const session1 = sessionManager.createSession(null);
    const session2 = sessionManager.createSession(null);
    
    // Sessions should be independent
    assert.notStrictEqual(session1.id, session2.id, 'Sessions should have different IDs');
    
    // Verify sessions are tracked
    assert.ok(sessionManager.getSession(session1.id), 'Session 1 should be retrievable');
    assert.ok(sessionManager.getSession(session2.id), 'Session 2 should be retrievable');
  });
});
