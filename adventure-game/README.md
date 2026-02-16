# Terminal Adventure

SSH-accessible terminal RPG with a deterministic simulation core and LLM narration layer.

## What Changed (Phase 1-3)

- Phase 1:
  - Structured, deterministic rules engine for actions and world state transitions.
  - Quest system with journal-backed progression.
- Phase 2:
  - Skill checks (`combat`, `lore`, `stealth`, `charisma`, `perception`).
  - Deterministic combat encounters with room-linked enemies and drops.
  - Faction reputation and persistent NPC memory/trust.
- Phase 3:
  - Pacing director (tension + beats).
  - Adaptive narrative style (`balanced`, `grim`, `heroic`, `mystic`).
  - Balancing metrics (action profile, checks, inventory peak, quest completions).
  - UI refresh: campaign snapshot panel, split-pane room HUD, categorized tactical actions, 1-9 quick actions, and animated screen transitions.

## Core Principles

- Centralized configuration:
  - `src/config/game-config.js`
  - `src/config/runtime-config.js`
- Single source of truth:
  - world rooms, quests, NPCs, systems, and runtime defaults all live in config.
- Fast fail:
  - invalid runtime config throws on startup.
  - invalid LLM JSON contract throws (no silent fallback payloads).
- LLM is narration-only:
  - game logic is resolved by deterministic code before LLM call.

## Architecture

```text
src/
├── config/
│   ├── game-config.js        # world + gameplay + systems source of truth
│   └── runtime-config.js     # env parsing/validation (fast-fail)
├── models/
│   ├── game.js               # static world read model
│   ├── game-state.js         # initial state + runtime state normalization
│   └── rules-engine.js       # deterministic action parsing + state patching
├── llm/
│   ├── ollama-client.js      # typed Ollama client using runtime config
│   └── game-engine.js        # narration-only prompt + strict JSON validation
├── ui/
│   ├── game.js               # menu
│   ├── room.js               # turn loop: resolve -> narrate -> render
│   ├── journal.js            # quests, factions, npc memory
│   ├── stats.js              # pacing + check + action metrics
│   ├── inventory.js
│   ├── help.js
│   ├── components.js
│   └── loading-animation.js
└── server/
    ├── index.js              # SSH server bootstrap (validated config)
    ├── router.js             # screen navigation
    └── session.js            # persisted session + runtime state hydration
```

## Quick Start

If your shell does not load `nvm` automatically, use the local wrapper:
```bash
./npmw --version
```

1. Install dependencies:
```bash
./npmw install
```

2. Generate SSH host keys:
```bash
./npmw run generate-keys
```

3. Create env file:
```bash
cp .env.example .env
```

4. Start server:
```bash
./npmw start
```

If a previous process is still bound to the configured SSH port, restart cleanly:
```bash
./npmw run restart
```

`npm run restart` is equivalent when `npm` is already on your PATH.

5. Connect:
```bash
ssh localhost -p 2222
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SSH_PORT` | `2222` | SSH server port |
| `SSH_HOST` | `0.0.0.0` | SSH bind host |
| `HOST_KEY_PATH` | `./keys/host_key` | SSH host key path |
| `SESSIONS_FILE_PATH` | `./data/sessions.json` | Session persistence file path |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama base URL |
| `OLLAMA_MODEL` | `qwen3-coder:30b` | Ollama model |
| `OLLAMA_TIMEOUT_MS` | `60000` | chat timeout |
| `OLLAMA_HEALTH_TIMEOUT_MS` | `3000` | health-check timeout |

## Controls

| Key | Context | Action |
|---|---|---|
| Up / Down | Menus | Navigate |
| Enter | Menus | Select |
| `1-9` | Menus + Room actions | Quick-select indexed options |
| `h` | Room | Main menu |
| `i` | Room | Inventory |
| `j` | Room | Journal |
| `r` | Error | Retry narration |
| `b` / Escape | Secondary screens | Back |
| `q` / Ctrl+C | Global (except text input) | Quit |

## Scripts

| Script | Command | Description |
|---|---|---|
| `npmw` | `./npmw <args>` | npm wrapper that auto-loads `nvm` when needed |
| `start` | `node src/server/index.js` | Start server |
| `restart` | `node scripts/restart-server.js && node src/server/index.js` | Clear configured SSH port and start server |
| `dev` | `nodemon src/server/index.js` | Auto-reload server |
| `generate-keys` | `node scripts/generate-keys.js` | Generate host keys |
| `test:unit` | `node --test test/unit/*.test.js` | Unit tests |
| `test:e2e` | `node --test test/e2e/*.test.js` | End-to-end tests |
| `test` | `./npmw run test:unit && ./npmw run test:e2e` | Full test suite |

## Development Loop

See `DEV_LOOP.md` for the incremental implementation/test process used for Phases 1-3.
