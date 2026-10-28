# Quick Reference

A cheat sheet. Explanations are in [USAGE_GUIDE.md](USAGE_GUIDE.md); all
component props are in [ui/README.md](ui/README.md).

## Commands

```bash
# New app (Node 22+)
./init.sh my-app              # minimal (default)
./init.sh my-app ecommerce    # products, cart, checkout
cd my-app && npm install && npm test && npm run generate-keys && npm start

# Demo apps in this repo: use ./npmw (loads nvm if npm is not on PATH)
cd demo-shop && ./npmw install && ./npmw run generate-keys && ./npmw start

# Connect
ssh localhost -p 2222
```

## Files

```
src/config.js          APP_NAME (generated apps)
src/server/index.js    SSH server: authentication, sessions, shells
src/server/auth.js     who gets in: a verified key, or anonymous (generated apps)
src/server/router.js   serve(stream, ptyInfo, h(App, { session }), { session: sshSession })
src/server/session.js  SessionManager: one session object per connection
src/ui/app.js          screens map, current screen, status message, ctx
src/ui/<screen>.js     one Screen per file
src/models/            data
test/unit/             models, sessions, screens (renderTerminal), SSH adapter
test/e2e/              real SSH server
```

adventure-game adds `src/llm/` (`ollama-client.js`, `game-engine.js`).

## ctx (every screen gets it)

```js
ctx.navigate('cart')              // switch screen, clear the message
ctx.notify('success', 'Saved')    // status bar: info | success | warning | error | busy
ctx.notify(null)                  // clear
ctx.setTyping(true)               // q types a letter while a field is edited
ctx.quit()                        // end the session
ctx.session                       // { id, fingerprint, username?, createdAt, ... }
```

## Components

```js
import { Screen, Panel, SelectList, Table, TextField, Button, Meter,
         EmptyState, ScrollView, Message, KeyHint, Box, Text,
         useInput, useApp, useInterval, useTerminalSize,
         textProps, borderProps } from '@shellcraft/ui';
```

| Component | Typical use |
|---|---|
| `Screen` | `{ app, screen, meta, hints: [['q','quit']], message }`: the whole screen |
| `Panel` | `{ title, focused, width?, height?, padding }`: round border, title in the edge |
| `SelectList` | `{ items: [{label, hint}], selectedIndex, onChange, onSelect, height? }` |
| `Table` | `{ columns: [{label, width, align, grow}], rows, selectedIndex, onChange, height? }` |
| `TextField` | `{ label, value, focused, editing, error, placeholder, onChange, onSubmit, onCancel }` |
| `Button` | `{ label, focused }`: `[ label ]`, form actions only |
| `Meter` | `{ label, value, max, tone }`: 36-cell bar |
| `EmptyState` | `{ message, hint, k, label }`: centered, no box, no red |
| `ScrollView` | `{ text \| lines \| rows, follow, height? }`: scrolling region |
| `Message` | `{ tone }`: one status line (`✓` `!` `✗` `i` spinner) |

## Keys

```js
useInput((input, key) => {
  if (input === 'b' || key.escape) ctx.navigate('home');
  else if (key.return) open();
  else if (key.upArrow || input === 'k') move(-1);
}, { isActive: focused });
```

Standard keys: `↑↓` / `k` `j` move, `⏎` select, `1-9` jump, `b` / `esc`
back, `q` quit, Ctrl-C always quits. Every screen lists its keys in the
status bar. Hints read `q quit`.

## Theme

| Text token | Look | Use |
|---|---|---|
| `default` | terminal default | body text |
| `muted` | default, dim | hints, labels, placeholders |
| `accent` | cyan | app name, focus, keys |
| `success` / `warning` / `danger` | green / yellow / red | messages; red only for errors |

Borders: `borderProps('default' | 'focus' | 'danger')`. Never bold and dim at
once. Never name colors in screens.

## Testing

```js
import { renderTerminal, cleanupTerminals, styleAt, boldDimText, tick,
         FakeSshChannel, FakeSshSession, keys, stripAnsi } from '@shellcraft/ui/testing';

const t = renderTerminal(h(App, { session }), { columns: 80, rows: 24 });
await t.press('down', 'enter');
t.lines();                      // rows without ANSI codes
styleAt(t.lastFrame(), 'Menu'); // { fg, bg, bold, dim, underline }
await t.resize(100, 30);
```

## npm Scripts

```bash
npm start               # start the server
npm run dev             # restart on changes (nodemon)
npm run generate-keys   # create keys/host_key (generated apps keep an existing key; -- --force replaces it)
npm test                # unit + e2e
npm run test:unit       # no server
npm run test:e2e        # real SSH server
./npmw run restart      # adventure-game only: free SSH_PORT and restart
```

In this repo's demo apps, put `./npmw` in place of `npm`.

## Environment Variables

```bash
SSH_PORT=2222                    # port
SSH_HOST=0.0.0.0                 # listen address (generated apps)
HOST_KEY_PATH=./keys/host_key    # host key
NODE_ENV=development
FORCE_COLOR=0                    # or NO_COLOR=1: no colors

# adventure-game
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3-coder:30b
```

## Deployment

```bash
pm2 start src/server/index.js --name my-app
docker build -t my-app . && docker run -p 2222:2222 -v "$PWD/keys:/app/keys:ro" my-app
```

Dockerfile and the security notes: [USAGE_GUIDE.md#deployment](USAGE_GUIDE.md#deployment).

## Common Issues

- **Staircase output**: render through `serve()`, not Ink's `render()`.
- **Screen scrolls on every key**: one `Screen` per screen; it is exactly the terminal's height.
- **Key does nothing**: only the focused component should be `isActive`.
- **`Invalid hook call`**: two Reacts. `npm ls react`, then `npm ci`.
- **`ui/` change not visible in a demo app**: `./npmw ci`.

More: [USAGE_GUIDE.md#troubleshooting](USAGE_GUIDE.md#troubleshooting).
