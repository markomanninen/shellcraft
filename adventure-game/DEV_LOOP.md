# Adventure Game Dev Loop

This project now follows a strict incremental loop:

1. Change one subsystem.
2. Add or update targeted unit tests for that subsystem.
3. Run targeted tests.
4. Run full unit suite.
5. Run e2e suite.
6. Commit only when all gates pass.

## Engineering Rules

- Centralized configuration only:
  - `src/config/game-config.js`
  - `src/config/runtime-config.js`
- Single source of truth:
  - world/quests/npcs/skills are defined in `game-config.js`
  - runtime env parsing/validation is defined in `runtime-config.js`
- Fast fail:
  - invalid runtime config throws immediately
  - invalid LLM JSON schema throws immediately
- No hardcoded fallback behavior:
  - deterministic rules own state transitions
  - LLM is narration-only and cannot silently patch logic

## Incremental Test Gates

### Gate A: Config

Files:
- `src/config/game-config.js`
- `src/config/runtime-config.js`

Tests:
- `test/unit/runtime-config.test.js`

Command:
```bash
./npmw exec -- node --test test/unit/runtime-config.test.js
```

### Gate B: Deterministic Rules Engine (Phase 1-3 core)

Files:
- `src/models/game-state.js`
- `src/models/rules-engine.js`

Tests:
- `test/unit/game.test.js`
- `test/unit/rules-engine.test.js`

Command:
```bash
./npmw exec -- node --test test/unit/game.test.js test/unit/rules-engine.test.js
```

### Gate C: LLM Narration Contract

Files:
- `src/llm/game-engine.js`
- `src/llm/ollama-client.js`

Tests:
- `test/unit/llm-engine.test.js`
- `test/unit/ollama-client.test.js`

Command:
```bash
./npmw exec -- node --test test/unit/llm-engine.test.js test/unit/ollama-client.test.js
```

### Gate D: Full Regression

Commands:
```bash
./npmw run test:unit
./npmw run test:e2e
```

## Runtime Loop

1. Start server:
```bash
./npmw run dev
```

2. Connect over SSH:
```bash
ssh localhost -p 2222
```

3. Verify in UI:
- start game
- complete `prove_worth` (talk to Village Elder)
- defeat `temple_guardian`, then recover `amulet`
- defeat `treasure_sentinel`, then claim treasure
- inspect `Journal` and `Game Stats` for faction/NPC/director changes
