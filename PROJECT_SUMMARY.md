# Project Summary

The technical layout of the repository: which file does what. For what the
project is and how to start, see [README.md](README.md). All documents are
listed in [INDEX.md](INDEX.md).

## Repository

```
shellcraft/
├── init.sh                    # app generator (bash; macOS and Linux)
├── quick-start.sh             # menu: run a demo, run tests, create an app
├── ui/                        # @shellcraft/ui, shared by every app
├── demo-shop/                 # e-commerce demo (reference app)
├── adventure-game/            # text RPG with an LLM
├── admin-dashboard/           # system monitoring dashboard
├── animation-demo/            # ASCII animations in the local terminal
├── scripts/                   # maintenance scripts (CI failures, dependabot PRs)
├── .github/                   # CI (tests, CodeQL, dependency scan), templates
└── *.md                       # documentation
```

## ui/ (@shellcraft/ui)

Plain ESM JavaScript, no build step. Ink and React are peer dependencies:
each app provides them, so there is one React.

```
ui/
├── src/
│   ├── index.js               # everything apps import (also Ink's Box, Text, useInput, useApp)
│   ├── theme.js               # the only place colors are named; textProps(), borderProps()
│   ├── color.js               # pins Ink's chalk to the 16 ANSI colors
│   ├── ssh.js                 # serve(): an Ink app on an ssh2 channel
│   ├── local.js               # renderLocal(): full screen in the local terminal
│   ├── fullscreen.js          # alternate screen, resize, exit (shared by both)
│   ├── size.js                # useTerminalSize(), useScreenSize()
│   ├── hooks.js               # useInterval()
│   ├── selection.js, text.js  # list selection and scrolling, text wrapping
│   ├── testing.js             # @shellcraft/ui/testing: renderTerminal(), styleAt(), fake SSH channel, fake TTY
│   └── components/            # Screen, TitleBar, StatusBar, KeyHint, Message, Panel, SelectList,
│                              # Table, TextField, Button, Meter, EmptyState, ScrollView
├── test/                      # components, screen, scroll, ssh, local
├── scripts/contrast.mjs       # WCAG contrast of the muted color in common terminal themes
└── README.md                  # components, theme, serve(), test helpers
```

## demo-shop/ (the reference app)

The other SSH apps and every generated app follow this structure.

```
demo-shop/
├── package.json               # "@shellcraft/ui": "file:../ui", ink, react, ssh2, dotenv, nanoid
├── .npmrc                     # install-links=true: npm copies ui/ into node_modules
├── npmw                       # npm wrapper that loads nvm if needed
├── .env.example
├── scripts/
│   ├── generate-keys.js       # SSH host key (keys/host_key)
│   └── with-node.sh           # used by npmw
├── src/
│   ├── server/
│   │   ├── index.js           # ssh2 server: authentication, sessions, pty and shell requests
│   │   ├── router.js          # serve(stream, ptyInfo, h(ShopApp, { session }), { session })
│   │   └── session.js         # SessionManager (fingerprint, cart, in memory)
│   ├── ui/
│   │   ├── app.js             # ShopApp: current screen, status message, ctx
│   │   ├── home.js            # menu + cart summary
│   │   ├── products.js        # products table
│   │   ├── cart.js            # cart table with total
│   │   ├── checkout.js        # form and validation
│   │   └── cart-summary.js    # cart helpers and the summary block
│   └── models/
│       └── product.js
├── test/
│   ├── unit/                  # product, session, screens, ssh-adapter
│   ├── e2e/                   # server (real SSH), workflow
│   └── helpers/test-utils.js
└── test-ssh-minimal.js        # manual check: a bare ssh2 server without Ink
```

## The Other Apps

| App | Specific parts | Details |
|---|---|---|
| adventure-game | `src/config/` (game world and runtime settings), `src/llm/` (Ollama client, game engine), `src/models/`, sessions saved in `data/sessions.json` | [adventure-game/README.md](adventure-game/README.md) |
| admin-dashboard | `src/models/system.js` (OS stats, process list), one screen per view in `src/ui/` | [admin-dashboard/README.md](admin-dashboard/README.md) |
| animation-demo | `index.js` (starts `renderLocal()`), `animations.js` (frames); no server | [animation-demo/README.md](animation-demo/README.md) |

## Generated Apps

`./init.sh <name> [minimal|ecommerce]` writes the demo-shop structure, plus:

- `vendor/ui/`: a copy of `ui/src`, `README.md`, `package.json` (without
  devDependencies) and the license. The app depends on
  `"@shellcraft/ui": "file:./vendor/ui"`, so it does not need this repository.
- `src/config.js`: the app name for the title bar, from the directory name.
- `src/server/auth.js`: lets a client in with a verified key (its
  fingerprint goes on the session) or anonymously through
  keyboard-interactive; rejects the `none` method.
- `test/helpers/server.js`: starts the server on a free port with a
  throwaway host key for the e2e tests.

| Type | Screens |
|---|---|
| `minimal` | Home (menu + detail), Getting started (scrolling text), Session (table) |
| `ecommerce` | Home, Products, Cart, Checkout: the demo-shop screens |

## Sessions

Two strategies:

- **Fingerprint, in memory** (demo-shop, admin-dashboard, generated apps):
  the session is identified by a hash of the client's SSH public key, or
  `anonymous`. It ends with the connection.
- **User name, on disk** (adventure-game): the session is keyed by the SSH
  user name and saved to JSON, so a player can reconnect and continue.

## Dependencies

| Dependency | Purpose |
|-----------|---------|
| ink, react | the UI (through `@shellcraft/ui`) |
| ssh2 | SSH server |
| dotenv | settings from `.env` |
| nanoid | session ids |
| nodemon (dev) | restart on changes |
| @xterm/headless, ink-testing-library (ui, dev) | ui tests |

adventure-game also calls Ollama over HTTP (no npm dependency).

## License

MIT License
