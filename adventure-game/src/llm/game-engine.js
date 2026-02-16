import { OllamaClient } from './ollama-client.js';
import { GameModel } from '../models/game.js';
import { GAME_CONFIG } from '../config/game-config.js';

export class LLMResponseValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LLMResponseValidationError';
  }
}

export class LLMGameEngine {
  constructor() {
    this.client = new OllamaClient();
    this.gameModel = new GameModel();
  }

  buildSystemPrompt() {
    const worldSeed = this.gameModel.getWorldSeedText();

    return `You are the narrative director for a fantasy text adventure game.

WORLD SEED (fixed locations):
${worldSeed}

RULES:
1. Respond ONLY with valid JSON matching this schema:
{
  "description": "string - 2 to 4 concise sentences",
  "message": "string - one-line feedback for the chosen action"
}

2. Do not invent game logic; rules resolution is deterministic and already provided.
3. Tone must match director_style and current_beat in the turn payload.
4. Never include text outside JSON.`;
  }

  async narrateTurn(turnResult, messageHistory) {
    const preparedHistory = this.prepareHistory(messageHistory);
    const userMessage = {
      role: 'user',
      content: JSON.stringify({
        turn: turnResult.turn,
        phase: turnResult.phase,
        room: turnResult.room,
        items_here: turnResult.itemsHere,
        action_type: turnResult.action.type,
        action_text: turnResult.action.raw,
        outcome: turnResult.outcome.status,
        deterministic_message: turnResult.outcome.message,
        available_actions: turnResult.actions,
        player: turnResult.player,
        active_encounter: turnResult.activeEncounter,
        director_style: turnResult.director.style,
        current_beat: turnResult.director.lastBeat,
        tension: turnResult.director.tension,
        game_over: turnResult.gameOver
      })
    };

    preparedHistory.push(userMessage);

    const result = await this.client.chat(preparedHistory);
    const parsed = this.parseNarrationResponse(result.message.content);

    preparedHistory.push({ role: 'assistant', content: result.message.content });

    return { response: parsed, messages: preparedHistory };
  }

  parseNarrationResponse(content) {
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new LLMResponseValidationError('[llm] Model response was not valid JSON');
    }

    for (const key of GAME_CONFIG.llm.requiredNarrationKeys) {
      if (!(key in parsed)) {
        throw new LLMResponseValidationError(`[llm] Missing required response key "${key}"`);
      }
    }

    if (typeof parsed.description !== 'string' || !parsed.description.trim()) {
      throw new LLMResponseValidationError('[llm] "description" must be a non-empty string');
    }

    if (parsed.description.length > GAME_CONFIG.llm.descriptionMaxChars) {
      throw new LLMResponseValidationError(
        `[llm] "description" exceeds ${GAME_CONFIG.llm.descriptionMaxChars} chars`
      );
    }

    if (typeof parsed.message !== 'string' || !parsed.message.trim()) {
      throw new LLMResponseValidationError('[llm] "message" must be a non-empty string');
    }

    return {
      description: parsed.description.trim(),
      message: parsed.message.trim()
    };
  }

  prepareHistory(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return [{ role: 'system', content: this.buildSystemPrompt() }];
    }

    if (messages[0].role !== 'system') {
      throw new Error('[llm] Message history must start with a system prompt');
    }

    return this.trimHistory(messages);
  }

  trimHistory(messages) {
    if (messages.length <= GAME_CONFIG.llm.maxHistoryMessages + 1) {
      return [...messages];
    }
    const systemPrompt = messages[0];
    const recentMessages = messages.slice(-GAME_CONFIG.llm.maxHistoryMessages);
    return [systemPrompt, ...recentMessages];
  }

  async isAvailable() {
    return this.client.isAvailable();
  }
}
