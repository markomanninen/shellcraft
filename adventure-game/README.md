# Terminal Adventure

SSH-accessible terminal RPG with a deterministic simulation core and LLM narration layer.

<p align="center">
  <img src="../docs/images/adventure-game.svg" alt="adventure-game: start, the Game Master is thinking, a narrated turn, an action and a free-text question" width="748">
</p>

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
- Ink port:
  - The UI moved from blessed to Ink (React for the terminal) through the shared [`@shellcraft/ui`](../ui/README.md) package, following the Figma templates (Menu + detail, Split, Empty).
  - Waiting for the LLM is a spinner in the status bar ("The Game Master is thinking"), not a separate loading screen; results and errors are status bar messages, never boxes over the screen.

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
├── ui/                       # Ink components (@shellcraft/ui)
│   ├── app.js                # AdventureApp: screens, status message, turn runner
│   ├── turn.js               # turn loop helpers: resolve -> narrate -> response, story
│   ├── game.js               # menu + campaign snapshot
│   ├── room.js               # room (Split template): story, status, actions, journal
│   ├── map-view.js           # regional map
│   ├── journal.js            # quests, factions, npc memory, turn log
│   ├── stats.js              # pacing + check + action metrics
│   ├── inventory.js
│   ├── help.js
│   └── components.js         # shared rows, empty state, journal log
└── server/
    ├── index.js              # SSH server bootstrap (validated config)
    ├── router.js             # hands each SSH shell to the Ink app (serve())
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

The game is saved for the SSH key you sign in with: connect with the same
key to continue, under any login name. Without a key (keyboard-interactive,
no prompts) you can play, but the game is not saved; the title bar says
`not saved`. Saves from before key sign-in stay in the sessions file but
cannot be resumed.

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
| Up / Down | Menus, lists | Navigate (or scroll journal, stats, help) |
| Enter | Menus, room actions | Select |
| `1-9` | Menu | Jump to an item |
| `1-9` | Room | Take that action at once |
| Tab (or `/`) | Room | Ask the Game Master in your own words; Tab, Esc or Enter go back |
| PgUp / PgDn | Room | Scroll the story |
| `h` | Room, secondary screens | Main menu |
| `i` | Room | Inventory |
| `j` | Room | Journal |
| `m` | Room | Map in place of the status panels |
| `r` | Room, after a failed narration | Retry narration |
| `b` / Escape | Secondary screens | Back (to the room or the menu) |
| `q` | Global (except while typing) | Quit |
| Ctrl+C | Global | Quit |

The keys of each screen are shown in its status bar. After changing `../ui`,
refresh the copy in `node_modules` with `./npmw ci` (`.npmrc` sets
`install-links=true`, so there is one React).

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
