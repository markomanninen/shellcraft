import dotenv from 'dotenv';
import { GAME_CONFIG } from './game-config.js';

dotenv.config();

function parseInteger(name, raw, { min, max }) {
  const value = Number.parseInt(String(raw), 10);
  if (!Number.isInteger(value)) {
    throw new Error(`[config] ${name} must be an integer, got "${raw}"`);
  }
  if (value < min || value > max) {
    throw new Error(`[config] ${name} must be between ${min} and ${max}, got ${value}`);
  }
  return value;
}

function parseUrl(name, raw) {
  try {
    const parsed = new URL(raw);
    return parsed.toString().replace(/\/$/, '');
  } catch {
    throw new Error(`[config] ${name} must be a valid URL, got "${raw}"`);
  }
}

function parseString(name, raw) {
  const value = String(raw ?? '').trim();
  if (!value) {
    throw new Error(`[config] ${name} must not be empty`);
  }
  return value;
}

export function loadRuntimeConfig(env = process.env) {
  const config = {
    app: {
      name: env.APP_NAME?.trim() || GAME_CONFIG.app.name,
      nodeEnv: env.NODE_ENV?.trim() || 'development'
    },
    server: {
      host: env.SSH_HOST?.trim() || GAME_CONFIG.runtime.ssh.host,
      port: parseInteger(
        'SSH_PORT',
        env.SSH_PORT ?? GAME_CONFIG.runtime.ssh.port,
        { min: 1, max: 65535 }
      ),
      hostKeyPath: parseString(
        'HOST_KEY_PATH',
        env.HOST_KEY_PATH ?? GAME_CONFIG.runtime.ssh.hostKeyPath
      )
    },
    storage: {
      sessionsFile: parseString(
        'SESSIONS_FILE_PATH',
        env.SESSIONS_FILE_PATH ?? GAME_CONFIG.runtime.storage.sessionsFile
      )
    },
    llm: {
      baseUrl: parseUrl(
        'OLLAMA_BASE_URL',
        env.OLLAMA_BASE_URL ?? GAME_CONFIG.runtime.llm.baseUrl
      ),
      model: parseString(
        'OLLAMA_MODEL',
        env.OLLAMA_MODEL ?? GAME_CONFIG.runtime.llm.model
      ),
      timeoutMs: parseInteger(
        'OLLAMA_TIMEOUT_MS',
        env.OLLAMA_TIMEOUT_MS ?? GAME_CONFIG.runtime.llm.timeoutMs,
        { min: 1000, max: 300000 }
      ),
      healthTimeoutMs: parseInteger(
        'OLLAMA_HEALTH_TIMEOUT_MS',
        env.OLLAMA_HEALTH_TIMEOUT_MS ?? GAME_CONFIG.runtime.llm.healthTimeoutMs,
        { min: 500, max: 30000 }
      )
    }
  };

  return Object.freeze(config);
}

export const runtimeConfig = loadRuntimeConfig();
