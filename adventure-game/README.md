# Terminal Adventure

An SSH-accessible text adventure game powered by an LLM Game Master. Connect via any SSH client, explore a fantasy world with AI-generated scenes, or play offline with a static 6-room map. Game progress is saved per SSH username and survives server restarts.

## Features

- **LLM-Powered Game Master** -- Ollama generates room descriptions, actions, and inventory changes in structured JSON. The static game world (6 rooms) seeds the system prompt, but the LLM can expand beyond it.
- **Static Fallback** -- Works without Ollama. Six hardcoded rooms (Village Square, Dark Forest, Mysterious Cave, Peaceful Meadow, Ancient Temple, Treasure Chamber) with directional movement and item pickup.
- **Session Persistence** -- Game state saved to `data/sessions.json`, keyed by SSH username. Reconnecting resumes exactly where you left off.
- **Resume Support** -- "Continue Adventure" re-renders the last LLM response without making a new API call.
- **Free-Text Input** -- "Ask the Game Master..." lets you type any action. The LLM interprets your intent and responds.
- **Animated Loading** -- A wizard ASCII animation plays while waiting for the LLM to respond.
- **Error Recovery** -- If Ollama is unreachable, a connection error screen offers retry (`r`), offline/static mode (`f`), or return to menu (`h`).
- **Open Authentication** -- Accepts any SSH connection without password or key verification. The SSH `username` is used as the session key.

## Architecture

```
src/
├── server/
│   ├── index.js              # SSH server entry point (accepts any auth, captures username)
│   ├── router.js             # Screen navigation with full cleanup between transitions
│   └── session.js            # Username-based sessions with JSON file persistence
├── ui/
│   ├── components.js         # Reusable blessed UI components (box, list, table, form, input, button, message)
│   ├── game.js               # Main menu (Start New / Continue Adventure, Inventory, Stats, Help, Exit)
│   ├── room.js               # Room display, LLM integration, static fallback, error handling
│   ├── inventory.js          # Inventory screen (table of collected items)
│   ├── help.js               # Help screen (controls, gameplay tips)
│   ├── stats.js              # Game statistics (LLM mode: turns, items, exchanges; static mode: rooms, completion %)
│   └── loading-animation.js  # Wizard ASCII art animation frames (4 frames, 500ms interval)
├── models/
│   └── game.js               # Static game world definition (6 rooms with exits and items, world seed text)
└── llm/
    ├── ollama-client.js      # Ollama API wrapper (chat, health check, configurable timeout)
    └── game-engine.js        # System prompt builder, message history management, JSON response parsing
```

## Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Generate SSH host keys:**

   ```bash
   npm run generate-keys
   ```

3. **Create environment file:**

   ```bash
   cp .env.example .env
   ```

4. **Start the server:**

   ```bash
   npm start
   ```

5. **Connect via SSH:**

   ```bash
   ssh localhost -p 2222
   ```

   The username you connect with becomes your session key. Reconnecting with the same username resumes your game.

### With Ollama (Recommended)

If you have [Ollama](https://ollama.com) running locally with a model pulled, the game uses it as the Game Master. The default model is `qwen3-coder:30b`. To use a different model, set `OLLAMA_MODEL` in your `.env` file.

### Without Ollama

The game works without Ollama. If the LLM is unreachable on first turn, you will see a connection error screen where you can press `f` to switch to offline mode with the static 6-room map.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SSH_PORT` | `2222` | Port the SSH server listens on |
| `HOST_KEY_PATH` | `./keys/host_key` | Path to the SSH host key file |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `qwen3-coder:30b` | Model name for Ollama chat completions |

## npm Scripts

| Script | Command | Description |
|---|---|---|
| `start` | `node src/server/index.js` | Start the SSH server |
| `restart` | kills port 2222, then starts | Kill any existing process on port 2222 and start fresh |
| `dev` | `nodemon src/server/index.js` | Start with auto-reload on file changes |
| `generate-keys` | `node scripts/generate-keys.js` | Generate SSH host key pair into `./keys/` |
| `test` | `test:unit && test:e2e` | Run all tests |
| `test:unit` | `node --test test/unit/**/*.test.js` | Run unit tests |
| `test:e2e` | `node --test test/e2e/**/*.test.js` | Run end-to-end tests |
| `test:watch` | `node --test --watch` | Run tests in watch mode |

## Session Data

Sessions are stored in `data/sessions.json`. Each entry contains:

```
id              - Unique session identifier (nanoid)
username        - SSH login name (session key)
createdAt       - Session creation timestamp
lastConnected   - Last connection timestamp
gameState       - Game progress (null until a game is started):
  currentRoom     - Current room ID (e.g., "start")
  inventory       - Array of collected item names
  visitedRooms    - Set of visited room IDs
  moves           - Number of turns taken
  messageHistory  - Full LLM conversation history (system + user + assistant messages)
  llmEnabled      - Whether LLM mode is active (false = static fallback)
  isFirstTurn     - Whether the next LLM call should be the opening scene
  lastResponse    - Cached last LLM response (used for resume without re-calling)
```

Sessions with no `gameState` (never started a game) are not persisted to disk.

## Controls

| Key | Context | Action |
|---|---|---|
| Up / Down | Menus | Navigate options |
| Enter | Menus | Select option |
| `h` | Room screen | Return to main menu |
| `i` | Room screen | Open inventory |
| `b` / Escape | Inventory, Stats, Help | Go back |
| `r` | Error screen | Retry LLM connection |
| `f` | Error screen | Switch to offline/static mode |
| `q` / Ctrl+C | Anywhere (except text input) | Quit |

## LLM Integration

The Game Master prompt instructs the LLM to respond with structured JSON:

```json
{
  "room_name": "Current location name",
  "description": "Scene description (2-4 short sentences, max 200 chars)",
  "items_here": ["visible items"],
  "actions": ["4-6 possible actions"],
  "inventory_update": { "add": ["gained items"], "remove": ["lost items"] },
  "game_over": false,
  "message": "Feedback about the last action"
}
```

Key behaviors:

- The system prompt includes the static world definition as a seed, but the LLM may expand beyond it.
- Message history is trimmed to the last 40 messages (plus the system prompt) to stay within context limits.
- If JSON parsing fails, a graceful fallback response is returned ("The game master lost focus. Try again.").
- The Ollama client enforces a 60-second timeout per request.
- Requests use `format: "json"` and `think: false` for direct structured output.

## Static Game World

Used as the LLM seed and as the offline fallback map:

| Room | ID | Items | Exits |
|---|---|---|---|
| Village Square | `start` | torch, map | north, east, south |
| Dark Forest | `forest` | sword, shield | south, east |
| Mysterious Cave | `cave` | potion | west, north |
| Peaceful Meadow | `meadow` | flower, herbs | north |
| Ancient Temple | `temple` | amulet | west |
| Treasure Chamber | `treasure` | gold, crown, jewels | south |

## Dependencies

- **ssh2** -- SSH server implementation
- **blessed** -- Terminal UI framework
- **dotenv** -- Environment variable loading
- **nanoid** -- Session ID generation
- **nodemon** (dev) -- File watcher for auto-reload

## License

MIT
