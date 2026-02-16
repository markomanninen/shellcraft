import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { OllamaClient } from '../../src/llm/ollama-client.js';
import { runtimeConfig } from '../../src/config/runtime-config.js';

describe('OllamaClient', () => {
  describe('configuration', () => {
    it('should use default configuration', () => {
      const client = new OllamaClient();
      assert.strictEqual(client.baseUrl, runtimeConfig.llm.baseUrl);
      assert.strictEqual(client.model, runtimeConfig.llm.model);
      assert.strictEqual(client.timeoutMs, runtimeConfig.llm.timeoutMs);
      assert.strictEqual(client.healthTimeoutMs, runtimeConfig.llm.healthTimeoutMs);
    });

    it('should accept custom configuration via constructor', () => {
      const client = new OllamaClient({
        baseUrl: 'http://custom:8080',
        model: 'llama3:8b',
        timeoutMs: 30000
      });
      assert.strictEqual(client.baseUrl, 'http://custom:8080');
      assert.strictEqual(client.model, 'llama3:8b');
      assert.strictEqual(client.timeoutMs, 30000);
    });

    it('should fall back to defaults for partial config', () => {
      const client = new OllamaClient({ model: 'custom-model' });
      assert.strictEqual(client.baseUrl, runtimeConfig.llm.baseUrl);
      assert.strictEqual(client.model, 'custom-model');
      assert.strictEqual(client.timeoutMs, runtimeConfig.llm.timeoutMs);
    });
  });

  describe('isAvailable', () => {
    it('should return false when server is unreachable', async () => {
      const client = new OllamaClient({ baseUrl: 'http://localhost:99999' });
      const available = await client.isAvailable();
      assert.strictEqual(available, false);
    });
  });

  describe('chat', () => {
    it('should throw on unreachable server', async () => {
      const client = new OllamaClient({
        baseUrl: 'http://localhost:99999',
        timeoutMs: 2000
      });

      await assert.rejects(
        () => client.chat([{ role: 'user', content: 'hello' }]),
        (err) => {
          assert.ok(err instanceof Error);
          return true;
        }
      );
    });
  });
});
