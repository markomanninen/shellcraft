# Demo Shop

A complete template for building SSH-based terminal applications with TUI (Text User Interface).

## 🌟 Features

- **SSH Server**: Built with ssh2 for secure remote access
- **TUI Framework**: Ink (React for the terminal) through the shared `@shellcraft/ui` package
- **Session Management**: User session tracking with public key authentication
- **Component Library**: Reusable UI components (lists, tables, forms, buttons)
- **Navigation System**: Easy screen-to-screen routing
- **Example Shop**: Full e-commerce flow (products, cart, checkout)

## 🏗️ Architecture

```
src/
├── server/          # SSH server and routing
│   ├── index.js     # Main server entry point
│   ├── router.js    # Hands each SSH shell to the Ink app (serve())
│   └── session.js   # Session management
├── ui/              # User interface screens (Ink components)
│   ├── app.js       # ShopApp: current screen, status message, cart actions
│   ├── home.js      # Home screen (menu + cart summary)
│   ├── products.js  # Products table
│   ├── cart.js      # Shopping cart table
│   ├── checkout.js  # Checkout form and validation
│   └── cart-summary.js # Cart helpers and the cart summary block
└── models/          # Data models
    └── product.js   # Product data model
```

## 🚀 Quick Start

If your shell does not auto-load Node/npm, use the local wrapper:
```bash
./npmw --version
```

1. **Install dependencies**:
   ```bash
   ./npmw install
   ```

2. **Generate SSH host keys**:
   ```bash
   ./npmw run generate-keys
   ```

3. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

4. **Start the server**:
   ```bash
   ./npmw start
   ```

5. **Connect via SSH**:
   ```bash
   ssh localhost -p 2222
   ```

## 🎨 UI Components

The screens use the shared Ink package [`@shellcraft/ui`](../ui/README.md)
(`file:../ui`, copied into `node_modules` by `install-links=true` in
`.npmrc`). It provides `Screen` (title bar, body, status bar), `Panel`,
`SelectList`, `Table`, `TextField`, `Button`, `Meter`, `EmptyState`,
`KeyHint`, `Message` and the SSH adapter `serve()`. Colors come only from
its theme (ANSI names; cyan for focus and selection, red only for errors;
muted text and unfocused borders are the default color dimmed).

The screens follow the Figma templates:

- **Home** (Menu + detail): menu panel with focus, cart summary beside it.
  `↑↓ move  ⏎ select  1-3 jump  q quit`
- **Products** (Table): `↑↓ move  a add to cart  c cart  b back`; "Added …
  to cart" appears in the status bar.
- **Cart** (Table + total): `c checkout  x clear cart  b back`
- **Checkout** (Form): `↑↓` picks a field, `⏎` edits it (`⏎` saves, `esc`
  cancels), `⏎` on `[ Place order ]` validates (name, a full email address,
  address) and places the order. `b back`.

`q` quits everywhere except while editing a field; Ctrl-C always quits.

After changing `../ui`, refresh the copy with `./npmw ci`.

## 🔌 Creating New Screens

A screen is a function component that gets `ctx` from `src/ui/app.js`:

```javascript
import React from 'react';
import { Screen, Panel, Text, useInput } from '@shellcraft/ui';

const h = React.createElement;

export function MyScreen({ ctx }) {
  useInput((input, key) => {
    if (input === 'b' || key.escape) ctx.navigate('home');
  });

  return h(
    Screen,
    { app: 'Demo Shop', screen: 'Mine', hints: [['b', 'back']], message: ctx.message },
    h(Panel, { title: 'Hello', focused: true }, h(Text, null, 'Hello World!'))
  );
}
```

Then register it in `src/ui/app.js`:

```javascript
import { MyScreen } from './myscreen.js';

export const screens = {
  home: HomeScreen,
  mine: MyScreen,
  // ...
};
```

## 🔐 Authentication

The server supports two authentication modes:

1. **Public Key**: Users connecting with SSH keys get a unique fingerprint
2. **Anonymous**: Users without keys can connect anonymously

Access the session in any screen:

```javascript
const fingerprint = ctx.session.fingerprint;
const cart = ctx.session.cart;
```

## 📦 Session Data

Each session includes:

- `id`: Unique session identifier
- `fingerprint`: User's SSH key fingerprint
- `createdAt`: Session creation timestamp
- `cart`: Shopping cart items
- `user`: User profile data (if logged in)
- `checkoutFormData`: Checkout fields typed so far
- `orders`: Orders placed in this session

## 🎯 Navigation

Navigate between screens using the context:

```javascript
ctx.navigate('products');                 // switch screen (clears the message)
ctx.notify('success', 'Saved');           // status bar message
ctx.addToCart(product);                   // cart actions re-render the screen
ctx.quit();                               // end the SSH session
```

## 🛠️ Development

Run with auto-reload:

```bash
./npmw run dev
```

## 🌐 API Integration

To connect to a REST API:

```javascript
// In your model or screen
async fetchProducts() {
  const response = await fetch('https://api.example.com/products');
  return await response.json();
}
```

## 📊 Database Integration

Add database support (example with SQLite):

```bash
./npmw install better-sqlite3
```

```javascript
import Database from 'better-sqlite3';

const db = new Database('data/shop.db');
```

## 🎨 Customization

Colors, glyphs and tones live in `../ui/src/theme.js`. Use the theme tokens
(`theme.text.muted`, `theme.border.focus`, ...) instead of color names, and
keep sizes in whole cells: the screens are designed for 80×24 and also
checked at 100×30.

## 📝 Best Practices

1. **Use context**: Pass session and navigation through `ctx`
2. **One focused panel**: only the focused list or table gets `isActive`
3. **Messages in the status bar**: no boxes over content
4. **Handle errors**: Wrap API calls in try/catch
5. **Key bindings**: same syntax everywhere (`q quit`, `b back`, `⏎ select`)

## 🚢 Deployment

### Using PM2

```bash
npm install -g pm2
pm2 start src/server/index.js --name demo-shop
```

### Using Docker

Build from the repository root, because the app depends on `../ui`:

```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY ui ./ui
COPY demo-shop ./demo-shop
WORKDIR /app/demo-shop
RUN npm ci --omit=dev
RUN npm run generate-keys
EXPOSE 2222
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - feel free to use this template for any project!

## 🔗 Resources

- [ssh2 Documentation](https://github.com/mscdex/ssh2)
- [Ink Documentation](https://github.com/vadimdemedes/ink)
- [@shellcraft/ui](../ui/README.md)

## 💡 Ideas for Extension

- User authentication system
- Database persistence
- Payment processing (Stripe)
- OAuth integration
- Admin dashboard
- Analytics tracking
- Multi-language support
- Themes and customization
- Plugin system

---

**Built with ❤️ for the terminal community**
