import { OllamaClient } from './ollama-client.js';
import { GameModel } from '../models/game.js';

const MAX_HISTORY_MESSAGES = 40;

export class LLMGameEngine {
  constructor() {
    this.client = new OllamaClient();
    this.gameModel = new GameModel();
  }

  buildSystemPrompt() {
    const worldSeed = this.gameModel.getWorldSeedText();

    return `You are the Game Master for a fantasy text adventure game.

WORLD SEED (reference locations, you may expand beyond these):
${worldSeed}

RULES:
1. Respond ONLY with valid JSON matching this schema:
{
  "room_name": "string - current location name",
  "description": "string - scene description, 2-4 SHORT sentences, max 200 chars",
  "items_here": ["visible items in this location"],
  "actions": ["exactly 4-6 possible actions"],
  "inventory_update": {"add": ["items gained"], "remove": ["items lost"]},
  "game_over": false,
  "message": "string or null - feedback about the last action"
}

2. Keep descriptions CONCISE. The display is a small terminal (80x24 chars).
3. Always provide exactly 4-6 actions. Include movement, interaction, and investigation options.
4. The last action should be a way to retreat or go back.
5. INVENTORY IS CRITICAL: When the player takes, picks up, or receives an item, you MUST add it to inventory_update.add. When they use, drop, or lose an item, you MUST add it to inventory_update.remove. Never forget inventory changes.
6. Create a coherent, connected world. Remember previous events.
7. If a locked door exists, it stays locked until the player finds a key.
8. Never break character. Never include text outside the JSON.
9. When the player reaches the treasure with enough items, set game_over to true and give a victory description.
10. The player may type free-form text instead of choosing an action. Interpret their intent and respond appropriately.`;
  }

  async startGame() {
    const systemMessage = { role: 'system', content: this.buildSystemPrompt() };
    const userMessage = {
      role: 'user',
      content: 'I begin my adventure. I am standing in the village square. Describe what I see and give me my options.'
    };

    const messages = [systemMessage, userMessage];
    const result = await this.client.chat(messages);
    const parsed = this.parseResponse(result.message.content);

    const fullHistory = [
      ...messages,
      { role: 'assistant', content: result.message.content }
    ];

    return { response: parsed, messages: fullHistory };
  }

  async processAction(action, messageHistory, currentInventory) {
    const userMessage = {
      role: 'user',
      content: `My inventory: [${currentInventory.join(', ')}]. I choose: "${action}". Remember to update inventory_update if items change.`
    };

    const trimmedHistory = this.trimHistory(messageHistory);
    trimmedHistory.push(userMessage);

    const result = await this.client.chat(trimmedHistory);
    const parsed = this.parseResponse(result.message.content);

    trimmedHistory.push({ role: 'assistant', content: result.message.content });

    return { response: parsed, messages: trimmedHistory };
  }

  parseResponse(content) {
    try {
      const parsed = JSON.parse(content);
      return {
        room_name: parsed.room_name || 'Unknown Location',
        description: parsed.description || 'You look around but cannot make sense of your surroundings.',
        items_here: Array.isArray(parsed.items_here) ? parsed.items_here : [],
        actions: Array.isArray(parsed.actions) && parsed.actions.length > 0
          ? parsed.actions
          : ['Look around', 'Wait', 'Go back'],
        inventory_update: {
          add: Array.isArray(parsed.inventory_update?.add) ? parsed.inventory_update.add : [],
          remove: Array.isArray(parsed.inventory_update?.remove) ? parsed.inventory_update.remove : []
        },
        game_over: !!parsed.game_over,
        message: parsed.message || null
      };
    } catch {
      return {
        room_name: 'Mysterious Place',
        description: 'The world shimmers and reforms around you...',
        items_here: [],
        actions: ['Look around', 'Try to focus', 'Go back the way you came'],
        inventory_update: { add: [], remove: [] },
        game_over: false,
        message: '(The game master lost focus. Try again.)'
      };
    }
  }

  trimHistory(messages) {
    if (messages.length <= MAX_HISTORY_MESSAGES + 1) {
      return [...messages];
    }
    const systemPrompt = messages[0];
    const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES);
    return [systemPrompt, ...recentMessages];
  }

  async isAvailable() {
    return this.client.isAvailable();
  }
}
