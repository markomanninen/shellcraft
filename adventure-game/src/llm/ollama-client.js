import { GAME_CONFIG } from '../config/game-config.js';
import { runtimeConfig } from '../config/runtime-config.js';

export class OllamaClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl ?? runtimeConfig.llm.baseUrl;
    this.model = options.model ?? runtimeConfig.llm.model;
    this.timeoutMs = options.timeoutMs ?? runtimeConfig.llm.timeoutMs;
    this.healthTimeoutMs = options.healthTimeoutMs ?? runtimeConfig.llm.healthTimeoutMs;
  }

  async chat(messages, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          format: 'json',
          think: false,
          options: {
            temperature: options.temperature ?? GAME_CONFIG.llm.chatOptions.temperature,
            num_predict: options.maxTokens ?? GAME_CONFIG.llm.chatOptions.maxTokens
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ollama HTTP ${response.status}: ${text}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async isAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(this.healthTimeoutMs)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
