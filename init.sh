#!/usr/bin/env bash
#
# shellcraft app generator
#
# Creates a new SSH terminal app: an ssh2 server that renders an Ink UI for
# every SSH session through @shellcraft/ui. The ui package is copied into the
# new project as vendor/ui, so the project is self-contained.
#
#   ./init.sh <project-name> [app-type]
#
#   project-name  directory to create (a path is fine), default my-terminal-app
#   app-type      minimal (default) or ecommerce
#
# Runs on bash 3.2 (macOS) and newer and uses only POSIX tools (no GNU-only
# flags), so it works on macOS and Linux.

set -euo pipefail

usage() {
  echo "Usage: ./init.sh <project-name> [app-type]"
  echo "App types: minimal (default), ecommerce"
}

case "${1:-}" in
  -h|--help)
    usage
    exit 0
    ;;
esac

PROJECT_NAME="${1:-my-terminal-app}"
APP_TYPE="${2:-minimal}"

# Validate app type
if [[ ! "$APP_TYPE" =~ ^(minimal|ecommerce)$ ]]; then
  echo "❌ Invalid app type: $APP_TYPE"
  usage
  exit 1
fi

# The ui package that gets copied into the new app.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UI_SRC="$SCRIPT_DIR/ui"
if [ ! -f "$UI_SRC/package.json" ] || [ ! -f "$UI_SRC/src/index.js" ]; then
  echo "❌ Cannot find the ui package at $UI_SRC"
  echo "   Run init.sh from a shellcraft checkout: it copies ui/ into the new app."
  exit 1
fi

# Never overwrite an existing project.
if [ -e "$PROJECT_NAME" ] && [ ! -d "$PROJECT_NAME" ]; then
  echo "❌ $PROJECT_NAME exists and is not a directory"
  exit 1
fi
if [ -d "$PROJECT_NAME" ] && [ -n "$(ls -A "$PROJECT_NAME")" ]; then
  echo "❌ $PROJECT_NAME already exists and is not empty"
  exit 1
fi

# Names derived from the directory name:
#   my-shop -> package "my-shop", title bar "My Shop"
BASE_NAME="$(basename "$PROJECT_NAME")"
PACKAGE_NAME="$(printf '%s' "$BASE_NAME" | LC_ALL=C tr '[:upper:]' '[:lower:]' | LC_ALL=C sed -e 's/[^a-z0-9._-]/-/g' -e 's/--*/-/g' -e 's/^[._-]*//')"
if [ -z "$PACKAGE_NAME" ]; then
  PACKAGE_NAME="terminal-app"
fi
APP_TITLE="$(printf '%s' "$BASE_NAME" | LC_ALL=C tr -c 'A-Za-z0-9' ' ' \
  | awk '{ for (i = 1; i <= NF; i++) $i = toupper(substr($i, 1, 1)) substr($i, 2); print }' \
  | cut -c 1-40 | sed 's/ *$//')"
if [ -z "$APP_TITLE" ]; then
  APP_TITLE="Terminal App"
fi

UI_VERSION="$(sed -n 's/^  "version": *"\([^"]*\)".*/\1/p' "$UI_SRC/package.json")"
UI_COMMIT="$(git -C "$SCRIPT_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"

# Replace __PLACEHOLDERS__ in generated files (no sed -i: it differs
# between BSD and GNU sed).
fill_placeholders() {
  local file
  for file in "$@"; do
    sed -e "s/__APP_TITLE__/${APP_TITLE}/g" \
        -e "s/__PACKAGE_NAME__/${PACKAGE_NAME}/g" \
        -e "s/__APP_TYPE__/${APP_TYPE}/g" \
        -e "s/__UI_VERSION__/${UI_VERSION}/g" \
        -e "s/__UI_COMMIT__/${UI_COMMIT}/g" \
        "$file" > "$file.tmp"
    mv "$file.tmp" "$file"
  done
}

echo "🚀 Creating Terminal App: $PROJECT_NAME (type: $APP_TYPE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create project structure
mkdir -p "$PROJECT_NAME"
cd "$PROJECT_NAME"

echo "📁 Creating directory structure..."
mkdir -p src/server src/ui scripts test/unit test/e2e test/helpers
if [ "$APP_TYPE" = "ecommerce" ]; then
  mkdir -p src/models
fi

# Copy the ui package: runtime sources, README, changelog, package.json and license.
# Its tests, scripts and node_modules stay behind. The package.json loses
# its devDependencies and scripts: npm links a file: path inside the project
# and would install a linked package's devDependencies (test tools, and a
# second react if someone ran npm install in vendor/ui).
echo "📚 Copying @shellcraft/ui into vendor/ui..."
mkdir -p vendor/ui
cp -R "$UI_SRC/src" vendor/ui/src
awk '
  /^  "(devDependencies|scripts)": \{/ { skip = 1; next }
  skip && /^  \},?$/ { skip = 0; next }
  skip { next }
  { print }
' "$UI_SRC/package.json" > vendor/ui/package.json
if command -v node >/dev/null 2>&1 &&
   ! node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' vendor/ui/package.json 2>/dev/null; then
  # The trim did not leave valid JSON (ui/package.json changed shape): keep it whole.
  cp "$UI_SRC/package.json" vendor/ui/package.json
fi
cp "$UI_SRC/README.md" vendor/ui/README.md
if [ -f "$UI_SRC/CHANGELOG.md" ]; then
  cp "$UI_SRC/CHANGELOG.md" vendor/ui/CHANGELOG.md
fi
if [ -f "$UI_SRC/LICENSE" ]; then
  cp "$UI_SRC/LICENSE" vendor/ui/LICENSE
elif [ -f "$SCRIPT_DIR/LICENSE" ]; then
  cp "$SCRIPT_DIR/LICENSE" vendor/ui/LICENSE
fi
find vendor/ui -name .DS_Store -exec rm -f {} +

# Create package.json
echo "📦 Creating package.json..."
cat > package.json << 'EOL'
{
  "name": "__PACKAGE_NAME__",
  "version": "1.0.0",
  "description": "SSH terminal app built with Ink and @shellcraft/ui",
  "main": "src/server/index.js",
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "start": "node src/server/index.js",
    "dev": "nodemon src/server/index.js",
    "generate-keys": "node scripts/generate-keys.js",
    "test": "npm run test:unit && npm run test:e2e",
    "test:unit": "node --test test/unit/*.test.js",
    "test:e2e": "node --test test/e2e/*.test.js",
    "test:watch": "node --test --watch"
  },
  "keywords": ["ssh", "terminal", "tui", "ink", "cli"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "@shellcraft/ui": "file:./vendor/ui",
    "dotenv": "^17.3.1",
    "ink": "^8.0.0",
    "nanoid": "^5.0.4",
    "react": "^19.3.1",
    "ssh2": "^1.15.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
EOL
fill_placeholders package.json

# No .npmrc: npm links a file: path inside the project
# (node_modules/@shellcraft/ui -> vendor/ui), and vendor/ui has no
# node_modules of its own, so it uses this app's react and ink: one React.
# (install-links=true, as the shellcraft apps use for ../ui, would make
# `npm ls` report the link as invalid here.)

# App name for the title bar
cat > src/config.js << 'EOL'
// Shown at the left of every screen's title bar: "App › Screen".
export const APP_NAME = '__APP_TITLE__';
EOL
fill_placeholders src/config.js

# Create main server file
echo "🖥️  Creating SSH server..."
cat > src/server/index.js << 'EOL'
import fs from 'fs';
import ssh2 from 'ssh2';
import dotenv from 'dotenv';
import { authenticate } from './auth.js';
import { CommandRouter } from './router.js';
import { SessionManager } from './session.js';

const { Server } = ssh2;

dotenv.config({ quiet: true });

const PORT = Number(process.env.SSH_PORT || 2222);
const HOST = process.env.SSH_HOST || '0.0.0.0';
const HOST_KEY_PATH = process.env.HOST_KEY_PATH || './keys/host_key';

function readHostKey(file) {
  try {
    return fs.readFileSync(file);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`Host key not found at ${file}. Run: npm run generate-keys`);
      process.exit(1);
    }
    throw err;
  }
}

class TerminalServer {
  constructor() {
    this.server = new Server({ hostKeys: [readHostKey(HOST_KEY_PATH)] }, this.handleClient.bind(this));
    this.sessionManager = new SessionManager();
    this.router = new CommandRouter();
  }

  handleClient(client) {
    console.log('Client connecting...');

    let publicKey = null;
    let username = null;

    // Everyone gets in, with a verified key or anonymously (see auth.js).
    // Fine for local development, not for a public server.
    client.on('authentication', (ctx) => {
      username = ctx.username || null;
      authenticate(ctx, (key) => {
        publicKey = key;
      });
    });

    client.on('ready', () => {
      console.log('Client authenticated');

      const session = this.sessionManager.createSession(publicKey, username);

      client.on('session', (accept) => {
        const sshSession = accept();
        let ptyInfo = null;

        sshSession.once('pty', (acceptPty, _rejectPty, info) => {
          ptyInfo = info;
          if (acceptPty) acceptPty();
        });

        sshSession.once('shell', (acceptShell) => {
          const stream = acceptShell();

          // One Ink app per shell. sshSession carries 'window-change' (resize).
          this.router.handleConnection(stream, session, ptyInfo, sshSession);

          stream.on('error', (err) => {
            console.error('Stream error:', err.message);
          });

          stream.on('close', () => {
            console.log('Client disconnected');
            this.sessionManager.destroySession(session.id);
          });
        });
      });
    });

    client.on('error', (err) => {
      console.error('Client error:', err.message);
    });
  }

  start() {
    this.server.listen(PORT, HOST, () => {
      console.log(`Terminal server listening on ${HOST}:${PORT}`);
      console.log(`Connect with: ssh localhost -p ${PORT}`);
    });
  }
}

const server = new TerminalServer();
server.start();
EOL

# Create authentication handler
cat > src/server/auth.js << 'EOL'
// Who gets in. The checks live in @shellcraft/ui/auth (vendor/ui/src/auth.js):
//
// - publickey: the client must prove that it holds the key (ssh2 leaves the
//   signature check to the server). onKey(key) gets a verified key, which
//   becomes the session's fingerprint.
// - keyboard-interactive: accepted without prompts, an anonymous session.
// - none, password and the rest: rejected. OpenSSH tries 'none' first;
//   accepting it would make every user anonymous.
//
// For a real deployment, allow only known keys and no anonymous users:
//
//   const allowed = new Set(['SHA256:...']);
//   authenticate(ctx, onKey, { anonymous: false, allowKey: (key) => allowed.has(fingerprintOf(key)) });
import { authenticate as shellcraftAuthenticate, AUTH_METHODS, fingerprintOf } from '@shellcraft/ui/auth';

export { AUTH_METHODS, fingerprintOf };

/** ssh2 'authentication' handler: everyone gets in, a key only when proven. */
export function authenticate(ctx, onKey = () => {}) {
  return shellcraftAuthenticate(ctx, onKey, { anonymous: true });
}
EOL

# Create router
echo "🛤️  Creating command router..."
cat > src/server/router.js << 'EOL'
import React from 'react';
import { serve } from '@shellcraft/ui';
import { App } from '../ui/app.js';

export class CommandRouter {
  /**
   * Run the app on one SSH shell channel.
   *
   * stream: the channel from the 'shell' accept()
   * session: this connection's session (see session.js)
   * ptyInfo: the 'pty' request info ({ cols, rows, ... }), or null
   * sshSession: the ssh2 Session, for 'window-change' (terminal resize)
   *
   * serve() sets the terminal size, writes CRLF line ends, pins colors to
   * the 16 ANSI colors, uses the alternate screen and cleans up on exit or
   * disconnect. Returns its cleanup function.
   */
  handleConnection(stream, session, ptyInfo, sshSession = null) {
    return serve(stream, ptyInfo, React.createElement(App, { session }), { session: sshSession });
  }
}
EOL

# Create session manager
echo "👤 Creating session manager..."
if [ "$APP_TYPE" = "ecommerce" ]; then
  cat > src/server/session.js << 'EOL'
import { nanoid } from 'nanoid';
import { fingerprintOf } from '@shellcraft/ui/auth';

// OpenSSH-style fingerprint of a public key: "SHA256:..." (as ssh-keygen -l),
// or 'anonymous'.
export { fingerprintOf };

export class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  createSession(publicKey, username = null) {
    const id = nanoid();
    const session = {
      id,
      fingerprint: fingerprintOf(publicKey),
      username,
      createdAt: new Date(),
      cart: [],
      user: null
    };

    this.sessions.set(id, session);
    return session;
  }

  getSession(id) {
    return this.sessions.get(id);
  }

  destroySession(id) {
    this.sessions.delete(id);
  }
}
EOL
else
  cat > src/server/session.js << 'EOL'
import { nanoid } from 'nanoid';
import { fingerprintOf } from '@shellcraft/ui/auth';

// OpenSSH-style fingerprint of a public key: "SHA256:..." (as ssh-keygen -l),
// or 'anonymous'.
export { fingerprintOf };

export class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  createSession(publicKey, username = null) {
    const id = nanoid();
    const session = {
      id,
      fingerprint: fingerprintOf(publicKey),
      username,
      createdAt: new Date(),
      user: null
    };

    this.sessions.set(id, session);
    return session;
  }

  getSession(id) {
    return this.sessions.get(id);
  }

  destroySession(id) {
    this.sessions.delete(id);
  }
}
EOL
fi

# Create app-type specific screens
echo "🎨 Creating screens..."
if [ "$APP_TYPE" = "minimal" ]; then
  cat > src/ui/app.js << 'EOL'
import React, { useRef, useState } from 'react';
import { useApp, useInput } from '@shellcraft/ui';
import { HomeScreen } from './home.js';
import { GuideScreen } from './guide.js';
import { SessionScreen } from './session-info.js';

const h = React.createElement;

/** Screens by name; ctx.navigate(name) switches between them. */
export const screens = {
  home: HomeScreen,
  guide: GuideScreen,
  session: SessionScreen
};

/**
 * The app for one SSH session. Holds the current screen and the status bar
 * message; every screen gets `ctx` to navigate, show messages and quit.
 *
 * q quits from every screen, except while a text field is being edited
 * (a screen calls ctx.setTyping(true) for that). Ctrl-C always quits.
 */
export function App({ session, initialScreen = 'home' }) {
  const { exit } = useApp();
  const [route, setRoute] = useState({ name: initialScreen, visit: 0 });
  const [message, setMessage] = useState(null);
  const [typing, setTyping] = useState(false);
  const visits = useRef(0);

  useInput(
    (input, key) => {
      if (input === 'q' && !key.ctrl && !key.meta) exit();
    },
    { isActive: !typing }
  );

  const ctx = {
    session,
    message,
    navigate(name) {
      visits.current += 1;
      setRoute({ name: screens[name] ? name : 'home', visit: visits.current });
      setMessage(null);
      setTyping(false);
    },
    /** Status bar message: notify('success', 'Saved'); notify(null) clears it. */
    notify(tone, text) {
      setMessage(tone ? { tone, text } : null);
    },
    setTyping,
    quit: exit
  };

  const Current = screens[route.name] ?? HomeScreen;
  return h(Current, { key: `${route.name}-${route.visit}`, ctx });
}
EOL

  cat > src/ui/home.js << 'EOL'
import React, { useState } from 'react';
import { Screen, Panel, SelectList, Box, Text } from '@shellcraft/ui';
import { APP_NAME } from '../config.js';

const h = React.createElement;

export const MENU = [
  {
    label: 'Getting started',
    hint: '1',
    screen: 'guide',
    about: 'Where the code lives and how to add a screen of your own.'
  },
  {
    label: 'Session',
    hint: '2',
    screen: 'session',
    about: 'This connection: session id, user, SSH key fingerprint and terminal size.'
  }
];

/** Title bar meta: the SSH user name, if the client sent one. */
export const userMeta = (session) => (session?.username ? `user: ${session.username}` : undefined);

/**
 * Menu + detail: the menu panel has focus, the detail panel describes the
 * selected item. ⏎ opens it. No Exit item: q quits.
 */
export function HomeScreen({ ctx }) {
  const [index, setIndex] = useState(0);
  const item = MENU[index] ?? MENU[0];

  return h(
    Screen,
    {
      app: APP_NAME,
      screen: 'Home',
      meta: userMeta(ctx.session),
      hints: [['↑↓', 'move'], ['⏎', 'open'], ['1-2', 'jump'], ['q', 'quit']],
      message: ctx.message
    },
    h(
      Box,
      { flexGrow: 1 },
      h(
        Panel,
        { title: 'Menu', focused: true, width: 30, padding: 0 },
        h(SelectList, {
          items: MENU,
          selectedIndex: index,
          onChange: setIndex,
          onSelect: (_i, selected) => ctx.navigate(selected.screen)
        })
      ),
      h(Panel, { title: item.label }, h(Text, { wrap: 'wrap' }, item.about))
    )
  );
}
EOL

  cat > src/ui/guide.js << 'EOL'
import React from 'react';
import { Screen, Panel, ScrollView, useInput } from '@shellcraft/ui';
import { APP_NAME } from '../config.js';

const h = React.createElement;

export const GUIDE = [
  { text: 'How this app works', bold: true },
  'src/server/index.js runs the SSH server. For every shell, src/server/router.js passes the channel to serve() from @shellcraft/ui, which renders the Ink app in src/ui/app.js.',
  '',
  { text: 'Add a screen', bold: true },
  { text: '1. Create src/ui/my-screen.js: a function component that returns one Screen.', hangingIndent: 3 },
  { text: '2. Add it to the screens map in src/ui/app.js.', hangingIndent: 3 },
  { text: "3. Open it with ctx.navigate('my-screen'). Give it a b back key.", hangingIndent: 3 },
  '',
  { text: 'Design rules', bold: true },
  { text: '- One title bar and one status bar per screen. Screen draws both.', hangingIndent: 2 },
  { text: '- Key hints read "q quit": the key, then the verb.', hangingIndent: 2 },
  { text: '- Colors only through the theme helpers (textProps, borderProps).', hangingIndent: 2 },
  { text: '- Results go to the status bar (ctx.notify), not into floating boxes.', hangingIndent: 2 },
  { text: '- No Exit menu items: q quits.', hangingIndent: 2 },
  '',
  { text: 'Tests', bold: true },
  'npm test runs node:test. test/unit/screens.test.js renders every screen on a fake 80x24 terminal and presses keys.',
  '',
  { text: 'Components, theme and SSH notes: vendor/ui/README.md.', tone: 'muted' }
];

/** Scrolling text in one focused panel: ↑↓ scroll, b back. */
export function GuideScreen({ ctx }) {
  useInput((input, key) => {
    if (input === 'b' || key.escape) ctx.navigate('home');
  });

  return h(
    Screen,
    {
      app: APP_NAME,
      screen: 'Getting started',
      hints: [['↑↓', 'scroll'], ['b', 'back'], ['q', 'quit']],
      message: ctx.message
    },
    h(Panel, { title: 'Getting started', focused: true }, h(ScrollView, { lines: GUIDE }))
  );
}
EOL

  cat > src/ui/session-info.js << 'EOL'
import React from 'react';
import { Screen, Panel, Table, useInput, useTerminalSize } from '@shellcraft/ui';
import { APP_NAME } from '../config.js';

const h = React.createElement;

export const SESSION_COLUMNS = [
  { label: 'Field', width: 12 },
  { label: 'Value', width: 40, grow: true }
];

const formatTime = (date) =>
  date instanceof Date ? `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC` : '-';

/** Table rows describing one session on a terminal of `size`. */
export function sessionRows(session, size) {
  return [
    ['Session', session.id],
    ['User', session.username ?? '-'],
    ['Key', session.fingerprint],
    ['Connected', formatTime(session.createdAt)],
    ['Terminal', `${size.columns}×${size.rows}`]
  ];
}

/** Table without a selection bar. The terminal size follows resizes. */
export function SessionScreen({ ctx }) {
  const size = useTerminalSize();

  useInput((input, key) => {
    if (input === 'b' || key.escape) ctx.navigate('home');
  });

  return h(
    Screen,
    { app: APP_NAME, screen: 'Session', hints: [['b', 'back'], ['q', 'quit']], message: ctx.message },
    h(
      Panel,
      { title: 'Session', focused: true, padding: 0 },
      h(Table, { columns: SESSION_COLUMNS, rows: sessionRows(ctx.session, size), selectedIndex: -1 })
    )
  );
}
EOL

elif [ "$APP_TYPE" = "ecommerce" ]; then
  cat > src/ui/app.js << 'EOL'
import React, { useRef, useState } from 'react';
import { useApp, useInput } from '@shellcraft/ui';
import { ProductModel } from '../models/product.js';
import { HomeScreen } from './home.js';
import { ProductsScreen } from './products.js';
import { CartScreen } from './cart.js';
import { CheckoutScreen } from './checkout.js';
import { cartTotal, money, plural } from './cart-summary.js';

const h = React.createElement;

/** Screens by name; ctx.navigate(name) switches between them. */
export const screens = {
  home: HomeScreen,
  products: ProductsScreen,
  cart: CartScreen,
  checkout: CheckoutScreen
};

/**
 * The shop for one SSH session. Holds the current screen and the status
 * bar message; screens get a `ctx` to navigate, show messages and change
 * the cart. The cart lives in the session object (session.cart).
 *
 * q quits from every screen except while a text field is being edited.
 * Ctrl-C always quits.
 */
export function App({ session, initialScreen = 'home', products = new ProductModel() }) {
  const { exit } = useApp();
  const [route, setRoute] = useState({ name: initialScreen, visit: 0 });
  const [message, setMessage] = useState(null);
  const [typing, setTyping] = useState(false);
  const [, setVersion] = useState(0);
  const visits = useRef(0);

  // session.cart is changed in place (other code may hold the session), so
  // changes to it are followed by a re-render.
  const refresh = () => setVersion((v) => v + 1);

  useInput(
    (input, key) => {
      if (input === 'q' && !key.ctrl && !key.meta) exit();
    },
    { isActive: !typing }
  );

  const ctx = {
    session,
    products,
    message,
    navigate(name) {
      visits.current += 1;
      setRoute({ name: screens[name] ? name : 'home', visit: visits.current });
      setMessage(null);
      setTyping(false);
    },
    /** Status bar message: notify('success', 'Saved'); notify(null) clears it. */
    notify(tone, text) {
      setMessage(tone ? { tone, text } : null);
    },
    setTyping,
    addToCart(product) {
      session.cart.push(product);
      refresh();
      setMessage({ tone: 'success', text: `Added ${product.name} to cart` });
    },
    clearCart() {
      const had = session.cart.length;
      session.cart = [];
      refresh();
      setMessage({ tone: 'info', text: had ? 'Cart cleared' : 'Cart is already empty' });
    },
    placeOrder(shipping) {
      const count = session.cart.length;
      const total = cartTotal(session.cart);
      session.orders = [...(session.orders ?? []), { items: session.cart, total, shipping, placedAt: new Date() }];
      session.cart = [];
      delete session.checkoutFormData;
      ctx.navigate('home');
      setMessage({ tone: 'success', text: `Order placed: ${plural(count, 'item')}, ${money(total)}` });
    },
    quit: exit
  };

  const Current = screens[route.name] ?? HomeScreen;
  return h(Current, { key: `${route.name}-${route.visit}`, ctx });
}
EOL

  cat > src/ui/cart-summary.js << 'EOL'
import React from 'react';
import { Box, Text, textProps } from '@shellcraft/ui';

const h = React.createElement;

export const money = (amount) => `$${amount.toFixed(2)}`;

export const cartTotal = (cart) => cart.reduce((sum, item) => sum + item.price, 0);

/** Cart lines grouped by product, in the order they were first added. */
export function cartLines(cart) {
  const lines = new Map();
  for (const product of cart) {
    const line = lines.get(product.id);
    if (line) line.qty += 1;
    else lines.set(product.id, { product, qty: 1 });
  }
  return [...lines.values()].map((line) => ({ ...line, subtotal: line.qty * line.product.price }));
}

/** Title bar meta: "cart: 3 · $69.97" or "cart: empty". */
export const cartMeta = (cart) =>
  cart.length === 0 ? 'cart: empty' : `cart: ${cart.length} · ${money(cartTotal(cart))}`;

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const LABEL_WIDTH = 24;

// Product lines: muted name, default value. The total: both bold, and the
// label not muted, because bold + dim shows as only one of them on some
// terminals.
function Row({ label, value, bold = false }) {
  return h(
    Box,
    { height: 1, flexShrink: 0 },
    h(
      Box,
      { width: LABEL_WIDTH, flexShrink: 0, overflow: 'hidden' },
      h(Text, { ...textProps(bold ? 'default' : 'muted'), bold, wrap: 'truncate-end' }, label)
    ),
    h(Text, { ...textProps('default'), bold, wrap: 'truncate-end' }, value)
  );
}

/**
 * "Developer Blend   2 × $24.99" lines, a blank line and the total.
 * maxLines caps the product lines; the rest is summed up in a
 * "+ n more" line.
 */
export function CartSummary({ cart, maxLines = Infinity }) {
  const lines = cartLines(cart);
  let shown = lines;
  let hidden = [];
  if (lines.length > maxLines) {
    shown = lines.slice(0, Math.max(maxLines - 1, 0));
    hidden = lines.slice(shown.length);
  }
  return h(
    Box,
    { flexDirection: 'column', flexShrink: 0 },
    ...shown.map((line) =>
      h(Row, { key: line.product.id, label: line.product.name, value: `${line.qty} × ${money(line.product.price)}` })
    ),
    hidden.length > 0
      ? h(Row, {
          key: 'more',
          label: `+ ${plural(hidden.length, 'more product')}`,
          value: `${hidden.reduce((n, l) => n + l.qty, 0)} × …`
        })
      : null,
    h(Box, { key: 'gap', height: 1 }),
    h(Row, { key: 'total', label: 'Total', value: money(cartTotal(cart)), bold: true })
  );
}
EOL

  cat > src/ui/home.js << 'EOL'
import React, { useState } from 'react';
import { Screen, Panel, SelectList, EmptyState, Box } from '@shellcraft/ui';
import { APP_NAME } from '../config.js';
import { CartSummary, cartMeta } from './cart-summary.js';

const h = React.createElement;

const MENU = [
  { label: 'Browse products', hint: '1', screen: 'products' },
  { label: 'View cart', hint: '2', screen: 'cart' },
  { label: 'Checkout', hint: '3', screen: 'checkout' }
];

/**
 * Menu + detail: the menu panel has focus, the detail panel shows the cart.
 * No Exit item: q quits.
 */
export function HomeScreen({ ctx }) {
  const [index, setIndex] = useState(0);
  const { cart } = ctx.session;

  return h(
    Screen,
    {
      app: APP_NAME,
      screen: 'Home',
      meta: cartMeta(cart),
      hints: [['↑↓', 'move'], ['⏎', 'select'], ['1-3', 'jump'], ['q', 'quit']],
      message: ctx.message
    },
    h(
      Box,
      { flexGrow: 1 },
      h(
        Panel,
        { title: 'Menu', focused: true, width: 30, padding: 0 },
        h(SelectList, {
          items: MENU,
          selectedIndex: index,
          onChange: setIndex,
          onSelect: (_i, item) => ctx.navigate(item.screen)
        })
      ),
      h(
        Panel,
        { title: 'Cart' },
        cart.length === 0
          ? h(EmptyState, {
              message: 'Your cart is empty.',
              hint: 'Browse products and press',
              k: 'a',
              label: 'add to cart'
            })
          : h(CartSummary, { cart })
      )
    )
  );
}
EOL

  cat > src/ui/products.js << 'EOL'
import React, { useState } from 'react';
import { Screen, Panel, Table, useInput, useTerminalSize } from '@shellcraft/ui';
import { APP_NAME } from '../config.js';
import { cartMeta, money } from './cart-summary.js';

const h = React.createElement;

export const PRODUCT_COLUMNS = [
  { label: 'ID', width: 10 },
  { label: 'Name', width: 24 },
  { label: 'Description', width: 30, grow: true },
  { label: 'Price', width: 9, align: 'right' }
];

/** Table template: ↑↓ move, a add to cart, c cart, b back. */
export function ProductsScreen({ ctx }) {
  const products = ctx.products.getAll();
  const [index, setIndex] = useState(0);
  const { rows } = useTerminalSize();

  useInput((input, key) => {
    if (input === 'a') {
      const product = products[index];
      if (product) ctx.addToCart(product);
    } else if (input === 'c') {
      ctx.navigate('cart');
    } else if (input === 'b' || key.escape) {
      ctx.navigate('home');
    }
  });

  return h(
    Screen,
    {
      app: APP_NAME,
      screen: 'Products',
      meta: cartMeta(ctx.session.cart),
      hints: [['↑↓', 'move'], ['a', 'add to cart'], ['c', 'cart'], ['b', 'back']],
      message: ctx.message
    },
    h(
      Panel,
      { title: 'Products', focused: true, padding: 0 },
      h(Table, {
        columns: PRODUCT_COLUMNS,
        rows: products.map((p) => [p.id, p.name, p.description, money(p.price)]),
        selectedIndex: index,
        onChange: setIndex,
        // title, top edge, header, bottom edge, status
        height: Math.max(rows - 5, 1)
      })
    )
  );
}
EOL

  cat > src/ui/cart.js << 'EOL'
import React, { useState } from 'react';
import { Screen, Panel, Table, TableRow, EmptyState, Box, useInput, useTerminalSize } from '@shellcraft/ui';
import { APP_NAME } from '../config.js';
import { cartLines, cartMeta, cartTotal, money } from './cart-summary.js';

const h = React.createElement;

export const CART_COLUMNS = [
  { label: 'Product', width: 24, grow: true },
  { label: 'Qty', width: 5, align: 'right' },
  { label: 'Price', width: 9, align: 'right' },
  { label: 'Subtotal', width: 10, align: 'right' }
];

/** Table template with a total row: c checkout, x clear cart, b back. */
export function CartScreen({ ctx }) {
  const { cart } = ctx.session;
  const lines = cartLines(cart);
  const [index, setIndex] = useState(0);
  const { rows } = useTerminalSize();

  useInput((input, key) => {
    if (input === 'c') {
      if (cart.length > 0) ctx.navigate('checkout');
      else ctx.notify('warning', 'Cart is empty');
    } else if (input === 'x') {
      ctx.clearCart();
    } else if (input === 'b' || key.escape) {
      ctx.navigate('home');
    }
  });

  const body =
    lines.length === 0
      ? h(EmptyState, { message: 'Your cart is empty.', hint: 'Browse products from the menu:', k: 'b', label: 'back' })
      : h(
          Box,
          { flexDirection: 'column', flexGrow: 1 },
          h(Table, {
            columns: CART_COLUMNS,
            rows: lines.map((l) => [l.product.name, String(l.qty), money(l.product.price), money(l.subtotal)]),
            selectedIndex: index,
            onChange: setIndex,
            // title, top edge, header, blank, total, bottom edge, status
            height: Math.max(rows - 7, 1)
          }),
          h(Box, { height: 1 }),
          h(TableRow, { columns: CART_COLUMNS, cells: ['Total', '', '', money(cartTotal(cart))], bold: true })
        );

  return h(
    Screen,
    {
      app: APP_NAME,
      screen: 'Cart',
      meta: cartMeta(cart),
      hints: [['↑↓', 'move'], ['c', 'checkout'], ['x', 'clear cart'], ['b', 'back']],
      message: ctx.message
    },
    h(Panel, { title: 'Cart', focused: true, padding: 0 }, body)
  );
}
EOL

  cat > src/ui/checkout.js << 'EOL'
import React, { useState } from 'react';
import {
  Screen,
  Panel,
  TextField,
  Button,
  EmptyState,
  Box,
  useInput,
  useTerminalSize
} from '@shellcraft/ui';
import { APP_NAME } from '../config.js';
import { CartSummary, cartMeta, plural } from './cart-summary.js';

const h = React.createElement;

export const FIELDS = [
  { name: 'name', label: 'Name', placeholder: 'Your name' },
  { name: 'email', label: 'Email', placeholder: 'you@example.com' },
  { name: 'address', label: 'Address', placeholder: 'Street, city' }
];
const BUTTON = FIELDS.length; // focus index of [ Place order ]

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Error message for one field, or null when it is fine. */
export function validateField(name, value) {
  const v = (value ?? '').trim();
  if (name === 'name') return v ? null : 'Enter your name';
  if (name === 'email') {
    if (!v) return 'Enter your email';
    return EMAIL.test(v) ? null : 'Enter a full address';
  }
  if (name === 'address') return v ? null : 'Enter a shipping address';
  return null;
}

export function validateForm(form) {
  const errors = {};
  for (const { name } of FIELDS) {
    const error = validateField(name, form[name]);
    if (error) errors[name] = error;
  }
  return errors;
}

const SHIPPING_HEIGHT = 10; // edge + padding + 3 fields × 2 rows + padding + edge

/**
 * Form template. Move between fields with ↑↓ and press ⏎ to edit one;
 * while editing, ⏎ saves and esc cancels. ⏎ on [ Place order ] validates
 * and places the order. b goes back.
 */
export function CheckoutScreen({ ctx }) {
  const { session } = ctx;
  const cart = session.cart;
  const [form, setForm] = useState(() => ({ name: '', email: '', address: '', ...session.checkoutFormData }));
  const [errors, setErrors] = useState({});
  const [focus, setFocus] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const { rows } = useTerminalSize();

  const startEditing = () => {
    setDraft(form[FIELDS[focus].name] ?? '');
    setEditing(true);
    ctx.setTyping(true);
  };

  const stopEditing = () => {
    setEditing(false);
    ctx.setTyping(false);
  };

  const commit = (value) => {
    const { name } = FIELDS[focus];
    const next = { ...form, [name]: value };
    setForm(next);
    session.checkoutFormData = next;
    if (errors[name]) {
      // Re-check a field that was flagged, so a fix clears its error at once.
      const error = validateField(name, value);
      const nextErrors = { ...errors };
      if (error) nextErrors[name] = error;
      else delete nextErrors[name];
      setErrors(nextErrors);
      const left = Object.keys(nextErrors).length;
      if (left > 0) ctx.notify('error', `Fix ${plural(left, 'field')} before ordering`);
      else ctx.notify(null);
    }
    stopEditing();
  };

  const placeOrder = () => {
    const found = validateForm(form);
    setErrors(found);
    const invalid = FIELDS.findIndex((f) => found[f.name]);
    if (invalid !== -1) {
      const count = Object.keys(found).length;
      setFocus(invalid);
      ctx.notify('error', `Fix ${plural(count, 'field')} before ordering`);
      return;
    }
    ctx.placeOrder({ ...form });
  };

  useInput(
    (input, key) => {
      if (cart.length === 0) {
        if (input === 'b' || key.escape) ctx.navigate('home');
        return;
      }
      if (key.upArrow || input === 'k' || (key.tab && key.shift)) {
        setFocus((f) => Math.max(f - 1, 0));
      } else if (key.downArrow || input === 'j' || key.tab) {
        setFocus((f) => Math.min(f + 1, BUTTON));
      } else if (key.return) {
        if (focus === BUTTON) placeOrder();
        else startEditing();
      } else if (input === 'b' || key.escape) {
        ctx.navigate('cart');
      }
    },
    { isActive: !editing }
  );

  const meta = cartMeta(cart);

  if (cart.length === 0) {
    return h(
      Screen,
      { app: APP_NAME, screen: 'Checkout', meta, hints: [['b', 'back']], message: ctx.message },
      h(
        Panel,
        { title: 'Checkout', focused: true },
        h(EmptyState, { message: 'Your cart is empty.', hint: 'Add items before checkout:', k: 'b', label: 'back' })
      )
    );
  }

  const hints = editing
    ? [['⏎', 'save'], ['esc', 'cancel']]
    : [['↑↓', 'field'], ['⏎', focus === BUTTON ? 'place order' : 'edit'], ['b', 'back']];

  // Order panel rows: edges and padding (4), blank + total (2), blank + button (2).
  const orderHeight = Math.max(rows - 2 - SHIPPING_HEIGHT, 6);
  const maxLines = Math.max(orderHeight - 8, 1);

  return h(
    Screen,
    { app: APP_NAME, screen: 'Checkout', meta, hints, message: ctx.message },
    h(
      Panel,
      { title: 'Shipping', focused: focus !== BUTTON, height: SHIPPING_HEIGHT },
      ...FIELDS.map((field, i) =>
        h(
          Box,
          { key: field.name, height: 2, flexShrink: 0 },
          h(TextField, {
            label: field.label,
            placeholder: field.placeholder,
            value: editing && focus === i ? draft : form[field.name],
            error: errors[field.name],
            focused: focus === i,
            editing: editing && focus === i,
            onChange: setDraft,
            onSubmit: commit,
            onCancel: stopEditing
          })
        )
      )
    ),
    h(
      Panel,
      { title: 'Order', focused: focus === BUTTON },
      h(CartSummary, { cart, maxLines }),
      h(Box, { height: 1 }),
      h(Button, { label: 'Place order', focused: focus === BUTTON })
    )
  );
}
EOL

  # Create Product Model
  echo "📊 Creating data models..."
  cat > src/models/product.js << 'EOL'
export class ProductModel {
  constructor() {
    this.products = [
      {
        id: 'prod_001',
        name: 'Developer Blend',
        description: 'Dark roast for late nights',
        price: 24.99,
        stock: 100
      },
      {
        id: 'prod_002',
        name: 'Terminal Espresso',
        description: 'Quick and powerful',
        price: 19.99,
        stock: 50
      },
      {
        id: 'prod_003',
        name: 'Command Line Coffee',
        description: 'Medium roast, smooth finish',
        price: 21.99,
        stock: 75
      },
      {
        id: 'prod_004',
        name: 'Git Commit Grounds',
        description: 'Light roast with fruity notes',
        price: 22.99,
        stock: 60
      }
    ];
  }

  getAll() {
    return this.products;
  }

  getById(id) {
    return this.products.find(p => p.id === id);
  }
}
EOL

fi  # End of app-type specific files

# Create .env.example
echo "⚙️  Creating configuration files..."
cat > .env.example << 'EOL'
# Server Configuration
SSH_PORT=2222
# Address to listen on: 0.0.0.0 = all interfaces, 127.0.0.1 = this machine only
SSH_HOST=0.0.0.0
HOST_KEY_PATH=./keys/host_key

# Application Configuration
NODE_ENV=development
# The UI uses the 16 ANSI colors. FORCE_COLOR=0 or NO_COLOR=1 turns them off.

# Database (if needed)
# DATABASE_URL=sqlite:./data/app.db
EOL

# Create key generation script
echo "🔐 Creating key generation script..."
cat > scripts/generate-keys.js << 'EOL'
import { generateKeyPairSync } from 'crypto';
import fs from 'fs';
import path from 'path';

// SSH host key for the server. An existing key is kept (clients remember
// it; a new one makes them warn about a changed host). --force replaces it.
const keysDir = path.join(process.cwd(), 'keys');
const keyPath = path.join(keysDir, 'host_key');

if (fs.existsSync(keyPath) && !process.argv.includes('--force')) {
  console.log('✓ Host key already exists at keys/host_key (npm run generate-keys -- --force replaces it)');
  process.exit(0);
}

fs.mkdirSync(keysDir, { recursive: true });

console.log('Generating SSH host key...');

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 3072,
  privateKeyEncoding: {
    type: 'pkcs1',
    format: 'pem'
  }
});

fs.writeFileSync(keyPath, privateKey, { mode: 0o600 });
fs.chmodSync(keyPath, 0o600);

console.log('✓ Host key generated at keys/host_key');
EOL

# Create .gitignore
cat > .gitignore << 'EOL'
node_modules/
.env
keys/
data/*.db
logs/*.log
.DS_Store
*.swp
*.swo
EOL

cat > .dockerignore << 'EOL'
node_modules
keys
.env
.git
EOL

# Create README
echo "📝 Creating README..."
cat > README.md << 'EOL'
# __APP_TITLE__

An SSH terminal app. An [ssh2](https://github.com/mscdex/ssh2) server runs
one [Ink](https://github.com/vadimdemedes/ink) UI per SSH session through
`@shellcraft/ui`, which is copied into this project as `vendor/ui`.
Generated by shellcraft's `init.sh` (`__APP_TYPE__` template).

## Requirements

- Node.js 22 or newer (Ink 8 needs it)
- An SSH client (`ssh` is built into macOS, Linux and Windows 10+)

## Quick start

```bash
npm install
npm test               # unit, screen and SSH tests
npm run generate-keys  # host key for the server (keys/host_key)
cp .env.example .env   # optional: port and listen address
npm start
```

Then connect from another terminal:

```bash
ssh localhost -p 2222
```

`q` quits (except while you type in a field). Ctrl-C always quits.

**Security:** the server lets everyone in, also without a key. It is meant
for local development. Add real authentication in `src/server/auth.js`
before you expose it to a network.

EOL

if [ "$APP_TYPE" = "minimal" ]; then
  cat >> README.md << 'EOL'
## Project structure

```
src/
├── config.js            # APP_NAME for the title bar
├── server/
│   ├── index.js         # SSH server
│   ├── auth.js          # who gets in: a verified key, or anonymous
│   ├── router.js        # passes each shell to serve()
│   └── session.js       # one session per connection
└── ui/
    ├── app.js           # current screen, status message, ctx
    ├── home.js          # Home: menu + detail
    ├── guide.js         # Getting started: scrolling text
    └── session-info.js  # Session: table about this connection
test/
├── unit/                # auth, session, screens, SSH adapter
├── e2e/                 # the real SSH server
└── helpers/
scripts/generate-keys.js # host key
vendor/ui/               # @shellcraft/ui (see below)
```

## Screens

- **Home** (menu + detail): `↑↓ move  ⏎ open  1-2 jump  q quit`
- **Getting started** (scrolling text): `↑↓ scroll  b back  q quit`
- **Session** (table): `b back  q quit`. The terminal size follows resizes.

EOL
else
  cat >> README.md << 'EOL'
## Project structure

```
src/
├── config.js            # APP_NAME for the title bar
├── models/product.js    # products
├── server/
│   ├── index.js         # SSH server
│   ├── auth.js          # who gets in: a verified key, or anonymous
│   ├── router.js        # passes each shell to serve()
│   └── session.js       # one session (and cart) per connection
└── ui/
    ├── app.js           # current screen, status message, cart actions
    ├── home.js          # Home: menu + cart summary
    ├── products.js      # Products table
    ├── cart.js          # Cart table with total
    ├── checkout.js      # Checkout form and validation
    └── cart-summary.js  # cart helpers and the summary block
test/
├── unit/                # product, auth, session, screens, SSH adapter
├── e2e/                 # the real SSH server, shopping workflow
└── helpers/
scripts/generate-keys.js # host key
vendor/ui/               # @shellcraft/ui (see below)
```

## Screens

- **Home** (menu + detail): `↑↓ move  ⏎ select  1-3 jump  q quit`
- **Products** (table): `↑↓ move  a add to cart  c cart  b back`.
  "Added … to cart" appears in the status bar.
- **Cart** (table + total): `↑↓ move  c checkout  x clear cart  b back`
- **Checkout** (form): `↑↓` picks a field, `⏎` edits it (`⏎` saves, `esc`
  cancels). `⏎` on `[ Place order ]` checks the fields and places the
  order. `b back`.

EOL
fi

cat >> README.md << 'EOL'
## How it works

- `src/server/index.js` accepts SSH connections and creates a session for
  each. For every shell it calls `CommandRouter.handleConnection()`.
- `src/server/auth.js` decides who gets in, with `authenticate()` from
  `@shellcraft/ui/auth`. A client with a key must prove that it holds the key; the session then stores the key's fingerprint
  (`SHA256:...`, as `ssh-keygen -l` shows it). A client without a key signs
  in anonymously through keyboard-interactive, without prompts. The `none`
  method alone is not enough: OpenSSH tries it first, and accepting it would
  make every user anonymous.
- `src/server/router.js` passes the channel to `serve()` from
  `@shellcraft/ui`. `serve()` renders the Ink app on the channel. It takes
  care of what SSH needs: the terminal size, CRLF line ends, the 16 ANSI
  colors (also when the server has no TTY), the alternate screen, resize,
  and cleanup on exit or disconnect.
- `src/ui/app.js` holds the current screen and the status bar message.
  Every screen gets `ctx`:

```js
ctx.navigate('home');           // switch screen (clears the message)
ctx.notify('success', 'Saved'); // status bar message; notify(null) clears it
ctx.setTyping(true);            // while a field is edited, q is just a letter
ctx.quit();                     // end the SSH session
ctx.session;                    // this connection: id, fingerprint, username
```

## Adding a screen

```js
// src/ui/hello.js
import React from 'react';
import { Screen, Panel, Text, useInput } from '@shellcraft/ui';
import { APP_NAME } from '../config.js';

const h = React.createElement;

export function HelloScreen({ ctx }) {
  useInput((input, key) => {
    if (input === 'b' || key.escape) ctx.navigate('home');
  });

  return h(
    Screen,
    { app: APP_NAME, screen: 'Hello', hints: [['b', 'back'], ['q', 'quit']], message: ctx.message },
    h(Panel, { title: 'Hello', focused: true }, h(Text, null, 'Hello from Ink.'))
  );
}
```

Add it to `screens` in `src/ui/app.js` (`hello: HelloScreen`) and open it
with `ctx.navigate('hello')`. Add a screen test next to the others in
`test/unit/screens.test.js`.

## Design rules

The screens follow the shellcraft design
([Figma](https://www.figma.com/design/oykSSRdp0xDbaot7ZkLFQc)):

- One title bar and one status bar per screen. `Screen` draws both.
- Key hints read `q quit`: the key, then a lowercase verb.
- Colors only through the theme helpers (`textProps`, `borderProps`), never
  color names in screens.
- No floating boxes or popups. Results go to the status bar (`ctx.notify`).
- No Exit menu items: `q` quits.
- One focused panel at a time.
- Design for 80×24 and check 100×30.

## Tests

```bash
npm test            # everything
npm run test:unit   # fast: no server
npm run test:e2e    # starts the server
```

- `test/unit/screens.test.js` renders every screen with `renderTerminal()`
  from `@shellcraft/ui/testing` at 80×24 and 100×30, presses keys and checks
  rows and styles.
- `test/unit/ssh-adapter.test.js` runs the app through `serve()` on a fake
  SSH channel and checks the bytes a client gets.
- `test/e2e/` starts `src/server/index.js` on a free port with a throwaway
  host key and connects with an ssh2 client.

## vendor/ui

`vendor/ui` is a copy of `@shellcraft/ui` __UI_VERSION__ from shellcraft
(commit __UI_COMMIT__), MIT licensed (`vendor/ui/LICENSE`). Its README lists
the components, the theme and the SSH notes. Its tests stay in shellcraft,
and its `package.json` has no devDependencies here.

`package.json` depends on it with `"@shellcraft/ui": "file:./vendor/ui"`.
npm links `node_modules/@shellcraft/ui` to `vendor/ui`, so a change there
takes effect at once. `vendor/ui` has no `node_modules` of its own and uses
this app's react and ink. Do not run `npm install` inside `vendor/ui`: a
second copy of react breaks the hooks.

To update it, copy `ui/src`, `ui/README.md` and `ui/package.json` (without
its devDependencies) from a newer shellcraft checkout over `vendor/ui`, then
run `npm install` and `npm test`.

## Development

```bash
npm run dev   # restarts the server when files change (nodemon)
```

## Deployment

PM2:

```bash
npm install -g pm2
pm2 start src/server/index.js --name __PACKAGE_NAME__
```

Docker (keep the host key out of the image and mount it):

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
docker build -t __PACKAGE_NAME__ .
docker run -p 2222:2222 -v "$PWD/keys:/app/keys:ro" __PACKAGE_NAME__
```

## Resources

- [Ink](https://github.com/vadimdemedes/ink)
- [ssh2](https://github.com/mscdex/ssh2)
- `vendor/ui/README.md`: components, theme, Ink over SSH
EOL
fill_placeholders README.md

# Create test helpers
echo "🧪 Creating test utilities..."
cat > test/helpers/test-utils.js << 'EOL'
import { strict as assert } from 'assert';

export class TestUtils {
  static async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static assertEqual(actual, expected, message) {
    assert.strictEqual(actual, expected, message);
  }

  static assertExists(value, message) {
    assert.ok(value, message || 'Value should exist');
  }

  static assertArrayIncludes(array, value, message) {
    assert.ok(array.includes(value), message || `Array should include ${value}`);
  }
}
EOL

cat > test/helpers/server.js << 'EOL'
import { spawn } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

/** A free TCP port on 127.0.0.1. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/** A throwaway RSA host key in a temp directory. */
export function tempHostKey() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-host-key-'));
  const file = path.join(dir, 'host_key');
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  });
  fs.writeFileSync(file, privateKey, { mode: 0o600 });
  return { file, remove: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/**
 * Start src/server/index.js on a free port on 127.0.0.1 with a throwaway
 * host key, and wait until it listens. keys/ and .env are not needed.
 * Returns { port, output(), stop() }.
 */
export async function startServer({ timeout = 10000 } = {}) {
  const port = await freePort();
  const key = tempHostKey();
  const child = spawn(process.execPath, ['src/server/index.js'], {
    env: { ...process.env, SSH_PORT: String(port), SSH_HOST: '127.0.0.1', HOST_KEY_PATH: key.file },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.on('data', (data) => { output += data.toString(); });
  child.stderr.on('data', (data) => { output += data.toString(); });

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Server did not start in ${timeout} ms:\n${output}`)), timeout);
      const check = () => {
        if (output.includes('listening')) {
          clearTimeout(timer);
          resolve();
        }
      };
      child.stdout.on('data', check);
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Server exited with code ${code}:\n${output}`));
      });
    });
  } catch (err) {
    child.kill();
    key.remove();
    throw err;
  }

  return {
    port,
    output: () => output,
    async stop() {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = new Promise((resolve) => child.once('exit', resolve));
        child.kill();
        await exited;
      }
      key.remove();
    }
  };
}
EOL

# Create unit tests
echo "🧪 Creating unit tests..."

# Create e-commerce specific tests only if app type is ecommerce
if [ "$APP_TYPE" = "ecommerce" ]; then
  cat > test/unit/product.test.js << 'EOL'
import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { ProductModel } from '../../src/models/product.js';

describe('ProductModel', () => {
  it('should return all products', () => {
    const model = new ProductModel();
    const products = model.getAll();

    assert.ok(Array.isArray(products), 'Should return an array');
    assert.ok(products.length > 0, 'Should have products');
  });

  it('should return a product by id', () => {
    const model = new ProductModel();
    const product = model.getById('prod_001');

    assert.ok(product, 'Should find product');
    assert.strictEqual(product.id, 'prod_001');
    assert.ok(product.name, 'Product should have name');
    assert.ok(typeof product.price === 'number', 'Price should be a number');
  });

  it('should return undefined for non-existent id', () => {
    const model = new ProductModel();
    const product = model.getById('invalid_id');

    assert.strictEqual(product, undefined);
  });

  it('should have required product fields', () => {
    const model = new ProductModel();
    const products = model.getAll();
    const product = products[0];

    assert.ok(product.id, 'Product should have id');
    assert.ok(product.name, 'Product should have name');
    assert.ok(product.description, 'Product should have description');
    assert.ok(typeof product.price === 'number', 'Product should have numeric price');
    assert.ok(typeof product.stock === 'number', 'Product should have numeric stock');
  });
});
EOL

fi  # End of ecommerce-specific unit tests

# Create unit tests for session manager (always created)
cat > test/unit/session.test.js << 'EOL'
import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { SessionManager, fingerprintOf } from '../../src/server/session.js';

describe('SessionManager', () => {
  it('should create a session', () => {
    const manager = new SessionManager();
    const session = manager.createSession(null, 'alice');

    assert.ok(session, 'Should create session');
    assert.ok(session.id, 'Session should have id');
    assert.ok(session.fingerprint, 'Session should have fingerprint');
    assert.ok(session.createdAt instanceof Date, 'Session should have createdAt');
    assert.strictEqual(session.username, 'alice');
  });

  it('should create anonymous session without key', () => {
    const manager = new SessionManager();
    const session = manager.createSession(null);

    assert.strictEqual(session.fingerprint, 'anonymous');
    assert.strictEqual(session.username, null);
  });

  it('should create an OpenSSH-style fingerprint from a public key', () => {
    const manager = new SessionManager();
    const mockKey = { data: Buffer.from('test-key-data') };
    const session = manager.createSession(mockKey);

    assert.match(session.fingerprint, /^SHA256:[A-Za-z0-9+/]{43}$/);
    assert.strictEqual(session.fingerprint, fingerprintOf(mockKey), 'same key, same fingerprint');
    assert.notStrictEqual(fingerprintOf({ data: Buffer.from('other') }), session.fingerprint);
  });

  it('should retrieve existing session', () => {
    const manager = new SessionManager();
    const session = manager.createSession(null);
    const retrieved = manager.getSession(session.id);

    assert.deepStrictEqual(retrieved, session);
  });

  it('should destroy session', () => {
    const manager = new SessionManager();
    const session = manager.createSession(null);

    manager.destroySession(session.id);
    const retrieved = manager.getSession(session.id);

    assert.strictEqual(retrieved, undefined);
  });

  it('should give every session its own id', () => {
    const manager = new SessionManager();
    const ids = new Set(Array.from({ length: 20 }, () => manager.createSession(null).id));

    assert.strictEqual(ids.size, 20);
  });
});
EOL

cat > test/unit/auth.test.js << 'EOL'
import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { generateKeyPairSync } from 'crypto';
import ssh2 from 'ssh2';
import { authenticate, AUTH_METHODS } from '../../src/server/auth.js';
import { fingerprintOf } from '../../src/server/session.js';

const { utils } = ssh2;

/** A fake ssh2 authentication context that records the answer. */
function fakeCtx(method, extra = {}) {
  const ctx = { method, username: 'alice', result: null, ...extra };
  ctx.accept = () => { ctx.result = 'accept'; };
  ctx.reject = (methods) => { ctx.result = 'reject'; ctx.offered = methods; };
  return ctx;
}

function clientKey() {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  });
  const key = utils.parseKey(privateKey);
  return { key, publicKey: { algo: key.type, data: key.getPublicSSH() } };
}

describe('authenticate', () => {
  it('rejects none and passwords, offering publickey and keyboard-interactive', () => {
    for (const method of ['none', 'password', 'hostbased']) {
      const ctx = fakeCtx(method);
      authenticate(ctx);
      assert.equal(ctx.result, 'reject', method);
      assert.deepEqual(ctx.offered, AUTH_METHODS);
    }
  });

  it('lets a client without a key in through keyboard-interactive, without prompts', () => {
    const ctx = fakeCtx('keyboard-interactive');
    let key = null;
    authenticate(ctx, (k) => { key = k; });
    assert.equal(ctx.result, 'accept');
    assert.equal(key, null, 'anonymous');
  });

  it('answers a key query without a signature, but does not trust the key yet', () => {
    const { publicKey } = clientKey();
    const ctx = fakeCtx('publickey', { key: publicKey });
    let key = null;
    authenticate(ctx, (k) => { key = k; });
    assert.equal(ctx.result, 'accept');
    assert.equal(key, null);
  });

  it('accepts a key with a valid signature and reports it', () => {
    const { key: privateKey, publicKey } = clientKey();
    const blob = Buffer.from('session id and request');
    const ctx = fakeCtx('publickey', { key: publicKey, blob, signature: privateKey.sign(blob) });
    let key = null;
    authenticate(ctx, (k) => { key = k; });
    assert.equal(ctx.result, 'accept');
    assert.equal(key, publicKey);
    assert.match(fingerprintOf(key), /^SHA256:/);
  });

  it('rejects a key whose signature does not match', () => {
    const { publicKey } = clientKey();
    const other = clientKey().key;
    const blob = Buffer.from('session id and request');
    const ctx = fakeCtx('publickey', { key: publicKey, blob, signature: other.sign(blob) });
    let key = null;
    authenticate(ctx, (k) => { key = k; });
    assert.equal(ctx.result, 'reject');
    assert.equal(key, null);
  });
});
EOL

if [ "$APP_TYPE" = "ecommerce" ]; then
  cat >> test/unit/session.test.js << 'EOL'

describe('SessionManager carts', () => {
  it('should start with an empty cart', () => {
    const session = new SessionManager().createSession(null);

    assert.ok(Array.isArray(session.cart), 'Session should have cart array');
    assert.strictEqual(session.cart.length, 0);
  });

  it('should maintain separate session carts', () => {
    const manager = new SessionManager();
    const session1 = manager.createSession(null);
    const session2 = manager.createSession(null);

    session1.cart.push({ id: 'item1' });
    session2.cart.push({ id: 'item2' });

    assert.strictEqual(session1.cart.length, 1);
    assert.strictEqual(session2.cart.length, 1);
    assert.notDeepStrictEqual(session1.cart, session2.cart);
  });
});
EOL
fi

# Screen tests and SSH adapter tests (ui testing helpers)
echo "🧪 Creating screen tests..."
if [ "$APP_TYPE" = "minimal" ]; then
  cat > test/unit/screens.test.js << 'EOL'
import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'assert';
import React from 'react';
import { renderTerminal, cleanupTerminals, styleAt, styleAtCell, boldDimText, tick } from '@shellcraft/ui/testing';
import { App } from '../../src/ui/app.js';
import { SessionManager } from '../../src/server/session.js';
import { APP_NAME } from '../../src/config.js';

const h = React.createElement;

afterEach(() => cleanupTerminals());

async function open({ columns = 80, rows = 24, initialScreen } = {}) {
  const session = new SessionManager().createSession(null, 'tester');
  const t = renderTerminal(h(App, { session, initialScreen }), { columns, rows });
  await tick(20);
  return { t, session };
}

const width = (line) => Array.from(line).length;
const statusRow = (t) => t.lines().at(-1);

/** Every frame is a full screen: title on row 0, a panel, status on the last row. */
function assertScreen(t, columns, rows, screen) {
  const lines = t.lines();
  assert.equal(lines.length, rows, `${screen}: ${rows} rows`);
  for (const [i, line] of lines.entries()) {
    assert.ok(width(line) <= columns, `${screen}: row ${i} is ${width(line)} wide: "${line}"`);
  }
  assert.ok(lines[0].startsWith(` ${APP_NAME} › ${screen}`), `row 0: "${lines[0]}"`);
  assert.ok(lines[1].startsWith('╭─ '), `row 1: "${lines[1]}"`);
  assert.ok(lines[rows - 2].startsWith('╰'), `row ${rows - 2}: "${lines[rows - 2]}"`);
  assert.equal(boldDimText(t.lastFrame()), '', `${screen}: nothing is bold and dim at once`);
  return lines;
}

describe('Screens (80x24)', () => {
  it('home: menu + detail, one focused panel, q quit hint, no Exit item', async () => {
    const { t } = await open();
    const lines = assertScreen(t, 80, 24, 'Home');
    assert.ok(lines[0].endsWith('user: tester'), `meta: "${lines[0]}"`);
    assert.ok(lines[1].startsWith('╭─ Menu ─'));
    assert.ok(lines[1].includes('╮╭─ Getting started ─'));
    assert.ok(lines[2].startsWith('│ › Getting started        1 │'), lines[2]);
    assert.ok(lines[3].startsWith('│   Session                2 │'), lines[3]);
    assert.ok(t.text().includes('Where the code lives'));
    assert.ok(!t.text().includes('Exit'), 'no Exit item');
    assert.equal(statusRow(t), ' ↑↓ move  ⏎ open  1-2 jump  q quit');

    const raw = t.lastFrame();
    assert.equal(styleAt(raw, 'Menu').fg, 'cyan', 'menu panel has focus');
    assert.equal(styleAt(raw, '╭', 1).fg, undefined, 'only one focused panel');
    assert.equal(styleAt(raw, '╭', 1).dim, true, 'the other border is dim');
    // Row 1 has the detail panel's title; the selected menu row comes next.
    assert.deepEqual(styleAt(raw, 'Getting started', 1), { fg: 'black', bg: 'cyan', bold: true, dim: false, underline: false });
    assert.deepEqual(styleAt(raw, 'q quit'), { fg: 'cyan', bg: undefined, bold: true, dim: false, underline: false }, 'key: bold accent');
    assert.equal(styleAtCell(raw, 23, statusRow(t).indexOf(' quit') + 1).dim, true, 'verb: muted');
  });

  it('the detail panel follows the selection', async () => {
    const { t } = await open();
    await t.press('down');
    assert.ok(t.lines()[1].includes('╭─ Session ─'), t.lines()[1]);
    assert.ok(t.text().includes('This connection: session id'));
  });

  it('⏎ opens Getting started, b goes back', async () => {
    const { t } = await open();
    await t.press('enter');
    await tick(20);
    const lines = assertScreen(t, 80, 24, 'Getting started');
    assert.ok(lines[1].startsWith('╭─ Getting started ─'));
    assert.ok(t.text().includes('How this app works'));
    assert.equal(statusRow(t), ' ↑↓ scroll  b back  q quit');
    await t.press('b');
    assertScreen(t, 80, 24, 'Home');
  });

  it('2 + ⏎ opens Session with the connection details, esc goes back', async () => {
    const { t, session } = await open();
    await t.press('2', 'enter');
    const lines = assertScreen(t, 80, 24, 'Session');
    assert.ok(lines[2].startsWith('│ Field        Value'), lines[2]);
    const text = t.text();
    assert.ok(text.includes(session.id));
    assert.ok(text.includes('User         tester'));
    assert.ok(text.includes('Key          anonymous'));
    assert.ok(text.includes('Terminal     80×24'));
    assert.equal(statusRow(t), ' b back  q quit');
    assert.equal(styleAt(t.lastFrame(), 'Field').underline, true, 'table header underlined');
    await t.press('escape');
    assertScreen(t, 80, 24, 'Home');
  });

  it('q quits from any screen', async () => {
    const { t } = await open({ initialScreen: 'session' });
    let exited = false;
    t.waitUntilExit().then(() => { exited = true; });
    await t.press('q');
    await tick(20);
    assert.equal(exited, true);
  });
});

describe('Screens (100x30)', () => {
  it('every screen fills the terminal', async () => {
    const { t } = await open({ columns: 100, rows: 30 });
    assertScreen(t, 100, 30, 'Home');
    await t.press('enter');
    await tick(20);
    assertScreen(t, 100, 30, 'Getting started');
    await t.press('b', '2', 'enter');
    assertScreen(t, 100, 30, 'Session');
    assert.ok(t.text().includes('Terminal     100×30'));
  });

  it('the session screen follows a resize', async () => {
    const { t } = await open({ initialScreen: 'session' });
    assert.ok(t.text().includes('Terminal     80×24'));
    await t.resize(100, 30);
    assertScreen(t, 100, 30, 'Session');
    assert.ok(t.text().includes('Terminal     100×30'));
  });
});
EOL

  cat > test/unit/ssh-adapter.test.js << 'EOL'
import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { FakeSshChannel, FakeSshSession, stripAnsi, keys, tick } from '@shellcraft/ui/testing';
import { CommandRouter } from '../../src/server/router.js';
import { SessionManager } from '../../src/server/session.js';
import { APP_NAME } from '../../src/config.js';

// The router hands the SSH channel to serve(); check the bytes a client
// would receive, with a fake duplex stream as the channel.
describe('SSH adapter (fake channel)', () => {
  it('renders the app, follows keys and resizes, quits on q', async () => {
    const channel = new FakeSshChannel((_text, callback) => callback());
    const sshSession = new FakeSshSession();
    const session = new SessionManager().createSession(null, 'tester');
    const cleanup = new CommandRouter().handleConnection(channel, session, { cols: 80, rows: 24 }, sshSession);
    await tick(80);

    let out = channel.takeOutput();
    assert.ok(out.startsWith('\u001B[?1049h'), 'alternate screen');
    assert.ok(out.includes('\u001B[36m'), 'ANSI colors without a TTY');
    assert.ok(!/[^\r]\n/.test(out), 'CRLF line ends');
    assert.ok(stripAnsi(out).includes(`${APP_NAME} › Home`));
    assert.ok(stripAnsi(out).includes('Getting started'));

    channel.type('2');
    await tick(80);
    channel.type(keys.enter);
    await tick(80);
    out = stripAnsi(channel.takeOutput());
    assert.ok(out.includes('80×24'), out);

    assert.equal(sshSession.windowChange(100, 30), true);
    await tick(80);
    assert.equal(channel.columns, 100);
    assert.equal(channel.rows, 30);
    out = channel.takeOutput();
    assert.equal(stripAnsi(out).split('\r\n').length, 30, 'redrawn at 30 rows');

    channel.type('q');
    await cleanup.exited;
    assert.ok(channel.output.join('').includes('\u001B[?1049l'), 'leaves the alternate screen');
    assert.equal(channel.writableEnded, true);
    assert.equal(channel.exitCode, 0);
  });

  it('Ctrl-C ends the session; a disconnect does not throw', async () => {
    const session = new SessionManager().createSession(null);
    const a = new FakeSshChannel((_t, cb) => cb());
    const cleanupA = new CommandRouter().handleConnection(a, session, null);
    await tick(50);
    a.type(keys.ctrlC);
    await cleanupA.exited;
    assert.equal(a.writableEnded, true);

    const b = new FakeSshChannel((_t, cb) => cb());
    const cleanupB = new CommandRouter().handleConnection(b, session, { cols: 80, rows: 24 });
    await tick(50);
    assert.doesNotThrow(() => b.disconnect());
    await cleanupB.exited;
    assert.equal(b.writesAfterClose, 0);
  });
});
EOL

else
  cat > test/unit/screens.test.js << 'EOL'
import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'assert';
import React from 'react';
import { renderTerminal, cleanupTerminals, styleAt, boldDimText, tick } from '@shellcraft/ui/testing';
import { App } from '../../src/ui/app.js';
import { SessionManager } from '../../src/server/session.js';
import { ProductModel } from '../../src/models/product.js';
import { validateField, validateForm } from '../../src/ui/checkout.js';
import { APP_NAME } from '../../src/config.js';

const h = React.createElement;

afterEach(() => cleanupTerminals());

async function open({ columns = 80, rows = 24, session = new SessionManager().createSession(null), initialScreen } = {}) {
  const t = renderTerminal(h(App, { session, initialScreen }), { columns, rows });
  await tick(20);
  return { t, session };
}

const width = (line) => Array.from(line).length;
const statusRow = (t) => t.lines().at(-1);
const typeText = (t, text) => t.press(...Array.from(text));

/** Every frame is a full screen: title on row 0, a panel, status on the last row. */
function assertScreen(t, columns, rows, screen) {
  const lines = t.lines();
  assert.equal(lines.length, rows, `${screen}: ${rows} rows`);
  for (const [i, line] of lines.entries()) {
    assert.ok(width(line) <= columns, `${screen}: row ${i} is ${width(line)} wide: "${line}"`);
  }
  assert.ok(lines[0].startsWith(` ${APP_NAME} › ${screen}`), `row 0: "${lines[0]}"`);
  assert.ok(lines[1].startsWith('╭─ '), `row 1: "${lines[1]}"`);
  assert.ok(lines[rows - 2].startsWith('╰'), `row ${rows - 2}: "${lines[rows - 2]}"`);
  assert.equal(boldDimText(t.lastFrame()), '', `${screen}: nothing is bold and dim at once`);
  return lines;
}

describe('Shop screens (80x24)', () => {
  it('home: menu panel focused, cart detail, q quit hint, no Exit item', async () => {
    const { t } = await open();
    const lines = assertScreen(t, 80, 24, 'Home');
    assert.ok(lines[0].endsWith('cart: empty'), `meta: "${lines[0]}"`);
    assert.ok(lines[1].startsWith('╭─ Menu ─'));
    assert.ok(lines[1].includes('╮╭─ Cart ─'));
    assert.ok(lines[2].startsWith('│ › Browse products        1 │'));
    assert.ok(lines[3].startsWith('│   View cart              2 │'));
    assert.ok(lines[4].startsWith('│   Checkout               3 │'));
    assert.ok(!t.text().includes('Exit'), 'no Exit item');
    assert.ok(t.text().includes('Your cart is empty.'));
    assert.equal(statusRow(t), ' ↑↓ move  ⏎ select  1-3 jump  q quit');

    const raw = t.lastFrame();
    assert.equal(styleAt(raw, 'Menu').fg, 'cyan', 'menu panel has focus');
    assert.equal(styleAt(raw, 'Cart').fg, undefined, 'detail panel title default color');
    assert.equal(styleAt(raw, '╭').fg, 'cyan');
    assert.equal(styleAt(raw, '╭', 1).fg, undefined, 'only one focused panel');
    assert.equal(styleAt(raw, '╭', 1).dim, true, 'the other border is dim');
    assert.deepEqual(styleAt(raw, 'Browse products'), { fg: 'black', bg: 'cyan', bold: true, dim: false, underline: false });
  });

  it('browse → add → cart → checkout with one invalid email → order placed', async () => {
    const { t, session } = await open();

    // Home → Products
    await t.press('enter');
    let lines = assertScreen(t, 80, 24, 'Products');
    assert.ok(lines[2].startsWith('│ ID         Name                     Description'));
    assert.ok(lines[2].endsWith('Price │'));
    assert.ok(lines[3].startsWith('│ prod_001   Developer Blend          Dark roast for late nights'));
    assert.ok(lines[3].endsWith('$24.99 │'));
    assert.equal(statusRow(t), ' ↑↓ move  a add to cart  c cart  b back');
    assert.deepEqual(styleAt(t.lastFrame(), 'prod_001'), { fg: 'black', bg: 'cyan', bold: true, dim: false, underline: false });

    // Add two products; the result is a status bar message, not a box.
    await t.press('a');
    assert.ok(statusRow(t).endsWith('✓ Added Developer Blend to cart'), statusRow(t));
    assert.equal(styleAt(t.lastFrame(), 'Added').fg, 'green');
    assert.ok(t.lines()[0].endsWith('cart: 1 · $24.99'));
    await t.press('down', 'a');
    assert.ok(statusRow(t).endsWith('✓ Added Terminal Espresso to cart'));
    assert.equal(session.cart.length, 2);
    assert.ok(!t.text().includes('┌') && t.lines().filter((l) => l.includes('╭')).length === 1, 'no floating box');

    // Cart
    await t.press('c');
    lines = assertScreen(t, 80, 24, 'Cart');
    assert.ok(lines[2].startsWith('│ Product'));
    assert.ok(lines[2].endsWith('Qty     Price   Subtotal │'));
    assert.ok(lines[3].startsWith('│ Developer Blend'));
    assert.ok(lines[3].endsWith('1    $24.99     $24.99 │'));
    assert.ok(lines[4].startsWith('│ Terminal Espresso'));
    assert.equal(lines[5], `│${' '.repeat(78)}│`);
    assert.ok(lines[6].startsWith('│ Total'));
    assert.ok(lines[6].endsWith('$44.98 │'));
    assert.equal(styleAt(t.lastFrame(), 'Total').bold, true);
    assert.equal(statusRow(t), ' ↑↓ move  c checkout  x clear cart  b back');

    // Checkout
    await t.press('c');
    lines = assertScreen(t, 80, 24, 'Checkout');
    assert.ok(lines[1].startsWith('╭─ Shipping ─'));
    assert.ok(lines[3].startsWith('│ Name       Your name'));
    assert.ok(lines[5].startsWith('│ Email      you@example.com'));
    assert.ok(lines[7].startsWith('│ Address    Street, city'));
    assert.ok(lines[11].startsWith('╭─ Order ─'));
    assert.ok(t.text().includes('Developer Blend         1 × $24.99'));
    assert.ok(t.text().includes('Total                   $44.98'));
    assert.ok(t.text().includes('[ Place order ]'));
    const before = t.lastFrame();
    assert.equal(styleAt(before, 'Developer Blend').dim, true, 'order lines: muted name');
    assert.deepEqual(styleAt(before, 'Total'), { fg: undefined, bg: undefined, bold: true, dim: false, underline: false });
    assert.equal(styleAt(before, 'Your name').dim, true, 'placeholder is muted');
    assert.equal(statusRow(t), ' ↑↓ field  ⏎ edit  b back');
    assert.equal(styleAt(before, 'Name').fg, 'cyan', 'first field focused');

    // Name: ⏎ edit, type, ⏎ save
    await t.press('enter');
    assert.equal(statusRow(t), ' ⏎ save  esc cancel');
    await typeText(t, 'Marko M.');
    assert.ok(t.lines()[3].startsWith('│ Name       Marko M.█'));
    await t.press('enter');
    assert.ok(t.lines()[3].startsWith('│ Name       Marko M. '));

    // Email: an invalid address
    await t.press('down', 'enter');
    await typeText(t, 'marko@');
    await t.press('enter');

    // Address; q while typing is text, not quit
    await t.press('down', 'enter');
    await typeText(t, 'Main Street 1 q');
    await t.press('backspace', 'backspace', 'enter');
    assert.ok(t.lines()[7].startsWith('│ Address    Main Street 1 '), t.lines()[7]);

    // [ Place order ]
    await t.press('down');
    assert.equal(statusRow(t), ' ↑↓ field  ⏎ place order  b back');
    let raw = t.lastFrame();
    assert.deepEqual(styleAt(raw, '[ Place order ]'), { fg: 'black', bg: 'cyan', bold: true, dim: false, underline: false });
    assert.equal(styleAt(raw, 'Order').fg, 'cyan', 'Order panel focused with its button');
    assert.equal(styleAt(raw, 'Shipping').fg, undefined);

    await t.press('enter');
    lines = assertScreen(t, 80, 24, 'Checkout');
    assert.ok(lines[5].startsWith('│ Email      marko@'));
    assert.equal(lines[6], `│            ✗ Enter a full address${' '.repeat(44)}│`);
    assert.ok(statusRow(t).endsWith('✗ Fix 1 field before ordering'), statusRow(t));
    raw = t.lastFrame();
    assert.deepEqual(styleAt(raw, 'Email'), { fg: 'red', bg: undefined, bold: true, dim: false, underline: false });
    assert.equal(styleAt(raw, '✗ Enter').fg, 'red');
    assert.equal(session.cart.length, 2, 'nothing ordered yet');

    // Focus moved to the invalid field: fix it.
    await t.press('enter');
    await typeText(t, 'example.com');
    await t.press('enter');
    assert.ok(t.lines()[5].startsWith('│ Email      marko@example.com'));
    assert.equal(t.lines()[6], `│${' '.repeat(78)}│`, 'error line gone');
    assert.equal(statusRow(t), ' ↑↓ field  ⏎ edit  b back');

    await t.press('down', 'down', 'enter');
    assertScreen(t, 80, 24, 'Home');
    assert.ok(statusRow(t).endsWith('✓ Order placed: 2 items, $44.98'), statusRow(t));
    assert.equal(session.cart.length, 0);
    assert.equal(session.orders.length, 1);
    assert.deepEqual(session.orders[0].shipping, { name: 'Marko M.', email: 'marko@example.com', address: 'Main Street 1' });
    assert.equal(session.checkoutFormData, undefined);
  });

  it('esc cancels an edit and keeps the old value', async () => {
    const session = new SessionManager().createSession(null);
    session.cart.push(new ProductModel().getAll()[0]);
    session.checkoutFormData = { name: 'Ada', email: '', address: '' };
    const { t } = await open({ session, initialScreen: 'checkout' });
    assert.ok(t.lines()[3].startsWith('│ Name       Ada'));
    await t.press('enter');
    await typeText(t, 'xyz');
    await t.press('escape');
    assert.ok(t.lines()[3].startsWith('│ Name       Ada '), t.lines()[3]);
    assert.equal(statusRow(t), ' ↑↓ field  ⏎ edit  b back');
    // b goes back to the cart
    await t.press('b');
    assertScreen(t, 80, 24, 'Cart');
  });

  it('cart: x clears, c on an empty cart warns, empty state says what to do', async () => {
    const session = new SessionManager().createSession(null);
    session.cart.push(new ProductModel().getAll()[1]);
    const { t } = await open({ session, initialScreen: 'cart' });
    await t.press('x');
    assert.equal(session.cart.length, 0);
    assert.ok(statusRow(t).endsWith('i Cart cleared'));
    assert.ok(t.text().includes('Your cart is empty.'));
    assert.ok(t.text().includes('Browse products from the menu: b back'));
    await t.press('c');
    assertScreen(t, 80, 24, 'Cart');
    assert.ok(statusRow(t).endsWith('! Cart is empty'));
    assert.equal(styleAt(t.lastFrame(), '! Cart').fg, 'yellow');
    assert.ok(!t.lastFrame().includes('\u001B[31m'), 'an empty cart is not an error: no red');
    await t.press('escape');
    assertScreen(t, 80, 24, 'Home');
  });

  it('checkout with an empty cart shows the empty state', async () => {
    const { t } = await open();
    await t.press('3', 'enter');
    assertScreen(t, 80, 24, 'Checkout');
    assert.ok(t.text().includes('Your cart is empty.'));
    assert.ok(t.text().includes('Add items before checkout: b back'));
    assert.equal(statusRow(t), ' b back');
    await t.press('b');
    assertScreen(t, 80, 24, 'Home');
  });

  it('q quits from any screen', async () => {
    const { t } = await open();
    await t.press('enter');
    let exited = false;
    t.waitUntilExit().then(() => { exited = true; });
    await t.press('q');
    await tick(20);
    assert.equal(exited, true);
  });
});

describe('Shop screens (100x30)', () => {
  it('every screen fills the terminal', async () => {
    const { t } = await open({ columns: 100, rows: 30 });
    assertScreen(t, 100, 30, 'Home');
    await t.press('enter');
    const lines = assertScreen(t, 100, 30, 'Products');
    assert.ok(lines[3].endsWith('$24.99 │'), 'price column stays at the right edge');
    await t.press('a', 'c');
    assertScreen(t, 100, 30, 'Cart');
    await t.press('c');
    assert.ok(assertScreen(t, 100, 30, 'Checkout')[11].startsWith('╭─ Order ─'), 'shipping panel keeps its height');
  });
});

describe('Checkout validation', () => {
  it('flags empty fields and a partial email', () => {
    assert.equal(validateField('name', ' '), 'Enter your name');
    assert.equal(validateField('email', ''), 'Enter your email');
    assert.equal(validateField('email', 'marko@'), 'Enter a full address');
    assert.equal(validateField('email', 'marko@example'), 'Enter a full address');
    assert.equal(validateField('email', 'marko@example.com'), null);
    assert.equal(validateField('address', ''), 'Enter a shipping address');
    assert.deepEqual(validateForm({ name: 'A', email: 'a@b.co', address: 'X' }), {});
    assert.deepEqual(Object.keys(validateForm({})), ['name', 'email', 'address']);
  });
});
EOL

  cat > test/unit/ssh-adapter.test.js << 'EOL'
import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { FakeSshChannel, FakeSshSession, stripAnsi, keys, tick } from '@shellcraft/ui/testing';
import { CommandRouter } from '../../src/server/router.js';
import { SessionManager } from '../../src/server/session.js';
import { APP_NAME } from '../../src/config.js';

// The router hands the SSH channel to serve(); check the bytes a client
// would receive, with a fake duplex stream as the channel.
describe('SSH adapter (fake channel)', () => {
  it('renders the shop, follows keys and resizes, quits on q', async () => {
    const channel = new FakeSshChannel((_text, callback) => callback());
    const sshSession = new FakeSshSession();
    const session = new SessionManager().createSession(null);
    const cleanup = new CommandRouter().handleConnection(channel, session, { cols: 80, rows: 24 }, sshSession);
    await tick(80);

    let out = channel.takeOutput();
    assert.ok(out.startsWith('\u001B[?1049h'), 'alternate screen');
    assert.ok(out.includes('\u001B[36m'), 'ANSI colors without a TTY');
    assert.ok(!/[^\r]\n/.test(out), 'CRLF line ends');
    assert.ok(stripAnsi(out).includes(`${APP_NAME} › Home`));
    assert.ok(stripAnsi(out).includes('Browse products'));

    channel.type(keys.enter);
    await tick(80);
    channel.type('a');
    await tick(80);
    out = stripAnsi(channel.takeOutput());
    assert.ok(out.includes('Added Developer Blend to cart'), out);
    assert.equal(session.cart.length, 1);

    assert.equal(sshSession.windowChange(100, 30), true);
    await tick(80);
    assert.equal(channel.columns, 100);
    assert.equal(channel.rows, 30);
    out = channel.takeOutput();
    assert.equal(stripAnsi(out).split('\r\n').length, 30, 'redrawn at 30 rows');

    channel.type('q');
    await cleanup.exited;
    assert.ok(channel.output.join('').includes('\u001B[?1049l'), 'leaves the alternate screen');
    assert.equal(channel.writableEnded, true);
    assert.equal(channel.exitCode, 0);
  });

  it('Ctrl-C ends the session; a disconnect does not throw', async () => {
    const session = new SessionManager().createSession(null);
    const a = new FakeSshChannel((_t, cb) => cb());
    const cleanupA = new CommandRouter().handleConnection(a, session, null);
    await tick(50);
    a.type(keys.ctrlC);
    await cleanupA.exited;
    assert.equal(a.writableEnded, true);

    const b = new FakeSshChannel((_t, cb) => cb());
    const cleanupB = new CommandRouter().handleConnection(b, session, { cols: 80, rows: 24 });
    await tick(50);
    assert.doesNotThrow(() => b.disconnect());
    await cleanupB.exited;
    assert.equal(b.writesAfterClose, 0);
  });
});
EOL
fi

# Create E2E test
echo "🧪 Creating E2E tests..."
cat > test/e2e/server.test.js << 'EOL'
import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'assert';
import { generateKeyPairSync } from 'crypto';
import ssh2 from 'ssh2';
import { startServer } from '../helpers/server.js';
import { APP_NAME } from '../../src/config.js';

const { Client } = ssh2;

// CSI sequences (colors, cursor moves) removed.
// eslint-disable-next-line no-control-regex
const plain = (text) => text.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '');

describe('SSH server (e2e)', () => {
  let server;

  before(async () => {
    server = await startServer();
  });

  after(async () => {
    await server?.stop();
  });

  /**
   * Connect a client; run(conn, resolve, reject) once it is ready. Without
   * a key the client signs in anonymously (keyboard-interactive, no prompts).
   */
  function withClient(run, options = {}) {
    const conn = new Client();
    conn.on('keyboard-interactive', (_name, _instructions, _lang, _prompts, finish) => finish([]));
    return new Promise((resolve, reject) => {
      conn.on('ready', () => run(conn, resolve, reject));
      conn.on('error', reject);
      conn.connect({
        host: '127.0.0.1',
        port: server.port,
        username: 'test',
        tryKeyboard: true,
        readyTimeout: 5000,
        ...options
      });
    }).finally(() => conn.end());
  }

  it('lets a client without a key in (keyboard-interactive, no prompts)', { timeout: 15000 }, async () => {
    await withClient((_conn, resolve) => resolve());
  });

  it('accepts a client key (the server checks the signature)', { timeout: 15000 }, async () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
    });
    await withClient((_conn, resolve) => resolve(), { privateKey, tryKeyboard: false });
  });

  it('does not accept the none method alone', { timeout: 15000 }, async () => {
    await assert.rejects(
      withClient((_conn, resolve) => resolve(), { tryKeyboard: false }),
      /authentication methods failed/
    );
  });

  it('opens a shell for an anonymous client', { timeout: 15000 }, async () => {
    await withClient((conn, resolve, reject) => {
      conn.shell((err, stream) => {
        if (err) return reject(err);
        stream.end();
        resolve();
      });
    });
  });

  it('renders the home screen in a pty, follows a resize and quits on q', { timeout: 15000 }, async () => {
    const result = await withClient((conn, resolve, reject) => {
      conn.shell({ cols: 80, rows: 24, term: 'xterm-256color' }, (err, stream) => {
        if (err) return reject(err);
        let output = '';
        let step = 'home';
        let exitCode = null;
        stream.on('exit', (code) => { exitCode = code; });
        stream.on('data', (data) => {
          output += data.toString();
          if (step === 'home' && plain(output).includes(`${APP_NAME} › Home`)) {
            step = 'resize';
            output = '';
            stream.setWindow(30, 100, 0, 0);
          } else if (step === 'resize' && plain(output).split('\r\n').length >= 30) {
            step = 'quit';
            stream.write('q');
          }
        });
        stream.on('close', () => resolve({ step, output, exitCode }));
      });
    });

    assert.equal(result.step, 'quit', 'went through home and resize');
    assert.ok(result.output.includes('\u001B[?1049l'), 'left the alternate screen');
    assert.equal(result.exitCode, 0);
  });
});
EOL

# Create e-commerce specific integration tests
if [ "$APP_TYPE" = "ecommerce" ]; then
  cat > test/e2e/workflow.test.js << 'EOL'
import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { ProductModel } from '../../src/models/product.js';
import { SessionManager } from '../../src/server/session.js';

describe('E-commerce Workflow', () => {
  it('should complete full shopping workflow', () => {
    // 1. Create session
    const sessionManager = new SessionManager();
    const session = sessionManager.createSession(null);
    assert.ok(session, 'Session should be created');

    // 2. Browse products
    const productModel = new ProductModel();
    const products = productModel.getAll();
    assert.ok(products.length > 0, 'Should have products');

    // 3. Add products to cart
    const product1 = products[0];
    const product2 = products[1];
    session.cart.push(product1);
    session.cart.push(product2);
    assert.strictEqual(session.cart.length, 2, 'Cart should have 2 items');

    // 4. Calculate total
    const total = session.cart.reduce((sum, item) => sum + item.price, 0);
    assert.ok(total > 0, 'Total should be positive');
    assert.strictEqual(
      total,
      product1.price + product2.price,
      'Total should match sum of prices'
    );

    // 5. Clear cart (simulate checkout)
    session.cart = [];
    assert.strictEqual(session.cart.length, 0, 'Cart should be empty after checkout');

    // 6. Clean up session
    sessionManager.destroySession(session.id);
    const retrieved = sessionManager.getSession(session.id);
    assert.strictEqual(retrieved, undefined, 'Session should be destroyed');
  });

  it('should handle multiple concurrent sessions', () => {
    const sessionManager = new SessionManager();
    const productModel = new ProductModel();

    // Create multiple sessions
    const sessions = [];
    for (let i = 0; i < 5; i++) {
      sessions.push(sessionManager.createSession(null));
    }

    assert.strictEqual(sessions.length, 5, 'Should create 5 sessions');

    // Each session adds different products
    const products = productModel.getAll();
    sessions.forEach((session, index) => {
      if (products[index]) {
        session.cart.push(products[index]);
      }
    });

    // Verify isolation
    sessions.forEach((session, index) => {
      assert.strictEqual(
        session.cart.length,
        products[index] ? 1 : 0,
        `Session ${index} should have correct cart`
      );
    });

    // Clean up
    sessions.forEach(session => {
      sessionManager.destroySession(session.id);
    });
  });
});
EOL

fi  # End of ecommerce-specific E2E tests

# Node version check (the app needs Node 22+, Ink 8's engine range)
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "$NODE_MAJOR" -lt 22 ] 2>/dev/null; then
    echo ""
    echo "⚠️  Found Node $(node -v). The app needs Node 22 or newer (Ink 8)."
  fi
else
  echo ""
  echo "⚠️  node is not on PATH. Install Node 22 or newer to run the app."
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   cd $PROJECT_NAME"
echo "   npm install"
echo "   npm test               # unit, screen and SSH tests"
echo "   npm run generate-keys  # host key for npm start"
echo "   npm start"
echo ""
echo "🎉 Then connect with: ssh localhost -p 2222"
echo ""
