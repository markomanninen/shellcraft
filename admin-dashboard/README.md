# Admin Dashboard

A terminal-based admin dashboard with SSH access.

## 🌟 Features

- **SSH Server**: Built with ssh2 for secure remote access
- **TUI Framework**: Beautiful terminal UI using blessed
- **Session Management**: User session tracking with public key authentication
- **Component Library**: Reusable UI components (lists, tables, forms, buttons)
- **Navigation System**: Easy screen-to-screen routing
- **Dashboard Screens**: System stats, users, settings views

## 🏗️ Architecture

```
src/
├── server/          # SSH server and routing
│   ├── index.js     # Main server entry point
│   ├── router.js    # Screen navigation router
│   └── session.js   # Session management
├── ui/              # User interface screens
│   ├── components.js # Reusable UI components
│   ├── home.js      # Dashboard home
│   ├── stats.js     # System stats
│   ├── users.js     # User management
│   └── settings.js  # Settings panel
└── models/          # Data models
    └── data.js      # Data model
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
pm2 start src/server/index.js --name admin-dashboard
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
