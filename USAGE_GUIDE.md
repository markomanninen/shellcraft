# Usage Guide

How to build and change a shellcraft app. For installing and running the
apps, see [GETTING_STARTED.md](GETTING_STARTED.md). For the rules a screen
follows, see [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md). Every component
and its props are in [ui/README.md](ui/README.md).

The examples use `React.createElement` (as `h`), like the apps: there is no
JSX and no build step.

## How an App Fits Together

```
ssh client ──▶ src/server/index.js   SSH server, one session per connection
                 │
                 ▼
               src/server/router.js  serve(stream, ptyInfo, h(App, { session }), { session: sshSession })
                 │
                 ▼
               src/ui/app.js         current screen + status message, builds ctx
                 │
                 ▼
               src/ui/<screen>.js    one Screen each: title bar, panels, status bar
```

Every screen gets `ctx`:

```js
ctx.navigate('products');         // switch screen (clears the message)
ctx.notify('success', 'Saved');   // status bar message; tones: info success warning error busy
ctx.notify(null);                 // clear it
ctx.setTyping(true);              // while a field is edited, q is just a letter
ctx.quit();                       // end the SSH session
ctx.session;                      // this connection: id, fingerprint, username, ...
```

demo-shop's `ctx` also has cart actions (`addToCart`, `clearCart`,
`placeOrder`). Add your own actions to `ctx` in `src/ui/app.js`.

## Customizing a Generated App

- **App name**: `src/config.js` (`APP_NAME`, shown in every title bar).
- **Menu**: the `MENU` array in `src/ui/home.js`. Each item has a `label`, a
  `hint` (its number key) and the `screen` it opens.
- **Products** (ecommerce): `src/models/product.js`.
- **Session data**: `src/server/session.js`. Add fields to the object that
  `createSession()` returns.

## Adding a Screen

1. Create `src/ui/report.js`:

```js
import React from 'react';
import { Screen, Panel, Text, useInput } from '@shellcraft/ui';
import { APP_NAME } from '../config.js';

const h = React.createElement;

export function ReportScreen({ ctx }) {
  useInput((input, key) => {
    if (input === 'b' || key.escape) ctx.navigate('home');
  });

  return h(
    Screen,
    { app: APP_NAME, screen: 'Report', hints: [['b', 'back'], ['q', 'quit']], message: ctx.message },
    h(Panel, { title: 'Report', focused: true }, h(Text, null, 'Nothing to report yet.'))
  );
}
```

2. Register it in `src/ui/app.js`:

```js
import { ReportScreen } from './report.js';

export const screens = {
  home: HomeScreen,
  report: ReportScreen,
  // ...
};
```

3. Add a menu item in `src/ui/home.js`:
   `{ label: 'Report', hint: '3', screen: 'report' }`. Update the `1-2 jump`
   hint to `1-3 jump`.

4. Add a test in `test/unit/screens.test.js` (see [Testing a Screen](#testing-a-screen)).

## Components by Example

All of these come from `@shellcraft/ui`. So do Ink's `Box`, `Text`,
`useInput` and `useApp`.

### Menu + Detail

A focused menu on the left, details on the right:

```js
const [index, setIndex] = useState(0);

h(Box, { flexGrow: 1 },
  h(Panel, { title: 'Menu', focused: true, width: 30, padding: 0 },
    h(SelectList, {
      items: [{ label: 'Products', hint: '1' }, { label: 'Cart', hint: '2' }],
      selectedIndex: index,
      onChange: setIndex,
      onSelect: (i, item) => ctx.navigate(item.label.toLowerCase())
    })),
  h(Panel, { title: 'Details' }, h(Text, null, 'About the selected item')))
```

`SelectList` handles `↑↓`, `k` `j`, `⏎` and the number keys. Lists and tables
use `padding: 0` on their panel so the selection bar reaches the border.

### Table

```js
const COLUMNS = [
  { label: 'Name', width: 24, grow: true },
  { label: 'Price', width: 9, align: 'right' }
];
const { rows } = useTerminalSize();

h(Panel, { title: 'Products', focused: true, padding: 0 },
  h(Table, {
    columns: COLUMNS,
    rows: products.map((p) => [p.name, `$${p.price.toFixed(2)}`]),
    selectedIndex: index,
    onChange: setIndex,
    height: Math.max(rows - 5, 1)   // title bar, panel edges, header, status bar
  }))
```

With `height`, long tables scroll and show `↑ N more` / `↓ N more`. Use
`selectedIndex: -1` for a table without a selection bar.

### Form

A form has two modes: pick a field with `↑↓`, edit it with `⏎`. While a field
is being edited, tell the app so `q` is not "quit":

```js
h(TextField, {
  label: 'Email',
  placeholder: 'you@example.com',
  value: editing ? draft : form.email,
  error: errors.email,            // shown as "✗ message" under the field
  focused: focus === 1,
  editing,
  onChange: setDraft,
  onSubmit: (value) => { save(value); setEditing(false); ctx.setTyping(false); },
  onCancel: () => { setEditing(false); ctx.setTyping(false); }
})
h(Button, { label: 'Place order', focused: focus === 3 })
```

`demo-shop/src/ui/checkout.js` is a complete form with validation.

### Messages

Results go to the status bar, never into a box over the screen:

```js
ctx.notify('success', 'Added Developer Blend to cart');  // ✓ green
ctx.notify('warning', 'Cart is empty');                   // ! yellow
ctx.notify('error', 'Fix 1 field before ordering');       // ✗ red
ctx.notify('busy', 'Loading products');                   // spinner
```

### Scrolling Text

```js
h(Panel, { title: 'Log', focused: true },
  h(ScrollView, { lines: logLines, follow: true }))   // follow: stay at the end
```

`lines` items can be strings or `{ text, tone, bold, hangingIndent }`.

### Meters and Empty States

```js
h(Meter, { label: 'CPU', value: 42, tone: 'default' })   // tone: default | warning | danger
h(EmptyState, { message: 'Your cart is empty.', hint: 'Browse products and press', k: 'a', label: 'add to cart' })
```

## Keyboard Input

Use Ink's `useInput` in the screen:

```js
useInput((input, key) => {
  if (input === 'a') addItem();
  else if (key.return) open();
  else if (key.upArrow) move(-1);
  else if (input === 'b' || key.escape) ctx.navigate('home');
}, { isActive: !editing });
```

- `app.js` handles `q`. `serve()` handles Ctrl-C.
- When two parts of a screen read keys, give `isActive` to the focused one only.
- Show every key that works in the status bar hints.

## Live Data

Refresh on a timer with `useInterval`. It stops when the screen unmounts or
the user disconnects:

```js
const [stats, setStats] = useState(readStats);
useInterval(() => setStats(readStats()), 2000);
```

## Authentication

The apps show two ways to recognize a user.

### SSH key fingerprint (demo-shop, admin-dashboard, generated apps)

The server keeps the client's public key and the session stores a
fingerprint. Users without a key get `'anonymous'`. Sessions live in memory
and end with the connection.

```js
import { fingerprintOf } from '@shellcraft/ui/auth';

// OpenSSH style, as `ssh-keygen -l` shows it: "SHA256:..."
const fingerprint = fingerprintOf(publicKey); // 'anonymous' without a key

if (ctx.session.fingerprint === 'anonymous') {
  // connected without an SSH key
}
```

Every SSH app signs users in with `authenticate()` from
`@shellcraft/ui/auth` (a generated app wraps it in `src/server/auth.js`):

| Method | Answer |
|---|---|
| `publickey` | any key, if the signature proves the client holds it; the key becomes the fingerprint |
| `keyboard-interactive` | accepted without prompts: an anonymous session |
| `none`, `password`, others | rejected; the server offers the two methods above |

OpenSSH tries `none` first. A server that accepts `none` lets everyone in
before they offer a key, so every session is anonymous. ssh2 does not check
key signatures itself; `authenticate()` does, with
`utils.parseKey(ctx.key.data)` and
`key.verify(ctx.blob, ctx.signature, ctx.hashAlgo)`. ssh2 clients without a
key need `tryKeyboard: true` and a `'keyboard-interactive'` handler that
answers `finish([])`.

### SSH user name (adventure-game)

Sessions are keyed by the SSH user name (`ssh alice@host -p 2222`). The game
state is saved to `data/sessions.json`, so a player can reconnect and continue.

```js
const session = sessionManager.createSession(username); // finds or creates 'alice'
```

### Real authentication

The demo apps and generated apps let everyone in. Before you deploy, check
credentials in the authentication handler (`src/server/auth.js` in a
generated app, `client.on('authentication', ...)` in `src/server/index.js` in
the demo apps). For keys, allow only known ones and no anonymous users:

```js
const allowed = new Set(['SHA256:...']);
authenticate(ctx, onKey, { anonymous: false, allowKey: (key) => allowed.has(fingerprintOf(key)) });
```

For passwords:

```js
client.on('authentication', (ctx) => {
  if (ctx.method === 'password'
      && ctx.username === process.env.ADMIN_USER
      && ctx.password === process.env.ADMIN_PASS) {
    return ctx.accept();
  }
  ctx.reject(['password']);
});
```

Use a constant-time comparison and real secrets in production.

## API Integration

Show a busy message while waiting, then the result:

```js
async function loadProducts(ctx, setProducts) {
  ctx.notify('busy', 'Loading products');
  try {
    const response = await fetch('https://api.example.com/products');
    setProducts(await response.json());
    ctx.notify(null);
  } catch (error) {
    ctx.notify('error', 'Could not load products');
  }
}

// in the screen
useEffect(() => { loadProducts(ctx, setProducts); }, []);
```

## LLM Integration (Ollama)

adventure-game talks to a local [Ollama](https://ollama.com/) server for its
Game Master. You can reuse the pattern.

```
┌──────────────┐      ┌────────────────┐      ┌──────────────────┐
│  room screen │─────▶│ LLMGameEngine  │─────▶│  OllamaClient    │
│  user action │      │ prompt + parse │      │  HTTP → Ollama   │
└──────────────┘      └────────────────┘      └──────────────────┘
```

1. **OllamaClient** (`src/llm/ollama-client.js`): a small HTTP wrapper around
   Ollama's `/api/chat`, with model, base URL and timeout settings.
2. **LLMGameEngine** (`src/llm/game-engine.js`): builds the prompt from the
   game state, keeps the conversation and parses the JSON the model returns.

Settings in `.env`:

```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3-coder:30b
```

```js
import { OllamaClient } from './llm/ollama-client.js';

const client = new OllamaClient();   // reads the env variables
if (await client.isAvailable()) {
  const result = await client.chat([
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Describe this room in two sentences.' }
  ], { temperature: 0.8, maxTokens: 256 });
  console.log(result.message.content);
}
```

The game rules run without the LLM; the LLM only narrates. See
`adventure-game/README.md` for the details.

## Database Integration

SQLite example:

```bash
npm install better-sqlite3
```

```js
import Database from 'better-sqlite3';

const db = new Database('data/shop.db');
db.exec(`CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  user_fingerprint TEXT,
  total REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.prepare('INSERT INTO orders (user_fingerprint, total) VALUES (?, ?)').run(fingerprint, total);
const orders = db.prepare('SELECT * FROM orders WHERE user_fingerprint = ?').all(fingerprint);
```

## Colors and Styling

Screens do not name colors. They use theme tokens through the helpers:

```js
import { textProps, borderProps } from '@shellcraft/ui';

h(Text, textProps('muted'), 'a hint')          // dim default color
h(Text, textProps('success'), 'Saved')         // green
h(Box, { borderStyle: 'round', ...borderProps('focus') })   // cyan border
```

Text tokens: `default`, `muted`, `accent`, `success`, `warning`, `danger`,
`onAccent`. Border tokens: `default`, `focus`, `danger`. All colors are the
16 ANSI colors, so they follow the user's terminal theme. To change the look
of every app, change `ui/src/theme.js` (in a generated app,
`vendor/ui/src/theme.js`).

## Testing a Screen

```js
import { renderTerminal, cleanupTerminals, styleAt, boldDimText, tick } from '@shellcraft/ui/testing';

afterEach(() => cleanupTerminals());

it('report screen', async () => {
  const session = new SessionManager().createSession(null);
  const t = renderTerminal(h(App, { session, initialScreen: 'report' }), { columns: 80, rows: 24 });
  await tick(20);
  assert.ok(t.lines()[0].startsWith(` ${APP_NAME} › Report`));
  assert.equal(t.lines().at(-1), ' b back  q quit');
  assert.equal(boldDimText(t.lastFrame()), '');
  await t.press('b');
  assert.ok(t.lines()[0].includes('Home'));
});
```

More in [TESTING_SUMMARY.md](TESTING_SUMMARY.md).

## Deployment

> **Important:** the demo apps and generated apps accept anonymous
> connections. Add [real authentication](#real-authentication) before you
> deploy anything that others can reach.

### Development

```bash
npm run dev   # restart on changes (nodemon)
```

### PM2

```bash
npm install -g pm2
pm2 start src/server/index.js --name my-terminal-app
pm2 startup   # start on boot
pm2 save
```

PM2 runs the server without a TTY. That is fine: `@shellcraft/ui` sends
colors to SSH clients either way.

### Docker

For a generated app (it has `vendor/ui` and a `.dockerignore`):

```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
COPY vendor ./vendor
RUN npm ci --omit=dev
COPY . .
EXPOSE 2222
CMD ["npm", "start"]
```

```bash
docker build -t my-terminal-app .
docker run -p 2222:2222 -v "$PWD/keys:/app/keys:ro" my-terminal-app
```

Mount the host key instead of baking it into the image. A new key on every
build makes SSH clients warn that the host changed.

### Public Access

1. Open port 2222 in the firewall.
2. Forward port 2222 on the router to the server.
3. Listen on all interfaces: `SSH_HOST=0.0.0.0` (the default).
4. Connect: `ssh your-domain.com -p 2222`.

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| `Connection refused` | The server is not running, or runs on another port. Check `lsof -i :2222`. |
| `Host key not found` | Run `npm run generate-keys`. |
| Rows start further and further right (staircase) | Output reaches the client without `\r\n`. Render through `serve()`, not Ink's `render()`. |
| No colors over SSH | `FORCE_COLOR=0` or `NO_COLOR` is set for the server. Unset it. |
| The screen scrolls or flickers on every key | The UI is taller than the terminal. Wrap each screen in one `Screen`, which is exactly the terminal's height. |
| A key does nothing | Another component holds the keys: only the focused list should have `isActive`. While `ctx.setTyping(true)` is on, `q` is text. |
| `Invalid hook call` | Two copies of React. `npm ls react` must show one `react@19`. Run `npm ci`. |
| A change in `ui/` does not show in a demo app | npm copied `ui/` into `node_modules`. Run `./npmw ci` in the app. |
| `node` too old | Ink 8 needs Node 22 or newer. |

## Advanced Topics

### Several Apps on One Machine

Give each app its own port in its `.env`: `SSH_PORT=2222`, `SSH_PORT=2223`, ...

### Logging

```js
import fs from 'fs';

const log = (message) => {
  fs.appendFileSync('logs/app.log', `[${new Date().toISOString()}] ${message}\n`);
};
```

Do not `console.log` from a screen: the server's stdout is not the user's
terminal. Use the status bar for the user and a log file for yourself.

## Use Cases and Ideas

- **Shops** for developer products (see demo-shop)
- **Games**: text adventures, MUDs, interactive fiction (see adventure-game)
- **Admin tools**: monitoring, log viewing, database tools (see admin-dashboard)
- **API clients**: explore and test an API from the terminal
- **Kiosks**: documentation browsers, support desks, knowledge bases
- **Small tools**: todo lists, ticket queues, snippet managers, chat rooms

## Resources

- [Ink](https://github.com/vadimdemedes/ink)
- [ssh2](https://github.com/mscdex/ssh2)
- [Node.js docs](https://nodejs.org/docs)
- [ui/README.md](ui/README.md): components, theme, `serve()`, test helpers
- [Figma: shellcraft](https://www.figma.com/design/oykSSRdp0xDbaot7ZkLFQc)

## License

MIT: use this template for any project, commercial or personal.
