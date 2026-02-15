#!/bin/bash

# Terminal App Template Initializer
# Creates a new terminal-based SSH application

set -e

PROJECT_NAME="${1:-my-terminal-app}"
APP_TYPE="${2:-minimal}"

# Validate app type
if [[ ! "$APP_TYPE" =~ ^(minimal|ecommerce)$ ]]; then
  echo "❌ Invalid app type: $APP_TYPE"
  echo "Usage: ./init.sh <project-name> <app-type>"
  echo "App types: minimal, ecommerce"
  exit 1
fi

echo "🚀 Creating Terminal App: $PROJECT_NAME (type: $APP_TYPE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create project structure
mkdir -p "$PROJECT_NAME"
cd "$PROJECT_NAME"

echo "📁 Creating directory structure..."
mkdir -p src/{server,ui,models,routes,middleware,utils}
mkdir -p config
mkdir -p data
mkdir -p keys
mkdir -p logs
mkdir -p test/{unit,e2e,helpers}

# Create package.json
echo "📦 Creating package.json..."
cat > package.json << 'EOL'
{
  "name": "terminal-app",
  "version": "1.0.0",
  "description": "SSH-based terminal application",
  "main": "src/server/index.js",
  "type": "module",
  "scripts": {
    "start": "node src/server/index.js",
    "dev": "nodemon src/server/index.js",
    "generate-keys": "node scripts/generate-keys.js",
    "test": "npm run test:unit && npm run test:e2e",
    "test:unit": "node --test test/unit/**/*.test.js",
    "test:e2e": "node --test test/e2e/**/*.test.js",
    "test:watch": "node --test --watch"
  },
  "keywords": ["ssh", "terminal", "tui", "shop", "cli"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "ssh2": "^1.15.0",
    "blessed": "^0.1.81",
    "dotenv": "^16.4.5",
    "nanoid": "^5.0.4"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "ssh2-streams": "^0.4.10"
  }
}
EOL

# Create main server file
echo "🖥️  Creating SSH server..."
cat > src/server/index.js << 'EOL'
import fs from 'fs';
import path from 'path';
import ssh2 from 'ssh2';
import dotenv from 'dotenv';

const { Server } = ssh2;

import { CommandRouter } from './router.js';
import { SessionManager } from './session.js';

dotenv.config();

const PORT = process.env.SSH_PORT || 2222;
const HOST_KEY = fs.readFileSync(process.env.HOST_KEY_PATH || './keys/host_key');

class TerminalServer {
  constructor() {
    this.server = new Server({
      hostKeys: [HOST_KEY]
    }, this.handleClient.bind(this));
    
    this.sessionManager = new SessionManager();
    this.router = new CommandRouter();
  }

  handleClient(client) {
    console.log('Client connecting...');
    
    let publicKey = null;
    
    client.on('authentication', (ctx) => {
      if (ctx.method === 'publickey') {
        publicKey = ctx.key;
        ctx.accept();
      } else if (ctx.method === 'none') {
        // Allow anonymous access
        ctx.accept();
      } else {
        ctx.reject();
      }
    });

    client.on('ready', () => {
      console.log('Client authenticated');
      
      const session = this.sessionManager.createSession(publicKey);
      
      client.on('session', (accept) => {
        const session_stream = accept();
        let ptyInfo = null;
        
        session_stream.once('pty', (accept, reject, info) => {
          ptyInfo = info;
          accept && accept();
        });
        
        session_stream.once('shell', (accept) => {
          const stream = accept();
          
          // Initialize UI
          this.router.handleConnection(stream, session, ptyInfo);
          
          stream.on('error', (err) => {
            console.error('Stream error:', err);
          });
          
          stream.on('close', () => {
            console.log('Client disconnected');
            this.sessionManager.destroySession(session.id);
          });
        });
      });
    });

    client.on('error', (err) => {
      console.error('Client error:', err);
    });
  }

  start() {
    this.server.listen(PORT, '0.0.0.0', () => {
      console.log(`Terminal server listening on port ${PORT}`);
      console.log(`Connect with: ssh localhost -p ${PORT}`);
    });
  }
}

const server = new TerminalServer();
server.start();
EOL

# Create router
echo "🛤️  Creating command router..."
cat > src/server/router.js << 'EOL'
import blessed from 'blessed';
import { HomeScreen } from '../ui/home.js';
import { ProductsScreen } from '../ui/products.js';
import { CartScreen } from '../ui/cart.js';
import { CheckoutScreen } from '../ui/checkout.js';

export class CommandRouter {
  constructor() {
    this.screens = {
      home: HomeScreen,
      products: ProductsScreen,
      cart: CartScreen,
      checkout: CheckoutScreen
    };
  }

  handleConnection(stream, session, ptyInfo) {
    // CRITICAL: Set stream dimensions BEFORE creating blessed screen
    stream.columns = ptyInfo?.cols || 80;
    stream.rows = ptyInfo?.rows || 24;
    stream.isTTY = true;

    // Create blessed screen
    const screen = blessed.screen({
      smartCSR: false,
      input: stream,
      output: stream,
      terminal: 'xterm-256color',
      fullUnicode: true
    });

    screen.title = 'Terminal App';

    // Global quit handler — saved so we can re-register after cleanup
    const quitHandler = () => {
      // Don't quit when typing in a text input (q would disconnect!)
      if (screen.focused && screen.focused.type === 'textbox') return;
      screen.destroy();
      stream.end();
    };
    screen.key(['C-c', 'q'], quitHandler);

    // Save original method before override
    const originalKey = screen.key.bind(screen);

    // Navigation context
    const context = {
      screen,
      session,
      navigate: (screenName, data) => {
        // Remove ALL 'key *' listeners, then re-register quit handler
        const keyEvents = Object.keys(screen._events || {}).filter(
          e => e.startsWith('key ')
        );
        keyEvents.forEach(event => {
          screen.removeAllListeners(event);
        });
        originalKey(['C-c', 'q'], quitHandler);

        // Destroy all UI elements completely
        while (screen.children.length > 0) {
          screen.children[0].destroy();
        }

        // Force clear screen
        screen.clearRegion(0, screen.width, 0, screen.height);

        // Show new screen
        this.showScreen(screenName, context, data);
        screen.render();
      },
      exit: () => {
        screen.destroy();
        stream.end();
      }
    };

    // Show home screen
    this.showScreen('home', context);

    screen.render();
  }

  showScreen(name, context, data = {}) {
    const ScreenClass = this.screens[name];
    if (ScreenClass) {
      new ScreenClass(context, data);
    }
  }
}
EOL

# Create session manager
echo "👤 Creating session manager..."
cat > src/server/session.js << 'EOL'
import { nanoid } from 'nanoid';
import crypto from 'crypto';

export class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  createSession(publicKey) {
    const id = nanoid();
    const fingerprint = publicKey 
      ? crypto.createHash('md5').update(publicKey.data).digest('hex')
      : 'anonymous';
    
    const session = {
      id,
      fingerprint,
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

# Create UI components base
echo "🎨 Creating UI framework..."
cat > src/ui/components.js << 'EOL'
import blessed from 'blessed';

export class UIComponents {
  static createBox(options = {}) {
    return blessed.box({
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        ...options.style
      },
      ...options
    });
  }

  static createList(options = {}) {
    return blessed.list({
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        selected: { bg: 'blue', fg: 'white' },
        item: { fg: 'white' },
        ...options.style
      },
      keys: true,
      vi: true,
      mouse: true,
      ...options
    });
  }

  static createTable(options = {}) {
    return blessed.listtable({
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        header: { fg: 'yellow', bold: true },
        cell: { fg: 'white' },
        ...options.style
      },
      align: 'left',
      keys: true,
      vi: true,
      ...options
    });
  }

  static createForm(options = {}) {
    return blessed.form({
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        ...options.style
      },
      keys: true,
      vi: true,
      ...options
    });
  }

  static createInput(options = {}) {
    return blessed.textbox({
      border: { type: 'line' },
      style: {
        border: { fg: 'green' },
        focus: { border: { fg: 'yellow' } },
        ...options.style
      },
      inputOnFocus: true,
      ...options
    });
  }

  static createButton(options = {}) {
    return blessed.button({
      border: { type: 'line' },
      style: {
        border: { fg: 'green' },
        focus: { border: { fg: 'yellow' }, bg: 'blue' },
        ...options.style
      },
      mouse: true,
      ...options
    });
  }

  static showMessage(screen, message, type = 'info') {
    const colors = {
      info: 'blue',
      success: 'green',
      error: 'red',
      warning: 'yellow'
    };

    const msg = blessed.message({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: 'shrink',
      border: { type: 'line' },
      style: {
        border: { fg: colors[type] },
        bg: colors[type],
        fg: 'white'
      }
    });

    msg.display(message, 3, () => {
      msg.destroy();
      screen.render();
    });
  }
}
EOL

# Create app-type specific screens
if [ "$APP_TYPE" = "minimal" ]; then
  # Create minimal home screen for starting point
  echo "Creating starter home screen..."
  cat > src/ui/home.js << 'EOL'
import { UIComponents } from './components.js';

export class HomeScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.render();
  }

  render() {
    const header = UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}{cyan-fg}Welcome to Your Terminal App{/}',
      tags: true
    });

    const box = UIComponents.createBox({
      parent: this.screen,
      top: 4,
      left: 'center',
      width: '80%',
      height: '80%-4',
      label: ' Getting Started ',
      content: `
{center}{bold}Your terminal app is ready!{/}

Add your screens to src/ui/
Add your models to src/models/
Update router in src/server/router.js

Press 'q' to quit
      `,
      tags: true,
      style: {
        border: { fg: 'cyan' }
      }
    });

    // NOTE: Global keys (q, Ctrl+C) are handled in router.js
    // Screen-specific keys are cleaned up automatically on navigation

    box.focus();
  }
}
EOL

elif [ "$APP_TYPE" = "ecommerce" ]; then
  # Create E-commerce specific screens
  # Create Home Screen
  echo "Creating home screen..."
  cat > src/ui/home.js << 'EOL'
import { UIComponents } from './components.js';

export class HomeScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.render();
  }

  render() {
    // Header
    const header = UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 5,
      content: '{center}{bold}{cyan-fg}+===================================+{/}\n' +
               '{center}{bold}{cyan-fg}|     TERMINAL APP v1.0.0           |{/}\n' +
               '{center}{bold}{cyan-fg}+===================================+{/}',
      tags: true
    });

    // Menu - no emojis (cause rendering issues in terminals)
    const menu = UIComponents.createList({
      parent: this.screen,
      top: 6,
      left: 'center',
      width: '50%',
      height: 12,
      label: ' Main Menu ',
      items: [
        '  Browse Products',
        '  View Cart',
        '  Checkout',
        '  Account',
        '  Exit'
      ],
      keys: false,
      vi: false
    });

    let menuActive = false;
    const handleSelect = (index) => {
      if (!menuActive) return;
      switch(index) {
        case 0:
          this.context.navigate('products');
          break;
        case 1:
          this.context.navigate('cart');
          break;
        case 2:
          this.context.navigate('checkout');
          break;
        case 3:
          UIComponents.showMessage(this.screen, 'Account feature coming soon!', 'info');
          break;
        case 4:
          this.context.exit();
          break;
      }
    };

    menu.on('select', (_item, index) => handleSelect(index));

    // Footer
    const footer = UIComponents.createBox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}Use arrows to navigate | Enter to select | q or Ctrl+C to quit{/}',
      tags: true,
      style: {
        fg: 'gray'
      }
    });

    // Explicit arrow/enter key routing (blessed focus workaround)
    this.screen.key(['up'], () => {
      if (!menuActive) return;
      menu.up();
      this.screen.render();
    });
    this.screen.key(['down'], () => {
      if (!menuActive) return;
      menu.down();
      this.screen.render();
    });
    this.screen.key(['enter'], () => {
      if (!menuActive) return;
      handleSelect(menu.selected);
    });

    setTimeout(() => {
      menuActive = true;
      menu.select(0);
      menu.focus();
      this.screen.render();
    }, 0);
  }
}
EOL

  # Create Products Screen
  echo "📦 Creating products screen..."
cat > src/ui/products.js << 'EOL'
import { UIComponents } from './components.js';
import { ProductModel } from '../models/product.js';

export class ProductsScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.productModel = new ProductModel();
    this.render();
  }

  render() {
    const header = UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}{cyan-fg}PRODUCTS{/}',
      tags: true
    });

    const products = this.productModel.getAll();
    
    const table = UIComponents.createTable({
      parent: this.screen,
      top: 4,
      left: 2,
      width: '96%',
      height: '80%-4',
      label: ' Available Products ',
      data: [
        ['ID', 'Name', 'Description', 'Price'],
        ...products.map(p => [p.id, p.name, p.description, `$${p.price.toFixed(2)}`])
      ]
    });

    const buttonBox = UIComponents.createBox({
      parent: this.screen,
      bottom: 3,
      left: 'center',
      width: '80%',
      height: 3,
      style: { bg: 'black' }
    });

    const addBtn = UIComponents.createButton({
      parent: buttonBox,
      top: 0,
      left: 2,
      width: 15,
      height: 3,
      content: ' Add to Cart ',
      name: 'add'
    });

    const backBtn = UIComponents.createButton({
      parent: buttonBox,
      top: 0,
      right: 2,
      width: 12,
      height: 3,
      content: ' Back ',
      name: 'back'
    });

    addBtn.on('press', () => {
      const index = table.selected;
      if (index > 0) {
        const product = products[index - 1];
        this.context.session.cart.push(product);
        UIComponents.showMessage(this.screen, `Added ${product.name} to cart!`, 'success');
      }
    });

    backBtn.on('press', () => {
      this.context.navigate('home');
    });

    this.screen.key(['b', 'escape'], () => {
      this.context.navigate('home');
    });

    this.screen.key(['a'], () => {
      addBtn.emit('press');
    });

    table.focus();
  }
}
EOL

  # Create Cart Screen
  echo "🛒 Creating cart screen..."
  cat > src/ui/cart.js << 'EOL'
import { UIComponents } from './components.js';

export class CartScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.render();
  }

  render() {
    const header = UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}{cyan-fg}SHOPPING CART{/}',
      tags: true
    });

    const cart = this.context.session.cart;
    
    if (cart.length === 0) {
      const emptyMsg = UIComponents.createBox({
        parent: this.screen,
        top: 'center',
        left: 'center',
        width: '60%',
        height: 5,
        content: '{center}{yellow-fg}Your cart is empty!{/}\n{center}Browse products to add items.',
        tags: true
      });
    } else {
      const total = cart.reduce((sum, item) => sum + item.price, 0);
      
      const table = UIComponents.createTable({
        parent: this.screen,
        top: 4,
        left: 2,
        width: '96%',
        height: '70%',
        label: ' Cart Items ',
        data: [
          ['Name', 'Price'],
          ...cart.map(item => [item.name, `$${item.price.toFixed(2)}`]),
          ['', ''],
          ['TOTAL', `$${total.toFixed(2)}`]
        ]
      });
    }

    const buttonBox = UIComponents.createBox({
      parent: this.screen,
      bottom: 3,
      left: 'center',
      width: '80%',
      height: 3,
      style: { bg: 'black' }
    });

    const checkoutBtn = UIComponents.createButton({
      parent: buttonBox,
      top: 0,
      left: 2,
      width: 15,
      height: 3,
      content: ' Checkout ',
      name: 'checkout'
    });

    const clearBtn = UIComponents.createButton({
      parent: buttonBox,
      top: 0,
      left: 20,
      width: 15,
      height: 3,
      content: ' Clear Cart ',
      name: 'clear'
    });

    const backBtn = UIComponents.createButton({
      parent: buttonBox,
      top: 0,
      right: 2,
      width: 12,
      height: 3,
      content: ' Back ',
      name: 'back'
    });

    checkoutBtn.on('press', () => {
      if (cart.length > 0) {
        this.context.navigate('checkout');
      } else {
        UIComponents.showMessage(this.screen, 'Cart is empty!', 'warning');
      }
    });

    clearBtn.on('press', () => {
      this.context.session.cart = [];
      this.context.navigate('cart');
    });

    backBtn.on('press', () => {
      this.context.navigate('home');
    });

    this.screen.key(['b', 'escape'], () => {
      this.context.navigate('home');
    });

    backBtn.focus();
  }
}
EOL

  # Create Checkout Screen
  echo "💳 Creating checkout screen..."
  cat > src/ui/checkout.js << 'EOL'
import { UIComponents } from './components.js';

export class CheckoutScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.render();
  }

  render() {
    const header = UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}{cyan-fg}CHECKOUT{/}',
      tags: true
    });

    const form = UIComponents.createForm({
      parent: this.screen,
      top: 4,
      left: 'center',
      width: '70%',
      height: '80%',
      label: ' Shipping Information '
    });

    const nameInput = UIComponents.createInput({
      parent: form,
      top: 1,
      left: 2,
      width: '90%',
      height: 3,
      label: ' Name ',
      name: 'name'
    });

    const addressInput = UIComponents.createInput({
      parent: form,
      top: 5,
      left: 2,
      width: '90%',
      height: 3,
      label: ' Address ',
      name: 'address'
    });

    const emailInput = UIComponents.createInput({
      parent: form,
      top: 9,
      left: 2,
      width: '90%',
      height: 3,
      label: ' Email ',
      name: 'email'
    });

    const submitBtn = UIComponents.createButton({
      parent: form,
      top: 14,
      left: 2,
      width: 20,
      height: 3,
      content: ' Place Order ',
      name: 'submit'
    });

    const cancelBtn = UIComponents.createButton({
      parent: form,
      top: 14,
      right: 2,
      width: 15,
      height: 3,
      content: ' Cancel ',
      name: 'cancel'
    });

    submitBtn.on('press', () => {
      form.submit();
    });

    form.on('submit', (data) => {
      // Simulate order processing
      UIComponents.showMessage(this.screen, 'Order placed successfully!', 'success');
      this.context.session.cart = [];
      setTimeout(() => {
        this.context.navigate('home');
      }, 2000);
    });

    cancelBtn.on('press', () => {
      this.context.navigate('cart');
    });

    this.screen.key(['b', 'escape'], () => {
      this.context.navigate('cart');
    });

    nameInput.focus();
  }
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
HOST_KEY_PATH=./keys/host_key

# Application Configuration
APP_NAME="Terminal App"
NODE_ENV=development

# Database (if needed)
# DATABASE_URL=sqlite:./data/shop.db

# Stripe API (if using payments)
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_PUBLISHABLE_KEY=pk_test_...
EOL

# Create key generation script
echo "🔐 Creating key generation script..."
mkdir -p scripts
cat > scripts/generate-keys.js << 'EOL'
import { generateKeyPairSync } from 'crypto';
import fs from 'fs';
import path from 'path';

const keysDir = path.join(process.cwd(), 'keys');

if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

console.log('Generating SSH host keys...');

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: {
    type: 'pkcs1',
    format: 'pem'
  }
});

fs.writeFileSync(path.join(keysDir, 'host_key'), privateKey);
fs.chmodSync(path.join(keysDir, 'host_key'), 0o600);

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

# Create comprehensive README
echo "📝 Creating README..."
cat > README.md << 'EOL'
# Terminal App

A complete template for building SSH-based terminal applications with TUI (Text User Interface).

## 🌟 Features

- **SSH Server**: Built with ssh2 for secure remote access
- **TUI Framework**: Beautiful terminal UI using blessed
- **Session Management**: User session tracking with public key authentication
- **Component Library**: Reusable UI components (lists, tables, forms, buttons)
- **Navigation System**: Easy screen-to-screen routing
- **Example Shop**: Full e-commerce flow (products, cart, checkout)

## 🏗️ Architecture

```
src/
├── server/          # SSH server and routing
│   ├── index.js     # Main server entry point
│   ├── router.js    # Screen navigation router
│   └── session.js   # Session management
├── ui/              # User interface screens
│   ├── components.js # Reusable UI components
│   ├── home.js      # Home screen
│   ├── products.js  # Products listing
│   ├── cart.js      # Shopping cart
│   └── checkout.js  # Checkout flow
└── models/          # Data models
    └── product.js   # Product data model
```

## 🚀 Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Generate SSH host keys**:
   ```bash
   npm run generate-keys
   ```

3. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

4. **Start the server**:
   ```bash
   npm start
   ```

5. **Connect via SSH**:
   ```bash
   ssh localhost -p 2222
   ```

## 🎨 UI Components

### Available Components

- **Box**: Static content container
- **List**: Selectable menu/list
- **Table**: Data grid display
- **Form**: Input form container
- **Input**: Text input field
- **Button**: Clickable button
- **Message**: Popup notification

### Example Usage

```javascript
import { UIComponents } from './ui/components.js';

// Create a menu
const menu = UIComponents.createList({
  parent: screen,
  top: 5,
  left: 'center',
  width: '50%',
  height: 10,
  label: ' Menu ',
  items: ['Option 1', 'Option 2', 'Option 3']
});

menu.on('select', (item, index) => {
  console.log('Selected:', item);
});
```

## 🔌 Creating New Screens

```javascript
import { UIComponents } from './components.js';

export class MyScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.render();
  }

  render() {
    // Create UI elements
    const box = UIComponents.createBox({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: '50%',
      content: 'Hello World!'
    });

    // Add navigation
    this.screen.key(['escape'], () => {
      this.context.navigate('home');
    });
  }
}
```

Then register in `src/server/router.js`:

```javascript
import { MyScreen } from '../ui/myscreen.js';

this.screens = {
  home: HomeScreen,
  myscreen: MyScreen,  // Add here
  // ...
};
```

## 🔐 Authentication

The server supports two authentication modes:

1. **Public Key**: Users connecting with SSH keys get a unique fingerprint
2. **Anonymous**: Users without keys can connect anonymously

Access the session in any screen:

```javascript
const fingerprint = this.context.session.fingerprint;
const cart = this.context.session.cart;
```

## 📦 Session Data

Each session includes:

- `id`: Unique session identifier
- `fingerprint`: User's SSH key fingerprint
- `createdAt`: Session creation timestamp
- `cart`: Shopping cart items
- `user`: User profile data (if logged in)

## 🎯 Navigation

Navigate between screens using the context:

```javascript
// Navigate to products screen
this.context.navigate('products');

// Navigate with data
this.context.navigate('product-detail', { productId: '123' });

// Exit application
this.context.exit();
```

## 🛠️ Development

Run with auto-reload:

```bash
npm run dev
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
npm install better-sqlite3
```

```javascript
import Database from 'better-sqlite3';

const db = new Database('data/shop.db');
```

## 🎨 Customization

### Colors

Blessed supports 256 colors. Common color names:

- `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`
- `gray`, `lightred`, `lightgreen`, `lightyellow`, etc.

### Borders

Border types: `line`, `bg`, `ch`, `heavy`, etc.

## 📝 Best Practices

1. **Always clean up**: Destroy elements before navigating away
2. **Use context**: Pass session and navigation through context
3. **Handle errors**: Wrap API calls in try/catch
4. **Focus management**: Always set focus to a focusable element
5. **Key bindings**: Provide intuitive keyboard shortcuts

## 🚢 Deployment

### Using PM2

```bash
npm install -g pm2
pm2 start src/server/index.js --name my-terminal-app
```

### Using Docker

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
- [blessed Documentation](https://github.com/chjj/blessed)
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
EOL

# Create test helper
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

# Create unit tests for models
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
import { SessionManager } from '../../src/server/session.js';
import crypto from 'crypto';

describe('SessionManager', () => {
  it('should create a session', () => {
    const manager = new SessionManager();
    const session = manager.createSession(null);
    
    assert.ok(session, 'Should create session');
    assert.ok(session.id, 'Session should have id');
    assert.ok(session.fingerprint, 'Session should have fingerprint');
    assert.ok(session.createdAt, 'Session should have createdAt');
    assert.ok(Array.isArray(session.cart), 'Session should have cart array');
  });

  it('should create anonymous session without key', () => {
    const manager = new SessionManager();
    const session = manager.createSession(null);
    
    assert.strictEqual(session.fingerprint, 'anonymous');
  });

  it('should create fingerprint from public key', () => {
    const manager = new SessionManager();
    const mockKey = { data: Buffer.from('test-key-data') };
    const session = manager.createSession(mockKey);
    
    assert.notStrictEqual(session.fingerprint, 'anonymous');
    assert.ok(session.fingerprint.length > 0);
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

# Create E2E test
echo "🧪 Creating E2E tests..."
cat > test/e2e/server.test.js << 'EOL'
import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'assert';
import { Client } from 'ssh2';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('SSH Server E2E', () => {
  let serverProcess;
  const TEST_PORT = 2223;

  before(async () => {
    // Ensure keys exist
    if (!fs.existsSync('./keys/host_key')) {
      throw new Error('Host key not found. Run npm run generate-keys first.');
    }

    // Start server in test mode
    serverProcess = spawn('node', ['src/server/index.js'], {
      env: { ...process.env, SSH_PORT: TEST_PORT },
      stdio: 'pipe'
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('should accept SSH connection', (t, done) => {
    const conn = new Client();
    
    conn.on('ready', () => {
      conn.end();
      done();
    });

    conn.on('error', (err) => {
      done(err);
    });

    conn.connect({
      host: 'localhost',
      port: TEST_PORT,
      username: 'test',
      password: 'test' // Will be rejected but connection should work
    });
  });

  it('should accept anonymous connection', (t, done) => {
    const conn = new Client();
    let shellReceived = false;

    conn.on('ready', () => {
      conn.shell((err, stream) => {
        if (err) {
          conn.end();
          return done(err);
        }

        shellReceived = true;
        stream.end();
        conn.end();
      });
    });

    conn.on('end', () => {
      if (shellReceived) {
        done();
      } else {
        done(new Error('Shell not received'));
      }
    });

    conn.on('error', (err) => {
      done(err);
    });

    conn.connect({
      host: 'localhost',
      port: TEST_PORT,
      username: 'test',
      tryKeyboard: false
    });
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

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   cd $PROJECT_NAME"
echo "   npm install"
echo "   npm run generate-keys"
echo "   npm test        # Run tests"
echo "   npm start"
echo ""
echo "🎉 Then connect with: ssh localhost -p 2222"
echo ""
