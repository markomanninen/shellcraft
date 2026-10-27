# Feature Comparison

The four demo apps side by side. All four build their screens with Ink
through [`@shellcraft/ui`](ui/README.md) and follow the same
[design rules](DESIGN_PRINCIPLES.md).

## Overview

| Feature | Demo Shop | Adventure Game | Admin Dashboard | Animation Demo |
|---------|-----------|----------------|-----------------|----------------|
| Runs over | SSH | SSH | SSH | local terminal |
| Started by | `serve()` | `serve()` | `serve()` | `renderLocal()` |
| Default port | 2222 | 2222 | 2222 | N/A |
| Authentication | none (demo) | none (user name is the session key) | none (demo) | N/A |
| Session storage | in memory | JSON file on disk | in memory | none |
| Session identity | SSH key fingerprint | SSH user name | SSH key fingerprint | N/A |
| Survives a restart | no | yes | no | N/A |
| LLM integration | no | yes (Ollama) | no | no |

## Screens

| Screen type | Demo Shop | Adventure Game | Admin Dashboard | Animation Demo |
|-------------|-----------|----------------|-----------------|----------------|
| Main menu | Home (menu + cart) | game menu | dashboard menu | animation list |
| Data display | Products table | room description | overview, resources, network, services | the animation |
| Interactive | Cart, Checkout form | room actions, free-text input | processes, logs | switch, speed, pause |
| Info | -- | help, stats, inventory | settings | -- |
| Waiting | -- | loading animation (LLM) | -- | -- |

## Technology

| Component | Demo Shop | Adventure Game | Admin Dashboard | Animation Demo |
|-----------|-----------|----------------|-----------------|----------------|
| `@shellcraft/ui` (Ink 8, React 19) | yes | yes | yes | yes |
| ssh2 | yes | yes | yes | no |
| dotenv | yes | yes | yes | no |
| nanoid | yes | yes | yes | no |
| nodemon (dev) | yes | yes | yes | no |
| Ollama (external service) | no | optional | no | no |

Each app depends on `"@shellcraft/ui": "file:../ui"` and has
`install-links=true` in `.npmrc`.

## Session Management

| Aspect | Demo Shop | Adventure Game | Admin Dashboard |
|--------|-----------|----------------|-----------------|
| Identity key | MD5 of the SSH public key | SSH user name | MD5 of the SSH public key |
| Storage | in-memory Map | `data/sessions.json` | in-memory Map |
| Resume on reconnect | no (new session) | yes (same user name) | no (new session) |
| Expiration | none | none | none |
| Data stored | cart, checkout fields, orders | game state, inventory, LLM history | -- |

Apps made by `init.sh` store a SHA256 fingerprint in OpenSSH format
(`SHA256:...`) and the SSH user name.

## Testing

| Aspect | Demo Shop | Adventure Game | Admin Dashboard | Animation Demo |
|--------|-----------|----------------|-----------------|----------------|
| Unit tests | yes | yes | yes | yes |
| Screen tests (`@shellcraft/ui/testing`) | yes | yes | yes | yes |
| E2E tests over SSH | yes | yes | yes | N/A (no SSH) |
| Test runner | `node:test` | `node:test` | `node:test` | `node:test` |

Note: animation-demo has no SSH server. Its screen tests use
`renderTerminal()`, and `test/local.test.js` runs the app through
`renderLocal()` on a fake TTY (`createFakeTty()`) into a headless xterm.

## npm Scripts

| Script | Demo Shop | Adventure Game | Admin Dashboard | Animation Demo |
|--------|-----------|----------------|-----------------|----------------|
| `start` | yes | yes | yes | yes |
| `dev` | yes | yes | yes | no |
| `generate-keys` | yes | yes | yes | no |
| `restart` | no | yes | no | no |
| `test` | yes | yes | yes | yes |
| `test:unit` | yes | yes | yes | no |
| `test:e2e` | yes | yes | yes | no |
| `test:watch` | yes | yes | yes | no |

## Use Cases

- **Demo Shop**: e-commerce patterns: product table, cart, checkout form, session state
- **Adventure Game**: LLM integration, file-based persistence, waiting states, free-text input
- **Admin Dashboard**: live system monitoring, OS data, many screens
- **Animation Demo**: frame-based ASCII animation in the local terminal
