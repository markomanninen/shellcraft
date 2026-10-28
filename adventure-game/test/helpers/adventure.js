// Test doubles for the adventure UI: an LLM narrator that never calls
// Ollama (the real LLMGameEngine with its client's chat() stubbed, so the
// prompt building and response parsing still run) and a temp session store.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { LLMGameEngine } from '../../src/llm/game-engine.js';
import { SessionManager } from '../../src/server/session.js';

export const DESCRIPTIONS = {
  'Village Square': 'Lanterns sway over the village square. A dry fountain stands at its centre, and a notice board creaks in the wind beside the inn door.',
  'Dark Forest': 'Pines close overhead and the light turns green and thin. Somewhere ahead a branch snaps under something heavy.',
  'Mysterious Cave': 'Water drips from the ceiling of the cave. Old letters cut into the rock catch the light of your torch.',
  'Peaceful Meadow': 'Wildflowers bend in a warm wind. Bees drift between the herbs at the edge of the meadow.',
  'Ancient Temple': 'Runes glow faintly along the temple walls. A stone guardian stands before the altar.',
  'Treasure Chamber': 'Gold glitters in the torchlight of the vault. The air is still and old.'
};

/** The narration a stub returns for one turn payload (what the LLM sees). */
export function narrate(payload) {
  const description = DESCRIPTIONS[payload.room?.name] ?? `You stand in ${payload.room?.name ?? 'an unknown place'}.`;
  const message = payload.deterministic_message || `The Game Master answers: ${payload.action_text}.`;
  return { description, message };
}

/**
 * An LLMGameEngine whose client never touches the network.
 * options.reply(payload) → { description, message } (default narrate)
 * options.fail: an Error to throw instead (once per entry; an array
 *   queues several outcomes: Error = fail, anything else = reply)
 * options.gate: when true, each chat() waits until release() is called,
 *   so a test can see the busy state.
 * Returns the engine with .calls (payloads), .release() and .pending().
 */
export function stubLlm({ reply = narrate, outcomes = [], gate = false } = {}) {
  const engine = new LLMGameEngine();
  const calls = [];
  const waiting = [];
  const queue = [...outcomes];
  engine.client = {
    async chat(messages) {
      const payload = JSON.parse(messages.at(-1).content);
      calls.push(payload);
      if (gate) await new Promise((resolve) => waiting.push(resolve));
      const next = queue.length > 0 ? queue.shift() : null;
      if (next instanceof Error) throw next;
      return { message: { content: JSON.stringify(next ?? reply(payload)) } };
    },
    async isAvailable() {
      return true;
    }
  };
  engine.calls = calls;
  engine.release = () => {
    while (waiting.length > 0) waiting.shift()();
  };
  engine.pending = () => waiting.length;
  return engine;
}

/**
 * A verified SSH public key as authenticate() hands it on ({ algo, data }):
 * the same name gives the same key, so the same fingerprint.
 */
export const testKey = (name) => ({ algo: 'ssh-ed25519', data: Buffer.from(`test key of ${name}`) });

/** A SessionManager on a sessions file in a fresh temp directory. */
export function tempSessions() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adventure-ui-'));
  const sessionsFile = path.join(dir, 'sessions.json');
  const manager = new SessionManager({ sessionsFile });
  return {
    dir,
    sessionsFile,
    manager,
    read: () => JSON.parse(fs.readFileSync(sessionsFile, 'utf8')),
    remove: () => fs.rmSync(dir, { recursive: true, force: true })
  };
}
