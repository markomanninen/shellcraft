# Complete Overview

shellcraft has four parts. This page says what each part is for and what you
can learn from it. To get started, read [README.md](README.md). For the file
layout, see [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md). All documents are
listed in [INDEX.md](INDEX.md).

## 1. The ui Package

[`ui/`](ui/README.md) is `@shellcraft/ui`: Ink components, the theme, the SSH
adapter `serve()`, `renderLocal()` for the local terminal, and test helpers.
Every app uses it, so every app looks and behaves the same.

You can learn:

- how to run an Ink app over SSH (size, CRLF, colors, resize, cleanup)
- how to keep colors readable on any terminal theme (16 ANSI colors, dim for muted text)
- how to test a terminal UI: render on a fake terminal, press keys, check rows and styles

## 2. The Generator

`init.sh` creates a new SSH app that uses Ink through a copy of the ui
package (`vendor/ui`):

```bash
./init.sh my-app            # minimal: menu, scrolling text, session table
./init.sh my-app ecommerce  # products, cart, checkout form
```

The new app comes with unit, screen, SSH adapter and e2e tests, and it does
not need this repository.

## 3. The Demo Apps

### Demo Shop (`demo-shop/`)

- multi-screen flow: menu, table, cart, form
- form editing and validation, errors under fields and in the status bar
- per-session state (the cart) with fingerprint-based sessions in memory
- the reference structure for the other apps and for the generator

### Adventure Game (`adventure-game/`)

- LLM integration: an Ollama client and a game engine that only narrates
- deterministic game rules, quests, combat and skill checks in config
- waiting states: a loading animation while the LLM answers
- sessions keyed by SSH user name and saved to disk, so players can resume

### Admin Dashboard (`admin-dashboard/`)

- live data from the host OS: CPU, memory, processes, logs, network, services
- periodic refresh that stops when the user leaves
- meters, tables and many screens with one navigation pattern

### Animation Demo (`animation-demo/`)

- frame-based ASCII animation
- a full-screen Ink app in the local terminal with `renderLocal()`, no SSH

## 4. The Tests

- unit tests for models, sessions and game logic
- screen tests with `renderTerminal()` at 80×24 and 100×30
- SSH adapter tests with a fake channel
- e2e tests against the real server with an ssh2 client

Details: [TESTING_SUMMARY.md](TESTING_SUMMARY.md).

## Use Cases Shown

- **E-commerce**: product tables, carts, checkout forms
- **Games**: rooms, inventory, LLM narration, saved sessions
- **System administration**: live monitoring, process lists, logs
- **Animation**: loading screens and visual effects in the terminal
