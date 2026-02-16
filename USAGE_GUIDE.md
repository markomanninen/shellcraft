# Terminal App Template - Usage Guide

## 🎯 What is This?

A production-ready template for creating SSH-based terminal applications with beautiful TUI (Text User Interface).

## 📦 What This Template Provides

### Core Features

1. **SSH Server** (`ssh2` library)
   - Public key authentication
   - Anonymous access support
   - Secure connections

2. **TUI Framework** (`blessed` library)
   - Boxes, lists, tables, forms
   - Navigation system
   - Keyboard shortcuts
   - Mouse support

3. **Session Management**
   - demo-shop / admin-dashboard: SSH public key fingerprint tracking (in-memory)
   - adventure-game: Username-based sessions with JSON file persistence (`data/sessions.json`)
   - Cart / game state persistence
   - Session state

4. **Example Application**
   - Product catalog
   - Shopping cart
   - Checkout flow
   - Complete navigation

## 🚀 Quick Start

### 1. Create a New Project

```bash
# Make the script executable (first time only)
chmod +x init.sh

# Create your project
./init.sh my-awesome-app

# Navigate to your project
cd my-awesome-app
```

### 2. Install & Setup

```bash
# Install dependencies
npm install

# Generate SSH host keys
npm run generate-keys

# Copy environment configuration
cp .env.example .env

# Start the server
npm start
```

### 3. Connect

```bash
# In another terminal
ssh localhost -p 2222
```

## 🎨 Customizing Your App

### Modify the Home Screen

Edit `src/ui/home.js`:

```javascript
items: [
  '📦 Browse Products',    // Change these menu items
  '🛒 View Cart',
  '💳 Checkout',
  '🎮 Play Game',          // Add your own screens
  '❌ Exit'
]
```

### Add a New Screen

1. Create `src/ui/myscreen.js`:

```javascript
import { UIComponents } from './components.js';

export class MyScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.render();
  }

  render() {
    const box = UIComponents.createBox({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: '60%',
      content: '{center}{bold}My Custom Screen!{/}\n\n' +
               '{center}Press ESC to go back',
      tags: true
    });

    this.screen.key(['escape'], () => {
      this.context.navigate('home');
    });
  }
}
```

2. Register in `src/server/router.js`:

```javascript
import { MyScreen } from '../ui/myscreen.js';

this.screens = {
  home: HomeScreen,
  myscreen: MyScreen,  // Add your screen
  // ...
};
```

3. Add menu item in `src/ui/home.js`:

```javascript
case 3:  // New menu option
  this.context.navigate('myscreen');
  break;
```

### Change Products

Edit `src/models/product.js`:

```javascript
this.products = [
  {
    id: 'prod_001',
    name: 'Your Product Name',
    description: 'Your description',
    price: 29.99,
    stock: 100
  },
  // Add more products...
];
```

## 🎯 Use Cases

### 1. E-commerce Store
- Sell products via terminal
- Perfect for developer-focused products
- Unique, memorable experience

### 2. Game Server
- Text-based adventure games
- MUD (Multi-User Dungeon)
- Interactive fiction

### 3. Admin Dashboard
- Server monitoring
- Database management
- Log viewing

### 4. API Client
- Interactive API explorer
- Testing tool
- Development utility

### 5. Information Kiosk
- Documentation browser
- Support system
- Knowledge base

## 🎨 UI Component Examples

### Create a Menu

```javascript
const menu = UIComponents.createList({
  parent: screen,
  top: 5,
  left: 'center',
  width: '50%',
  height: 10,
  items: ['Option 1', 'Option 2', 'Option 3']
});

menu.on('select', (item, index) => {
  // Handle selection
});
```

### Create a Form

```javascript
const form = UIComponents.createForm({
  parent: screen,
  top: 5,
  left: 'center',
  width: '60%',
  height: 15
});

const input = UIComponents.createInput({
  parent: form,
  top: 1,
  left: 2,
  width: '90%',
  height: 3,
  label: ' Username '
});

form.on('submit', (data) => {
  console.log('Submitted:', data);
});
```

### Create a Table

```javascript
const table = UIComponents.createTable({
  parent: screen,
  top: 5,
  left: 2,
  width: '96%',
  height: 15,
  data: [
    ['Name', 'Age', 'City'],
    ['John', '30', 'NYC'],
    ['Jane', '25', 'SF']
  ]
});
```

### Show a Message

```javascript
UIComponents.showMessage(screen, 'Success!', 'success');
// Types: 'info', 'success', 'error', 'warning'
```

## 🔐 Authentication

The example apps demonstrate two different session identification strategies.

### Fingerprint-Based Identity (demo-shop / admin-dashboard)

Sessions are identified by the MD5 hash of the user's SSH public key. This is
purely in-memory and resets when the server restarts.

```javascript
// demo-shop & admin-dashboard — SessionManager.createSession(publicKey)
const fingerprint = publicKey
  ? crypto.createHash('md5').update(publicKey.data).digest('hex')
  : 'anonymous';

const session = { id, fingerprint, createdAt: new Date(), cart: [] };

// In your screen code:
const fingerprint = this.context.session.fingerprint;

if (fingerprint === 'anonymous') {
  // User connected without SSH key
} else {
  // User has a unique fingerprint derived from their public key
}
```

### Username-Based Identity (adventure-game)

Sessions are keyed by the SSH username (`ssh <username>@host`). Game state is
persisted to a JSON file so players can reconnect and resume.

```javascript
// adventure-game — SessionManager.createSession(username)
// Looks up an existing session by username; creates a new one if none found.
const session = sessionManager.createSession(username); // e.g. 'alice'

// Game state is automatically saved to data/sessions.json
// and restored on the next connection with the same username.
```

### Store User Data

```javascript
// In session (temporary)
this.context.session.user = {
  name: 'John Doe',
  email: 'john@example.com'
};

// In database (persistent)
// Use your preferred database library
```

## 🌐 API Integration

### Fetch Data

```javascript
async fetchProducts() {
  try {
    const response = await fetch('https://api.example.com/products');
    const products = await response.json();
    return products;
  } catch (error) {
    UIComponents.showMessage(this.screen, 'Failed to load products', 'error');
  }
}
```

### Use in Screen

```javascript
export class ProductsScreen {
  async render() {
    const products = await this.fetchProducts();
    // Display products...
  }
}
```

## 🤖 LLM Integration (Ollama)

The `adventure-game` example includes a full LLM integration that connects to a
local [Ollama](https://ollama.com/) instance to power a dynamic game master.
You can reuse this pattern in your own apps.

### Architecture

```
┌──────────────┐      ┌────────────────┐      ┌──────────────────┐
│  UI (room.js)│─────▶│ LLMGameEngine  │─────▶│  OllamaClient    │
│  user action │      │ prompt + parse │      │  HTTP → Ollama   │
└──────────────┘      └────────────────┘      └──────────────────┘
```

1. **OllamaClient** (`src/llm/ollama-client.js`) — thin HTTP wrapper around
   the Ollama `/api/chat` endpoint with configurable model, base URL, and
   timeout.
2. **LLMGameEngine** (`src/llm/game-engine.js`) — builds a system prompt from
   the game world seed, manages conversation history, and parses the structured
   JSON responses the model returns.

### Configuration

Set these in your `.env` (or environment):

```bash
OLLAMA_BASE_URL=http://localhost:11434   # Ollama server address
OLLAMA_MODEL=qwen3-coder:30b            # Any Ollama-compatible model
```

### Quick Example

```javascript
import { OllamaClient } from './llm/ollama-client.js';

const client = new OllamaClient();          // reads env vars automatically

// Check if Ollama is reachable
if (await client.isAvailable()) {
  const result = await client.chat([
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user',   content: 'Describe this room in two sentences.' }
  ], { temperature: 0.8, maxTokens: 256 });

  console.log(result.message.content);
}
```

The adventure-game gracefully falls back to a static room model when Ollama is
not running, so the app remains functional without an LLM.

## 🗄️ Database Integration

### SQLite Example

```bash
npm install better-sqlite3
```

```javascript
import Database from 'better-sqlite3';

const db = new Database('data/shop.db');

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    user_fingerprint TEXT,
    total REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Insert
const insert = db.prepare('INSERT INTO orders (user_fingerprint, total) VALUES (?, ?)');
insert.run(fingerprint, total);

// Query
const orders = db.prepare('SELECT * FROM orders WHERE user_fingerprint = ?').all(fingerprint);
```

## 🎨 Styling Tips

### Colors

```javascript
style: {
  fg: 'white',        // foreground
  bg: 'blue',         // background
  border: { fg: 'cyan' },
  selected: { bg: 'blue', fg: 'white' },
  focus: { border: { fg: 'yellow' } }
}
```

### Formatting with Tags

```javascript
content: '{center}{bold}{cyan-fg}Title{/}\n' +
         '{red-fg}Error message{/}\n' +
         '{green-fg}Success!{/}',
tags: true  // Enable tag parsing
```

### Available Colors

`black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`,
`gray`, `lightred`, `lightgreen`, `lightyellow`, `lightblue`, `lightmagenta`, `lightcyan`

## ⌨️ Keyboard Shortcuts

### Standard Bindings

```javascript
// Single key
screen.key(['q'], () => { /* quit */ });

// Multiple keys
screen.key(['q', 'C-c'], () => { /* quit */ });

// With modifiers
screen.key(['C-x'], () => { /* Ctrl+X */ });
screen.key(['M-x'], () => { /* Alt+X */ });

// Arrow keys
screen.key(['up', 'down', 'left', 'right'], (ch, key) => {
  console.log('Arrow key:', key.name);
});
```

## 🚢 Deployment

> **Important:** Authentication is disabled by default in all three example apps
> so that anyone can connect without an SSH key or password. This is intentional
> for demo/development purposes. For any production deployment you **MUST**
> configure proper authentication (public key verification, password checks, or
> both) in the `client.on('authentication', ...)` handler inside
> `src/server/index.js`. See the [Custom Authentication](#-advanced-topics)
> section for an example.

### Development

```bash
npm run dev  # Auto-reload on changes
```

### Production with PM2

```bash
npm install -g pm2
pm2 start src/server/index.js --name my-terminal-app
pm2 startup  # Start on system boot
pm2 save
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run generate-keys
EXPOSE 2222
CMD ["npm", "start"]
```

```bash
docker build -t my-terminal-app .
docker run -p 2222:2222 my-terminal-app
```

### Public Access

To allow external SSH connections:

1. **Open firewall port**: 2222
2. **Configure router**: Port forward 2222 to your server
3. **Update `.env`**: Bind to 0.0.0.0 (default)
4. **Connect**: `ssh your-domain.com -p 2222`

## 🐛 Troubleshooting

### Connection Refused

```bash
# Check if server is running
ps aux | grep node

# Check port availability
lsof -i :2222
```

### Screen Not Rendering

```javascript
// Always call screen.render() after changes
screen.render();

// Destroy old elements before creating new ones
screen.children.forEach(child => child.destroy());
```

### Keys Not Working

```javascript
// Ensure element is focused
element.focus();

// Check key bindings
screen.key(['your-key'], () => {
  console.log('Key pressed!');
});
```

## 📚 Advanced Topics

### Custom Authentication

```javascript
client.on('authentication', (ctx) => {
  if (ctx.method === 'password') {
    // EXAMPLE ONLY - use environment variables in production!
    if (ctx.username === process.env.ADMIN_USER && ctx.password === process.env.ADMIN_PASS) {
      ctx.accept();
    } else {
      ctx.reject();
    }
  }
});
```

### Multiple Servers

```javascript
// Different ports for different apps
const shopServer = new TerminalServer(2222);
const adminServer = new TerminalServer(2223);
```

### Logging

```javascript
import fs from 'fs';

const log = (message) => {
  const timestamp = new Date().toISOString();
  fs.appendFileSync('logs/app.log', `[${timestamp}] ${message}\n`);
};
```

## 🎓 Learning Resources

- **SSH2**: https://github.com/mscdex/ssh2
- **Blessed**: https://github.com/chjj/blessed
- **Node.js**: https://nodejs.org/docs

## 💡 Project Ideas

1. **Dev Tools Shop** - Sell licenses for developer tools
2. **Book Store** - Sell ebooks with terminal interface
3. **Ticket System** - Support ticket management
4. **Game Server** - Text-based multiplayer game
5. **News Reader** - RSS/news aggregator
6. **Weather App** - Weather dashboard
7. **Todo Manager** - Task management system
8. **Chat Server** - Terminal chat application
9. **File Browser** - Remote file management
10. **Code Snippet Manager** - Share and browse code snippets

## 🤝 Contributing

Found a bug or have an improvement? Contributions welcome!

## 📄 License

MIT - Use this template for any project, commercial or personal!

---

**Happy Hacking! 🚀**
