# Terminal App Template - Project Summary

## Overview

A template generator and collection of demo applications for building SSH-based terminal UIs with Node.js.

## File Structure

```
terminal_example/
├── init.sh                        # Template generator script (~1,634 lines)
├── quick-start.sh                 # Quick setup helper script
├── README.md                      # Project overview
├── COMPLETE_OVERVIEW.md           # Full project overview
├── PROJECT_SUMMARY.md             # This file -- technical details
├── USAGE_GUIDE.md                 # Tutorials and customization
├── QUICK_REFERENCE.md             # Command and API cheat sheet
├── VISUAL_DEMO.md                 # ASCII screen mockups
├── GETTING_STARTED.md             # Step-by-step setup checklist
├── TESTING_SUMMARY.md             # Test coverage details
├── INDEX.md                       # Documentation navigation
├── COMPARISON.md                  # Feature comparison across apps
├── DESIGN_PRINCIPLES.md           # Architecture decisions
│
├── demo-shop/                     # E-commerce demo app
│   ├── package.json
│   ├── .env.example
│   ├── .gitignore
│   ├── README.md
│   ├── scripts/
│   │   └── generate-keys.js       # SSH key generator
│   ├── src/
│   │   ├── server/
│   │   │   ├── index.js           # SSH server entry point
│   │   │   ├── router.js          # Screen routing
│   │   │   └── session.js         # Session management (fingerprint-based, in-memory)
│   │   ├── ui/
│   │   │   ├── components.js      # Reusable UI component library
│   │   │   ├── home.js            # Home screen
│   │   │   ├── products.js        # Product listing screen
│   │   │   ├── cart.js            # Shopping cart screen
│   │   │   └── checkout.js        # Checkout form screen
│   │   └── models/
│   │       └── product.js         # Product data model
│   └── test/
│       ├── unit/
│       │   ├── product.test.js    # Product model tests
│       │   └── session.test.js    # Session manager tests
│       ├── e2e/
│       │   ├── server.test.js     # SSH server connection tests
│       │   └── workflow.test.js   # User workflow tests
│       └── helpers/
│           └── test-utils.js      # Shared test utilities
│
├── adventure-game/                # Text adventure with LLM integration
│   ├── package.json
│   ├── .env.example
│   ├── .gitignore
│   ├── README.md
│   ├── scripts/
│   │   └── generate-keys.js       # SSH key generator
│   ├── src/
│   │   ├── server/
│   │   │   ├── index.js           # SSH server entry point
│   │   │   ├── router.js          # Screen routing
│   │   │   └── session.js         # Session management (username-based, JSON persistence)
│   │   ├── llm/
│   │   │   ├── ollama-client.js   # Ollama API client
│   │   │   └── game-engine.js     # LLM-powered game engine
│   │   ├── ui/
│   │   │   ├── components.js      # Reusable UI component library
│   │   │   ├── game.js            # Main game screen
│   │   │   ├── room.js            # Room display and interaction
│   │   │   ├── inventory.js       # Inventory screen
│   │   │   ├── help.js            # Help screen
│   │   │   ├── stats.js           # Player stats screen
│   │   │   └── loading-animation.js  # Wizard loading animation for LLM calls
│   │   ├── models/
│   │   │   └── game.js            # Game state and room data
│   │   ├── middleware/            # (placeholder)
│   │   ├── routes/                # (placeholder)
│   │   └── utils/                 # (placeholder)
│   └── test/
│       ├── unit/
│       │   ├── game.test.js           # Game model tests
│       │   ├── session.test.js        # Session manager tests
│       │   ├── llm-engine.test.js     # LLM game engine tests
│       │   └── ollama-client.test.js  # Ollama client tests
│       ├── e2e/
│       │   ├── server.test.js     # SSH server connection tests
│       │   └── workflow.test.js   # Game workflow tests
│       └── helpers/
│           └── test-utils.js      # Shared test utilities
│
├── admin-dashboard/               # System monitoring dashboard
│   ├── package.json
│   ├── .env.example
│   ├── .gitignore
│   ├── README.md
│   ├── scripts/
│   │   └── generate-keys.js       # SSH key generator
│   ├── src/
│   │   ├── server/
│   │   │   ├── index.js           # SSH server entry point
│   │   │   ├── router.js          # Screen routing
│   │   │   └── session.js         # Session management (fingerprint-based, in-memory)
│   │   ├── ui/
│   │   │   ├── components.js      # Reusable UI component library
│   │   │   ├── dashboard.js       # Main dashboard screen
│   │   │   ├── overview.js        # System overview screen
│   │   │   ├── processes.js       # Process monitor screen
│   │   │   ├── resources.js       # Resource usage screen
│   │   │   ├── logs.js            # System logs screen
│   │   │   ├── network.js         # Network info screen
│   │   │   ├── services.js        # Services screen
│   │   │   └── settings.js        # Settings screen
│   │   └── models/
│   │       └── system.js          # System data model (OS stats)
│   └── test/
│       ├── unit/
│       │   ├── system.test.js     # System model tests
│       │   └── session.test.js    # Session manager tests
│       ├── e2e/
│       │   ├── server.test.js     # SSH server connection tests
│       │   └── workflow.test.js   # Dashboard workflow tests
│       └── helpers/
│           └── test-utils.js      # Shared test utilities
│
└── animation-demo/                # Standalone terminal animation viewer
    ├── package.json
    ├── .gitignore
    ├── index.js                   # Entry point and animation runner
    └── animations.js              # Animation frame definitions
```

## Template Generator (`init.sh`)

The generator script is ~1,634 lines of bash. Running `./init.sh <app-name>` produces a complete SSH terminal app with server, UI, models, tests, configuration, and documentation.

### Usage
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

## Session Management

The project demonstrates two different session strategies:

**Fingerprint-based, in-memory (demo-shop, admin-dashboard):**
Sessions are identified by a hash of the client's SSH public key. State is held in memory and lost on server restart.

**Username-based, file-persisted (adventure-game):**
Sessions are keyed by the SSH username. Game state is saved to JSON files on disk, allowing players to disconnect and resume later by reconnecting with the same username.

## Technology Stack

| Dependency | Purpose |
|-----------|---------|
| ssh2 | SSH server implementation |
| blessed | Terminal UI framework |
| dotenv | Environment configuration |
| nanoid | ID generation |
| nodemon | Development auto-reload |

The adventure-game additionally integrates with **Ollama** for local LLM inference (no extra npm dependency; uses HTTP requests).

## Testing

Each SSH-based app includes unit and e2e tests using the Node.js built-in test runner.

```bash
npm test            # All tests
npm run test:unit   # Unit tests only
npm run test:e2e    # E2E tests only
npm run test:watch  # Watch mode
```

**demo-shop tests:** product model, session management, server connections, shopping workflow.
**adventure-game tests:** game model, session persistence, LLM engine logic, Ollama client, server connections, game workflow.
**admin-dashboard tests:** system model, session management, server connections, dashboard workflow.

## Documentation

The project includes 11 markdown files at the root level, plus a README in each app directory:

| File | Description |
|------|-------------|
| README.md | Project overview and quick start |
| COMPLETE_OVERVIEW.md | Full project overview |
| PROJECT_SUMMARY.md | File tree and technical details |
| USAGE_GUIDE.md | Tutorials, customization, API integration |
| QUICK_REFERENCE.md | Command and component cheat sheet |
| VISUAL_DEMO.md | ASCII screen mockups |
| GETTING_STARTED.md | Step-by-step setup checklist |
| TESTING_SUMMARY.md | Test coverage details |
| INDEX.md | Documentation navigation guide |
| COMPARISON.md | Feature comparison across apps |
| DESIGN_PRINCIPLES.md | Architecture and design decisions |

## Deployment

### Development
```bash
npm run dev  # Auto-reload with nodemon
```

### Production
```bash
# PM2
pm2 start src/server/index.js

# Docker
docker build -t my-terminal-app .
docker run -p 2222:2222 my-terminal-app
```

## License

MIT License
