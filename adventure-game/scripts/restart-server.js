import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { runtimeConfig } from '../src/config/runtime-config.js';

function listPortPids(port) {
  try {
    const output = execFileSync('lsof', ['-ti', `tcp:${port}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();

    if (!output) {
      return [];
    }

    return output
      .split('\n')
      .map((pid) => pid.trim())
      .filter(Boolean);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error('[restart] Missing required command: lsof');
    }
    if (error?.status === 1) {
      return [];
    }
    throw new Error(`[restart] Failed to inspect port ${port}: ${error.message}`);
  }
}

function signalPids(pids, signal) {
  for (const pid of pids) {
    try {
      process.kill(Number(pid), signal);
    } catch (error) {
      if (error.code !== 'ESRCH') {
        throw error;
      }
    }
  }
}

function clearPort(port) {
  const initialPids = listPortPids(port);
  if (initialPids.length === 0) {
    console.log(`[restart] No process bound to port ${port}`);
    return;
  }

  signalPids(initialPids, 'SIGTERM');
  const lingeringPids = listPortPids(port);
  if (lingeringPids.length > 0) {
    signalPids(lingeringPids, 'SIGKILL');
  }

  const remainingPids = listPortPids(port);
  if (remainingPids.length > 0) {
    throw new Error(
      `[restart] Could not free port ${port}; still in use by pid(s): ${remainingPids.join(', ')}`
    );
  }

  console.log(`[restart] Cleared port ${port}`);
}

clearPort(runtimeConfig.server.port);
