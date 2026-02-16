import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { loadRuntimeConfig } from '../../src/config/runtime-config.js';

describe('runtime config', () => {
  it('loads valid environment values', () => {
    const config = loadRuntimeConfig({
      SSH_PORT: '2222',
      SSH_HOST: '127.0.0.1',
      HOST_KEY_PATH: './keys/host_key',
      SESSIONS_FILE_PATH: './data/test-sessions.json',
      OLLAMA_BASE_URL: 'http://localhost:11434',
      OLLAMA_MODEL: 'qwen3-coder:30b',
      OLLAMA_TIMEOUT_MS: '5000',
      OLLAMA_HEALTH_TIMEOUT_MS: '1500'
    });

    assert.strictEqual(config.server.port, 2222);
    assert.strictEqual(config.storage.sessionsFile, './data/test-sessions.json');
    assert.strictEqual(config.llm.timeoutMs, 5000);
    assert.strictEqual(config.llm.healthTimeoutMs, 1500);
  });

  it('fails fast on invalid numeric values', () => {
    assert.throws(
      () => loadRuntimeConfig({ SSH_PORT: 'invalid', HOST_KEY_PATH: './keys/host_key' }),
      /SSH_PORT must be an integer/
    );
  });

  it('fails fast on invalid URL', () => {
    assert.throws(
      () => loadRuntimeConfig({ OLLAMA_BASE_URL: 'not-a-url', HOST_KEY_PATH: './keys/host_key' }),
      /OLLAMA_BASE_URL must be a valid URL/
    );
  });
});
