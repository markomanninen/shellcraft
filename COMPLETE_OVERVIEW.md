# Complete Project Overview

A template system for building SSH-based terminal applications, with **4 demo applications** and a comprehensive test suite.

---

## What This Project Contains

### 1. Template Generator (`init.sh`)

A single bash script (~1,634 lines) that generates a complete terminal app with:
- SSH server (ssh2)
- Terminal UI (blessed)
- Session management
- Screen navigation and routing
- Reusable UI component library
- Test suite (unit + e2e)
- Configuration and documentation

### 2. Demo Applications

#### Demo Shop (`/demo-shop/`)
E-commerce terminal app with product catalog, shopping cart, checkout form, and session-based shopping.

```bash
cd demo-shop && npm install && npm run generate-keys && npm start
# Then: ssh localhost -p 2222
```

#### Adventure Game (`/adventure-game/`)
Text-based dungeon crawler with LLM integration via Ollama. Features include:
- 6 interconnected rooms with item collection
- LLM-powered game engine for dynamic narrative responses
- Wizard loading animation during LLM calls
- Username-based session persistence (JSON files on disk)
- Resume support -- reconnecting SSH users continue where they left off

```bash
cd adventure-game && npm install && npm run generate-keys && npm start
# Then: ssh localhost -p 2222
```

#### Admin Dashboard (`/admin-dashboard/`)
Real-time system monitoring dashboard showing CPU, memory, process list, system logs, network info, and services. Reads live data from the host OS.

```bash
cd admin-dashboard && npm install && npm run generate-keys && npm start
# Then: ssh localhost -p 2222
```

#### Animation Demo (`/animation-demo/`)
Standalone blessed terminal animation viewer. Displays various ASCII art animations directly in the terminal without an SSH server.

```bash
cd animation-demo && npm install && node index.js
```

### 3. Testing Infrastructure

Each SSH-based app (demo-shop, adventure-game, admin-dashboard) includes:

```
test/
  unit/           # Unit tests (models, sessions, LLM engine)
  e2e/            # End-to-end tests (SSH connections, workflows)
  helpers/        # Shared test utilities
```

```bash
npm test            # Run all tests
npm run test:unit   # Unit tests only
npm run test:e2e    # E2E tests only
npm run test:watch  # Watch mode
```

Tests cover: data models, session creation and isolation, SSH server connections, user workflows, LLM engine logic, and cart/inventory operations.

### 4. Documentation

| File | Description |
|------|-------------|
| [README.md](README.md) | Project overview and quick start |
| [COMPLETE_OVERVIEW.md](COMPLETE_OVERVIEW.md) | This file -- full project summary |
| [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) | File tree and technical details |
| [USAGE_GUIDE.md](USAGE_GUIDE.md) | Tutorials and customization guide |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | Command and API cheat sheet |
| [VISUAL_DEMO.md](VISUAL_DEMO.md) | ASCII mockups of all screens |
| [GETTING_STARTED.md](GETTING_STARTED.md) | Step-by-step setup checklist |
| [TESTING_SUMMARY.md](TESTING_SUMMARY.md) | Test coverage details |
| [INDEX.md](INDEX.md) | Documentation navigation guide |
| [COMPARISON.md](COMPARISON.md) | Feature comparison across apps |
| [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md) | Architecture and design decisions |

Each app also has its own `README.md`.

---

## Quick Start

### Generate a new app from the template
```bash
chmod +x init.sh
./init.sh my-app-name
cd my-app-name
npm install
npm run generate-keys
npm test
npm start
# In another terminal: ssh localhost -p 2222
```

### Try an existing demo
```bash
cd demo-shop && npm i && npm run generate-keys && npm test && npm start
```

---

## What You Can Learn

### From Demo Shop
- E-commerce workflows in a terminal UI
- Session-based shopping cart management
- Form handling and input validation
- Fingerprint-based in-memory session management

### From Adventure Game
- LLM integration patterns (Ollama client, game engine)
- Async loading screens (wizard animation during API calls)
- File-based session persistence (JSON on disk)
- SSH username-based authentication and session resumption
- Stateful game logic with room navigation and inventory

### From Admin Dashboard
- Real-time system monitoring with OS integration
- Data refreshing and live updates
- Fingerprint-based in-memory session management
- Multi-screen dashboard layout

### From Animation Demo
- Blessed terminal rendering without SSH
- Frame-based animation techniques in the terminal

### From the Test Suites
- Unit testing patterns for Node.js models
- E2E testing of SSH server connections
- Test isolation and session management testing
- Mocking strategies for LLM and OS calls

---

## Technology Stack

- **ssh2** -- SSH server implementation
- **blessed** -- Terminal UI framework
- **dotenv** -- Environment configuration
- **nanoid** -- ID generation
- **nodemon** -- Development auto-reload
- **Ollama** -- Local LLM integration (adventure-game)
- **Node.js built-in test runner** -- Unit and e2e tests

---

## Use Cases Demonstrated

- **E-commerce**: Product catalogs, shopping carts, checkout flows
- **Gaming**: Room navigation, inventory, LLM-driven narrative, session persistence
- **System Administration**: Real-time monitoring, process lists, log viewing
- **Animation**: Terminal-based visual effects and ASCII art

---

## Documentation Index

- **[README.md](README.md)** -- Start here
- **[GETTING_STARTED.md](GETTING_STARTED.md)** -- Step-by-step setup
- **[USAGE_GUIDE.md](USAGE_GUIDE.md)** -- Customization and tutorials
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** -- Cheat sheet
- **[TESTING_SUMMARY.md](TESTING_SUMMARY.md)** -- Test coverage
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** -- Technical file tree
- **[VISUAL_DEMO.md](VISUAL_DEMO.md)** -- Screen mockups
