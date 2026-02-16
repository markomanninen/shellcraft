# Feature Comparison

Side-by-side comparison of all four demo applications.

## Overview

| Feature | Demo Shop | Adventure Game | Admin Dashboard | Animation Demo |
|---------|-----------|----------------|-----------------|----------------|
| SSH server | Yes | Yes | Yes | No |
| Default port | 2222 | 2222 | 2222 | N/A |
| Authentication | None (demo) | None (username as session key) | None (demo) | N/A |
| Session storage | In-memory | JSON file on disk | In-memory | None |
| Session identity | SSH key fingerprint | SSH username | SSH key fingerprint | N/A |
| Persists across restart | No | Yes | No | N/A |
| LLM integration | No | Yes (Ollama) | No | No |

## Screens

| Screen Type | Demo Shop | Adventure Game | Admin Dashboard | Animation Demo |
|-------------|-----------|----------------|-----------------|----------------|
| Main menu | Home | Game menu | Dashboard | Animation viewer |
| Data display | Products | Room description | Overview, Resources, Network, Services | N/A |
| Interactive | Cart, Checkout | Room actions, Free-text input | Process monitor, Logs | Animation switching |
| Info / Help | -- | Help, Stats, Inventory | Settings | -- |
| Loading | -- | Wizard animation (LLM) | -- | -- |

## Technology

| Component | Demo Shop | Adventure Game | Admin Dashboard | Animation Demo |
|-----------|-----------|----------------|-----------------|----------------|
| ssh2 | Yes | Yes | Yes | No |
| blessed | Yes | Yes | Yes | Yes |
| dotenv | Yes | Yes | Yes | No |
| nanoid | Yes | Yes | Yes | No |
| nodemon (dev) | Yes | Yes | Yes | No |
| Ollama (external) | No | Optional | No | No |

## Session Management

| Aspect | Demo Shop | Adventure Game | Admin Dashboard |
|--------|-----------|----------------|-----------------|
| Identity key | MD5 of SSH public key | SSH username | MD5 of SSH public key |
| Storage | In-memory Map | `data/sessions.json` | In-memory Map |
| Resume on reconnect | No (new session) | Yes (same username) | No (new session) |
| Expiration | None | None | None |
| Data stored | Cart contents | Game state, inventory, LLM history | -- |

## Testing

| Aspect | Demo Shop | Adventure Game | Admin Dashboard | Animation Demo |
|--------|-----------|----------------|-----------------|----------------|
| Unit tests | Yes | Yes | Yes | No |
| E2E tests | Yes | Yes | Yes | No |
| Test runner | Node.js built-in | Node.js built-in | Node.js built-in | N/A |
| Watch mode | Yes | Yes | Yes | N/A |

## npm Scripts

| Script | Demo Shop | Adventure Game | Admin Dashboard | Animation Demo |
|--------|-----------|----------------|-----------------|----------------|
| `start` | Yes | Yes | Yes | Yes |
| `dev` | Yes | Yes | Yes | No |
| `generate-keys` | Yes | Yes | Yes | No |
| `restart` | No | Yes | No | No |
| `test` | Yes | Yes | Yes | No |
| `test:unit` | Yes | Yes | Yes | No |
| `test:e2e` | Yes | Yes | Yes | No |
| `test:watch` | Yes | Yes | Yes | No |

## Use Cases

- **Demo Shop** -- E-commerce patterns: product catalog, shopping cart, checkout form, session-based state
- **Adventure Game** -- LLM integration, file-based persistence, async loading screens, free-text input
- **Admin Dashboard** -- Real-time system monitoring, OS data collection, multi-screen navigation
- **Animation Demo** -- Terminal rendering techniques, frame-based ASCII animation
