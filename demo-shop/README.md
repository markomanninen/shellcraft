# Demo Shop

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
pm2 start src/server/index.js --name demo-shop
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
