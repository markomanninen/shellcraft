# Terminal App Template Generator

> Create beautiful SSH-based terminal applications with TUI

## 🌟 What is This?

This is a **complete project generator** that scaffolds production-ready SSH-based terminal applications with Text User Interface (TUI). Perfect for creating unique, developer-focused applications accessible via SSH.

## ✨ Features

- 🔐 **SSH Server** with public key authentication
- 🎨 **Beautiful TUI** using blessed library
- 🧭 **Navigation System** with screen routing
- 👤 **Session Management** with user tracking
- 🛒 **Complete Example** e-commerce app (products, cart, checkout)
- 🎯 **Reusable Components** (lists, tables, forms, buttons)
- 🧪 **Testing Suite** with unit and E2E tests ⭐ NEW!
- 📦 **Ready to Deploy** with Docker & PM2 support
- 🎮 **3 Demo Apps** showing different use cases ⭐ NEW!

## 🚀 Quick Start

### Generate Your App

```bash
# Make init script executable
chmod +x init.sh

# Create your terminal app
./init.sh my-awesome-app

# Navigate to project
cd my-awesome-app

# Install dependencies
npm install

# Generate SSH host keys
npm run generate-keys

# Start the server
npm start
```

### Connect to Your App

```bash
# In another terminal
ssh localhost -p 2222
```

You'll see a beautiful terminal interface with:
- 📦 Product catalog
- 🛒 Shopping cart
- 💳 Checkout flow
- Full keyboard navigation

## 📖 Documentation

- **[USAGE_GUIDE.md](./USAGE_GUIDE.md)** - Complete guide with examples and tutorials
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Quick reference for common tasks
- **[DESIGN_PRINCIPLES.md](./DESIGN_PRINCIPLES.md)** - Critical design principles for SSH/blessed apps

## 🏗️ What Gets Generated

```
my-awesome-app/
├── src/
│   ├── server/          # SSH server & routing
│   │   ├── index.js     # Main entry point
│   │   ├── router.js    # Screen navigation
│   │   └── session.js   # Session management
│   ├── ui/              # User interface
│   │   ├── components.js # Reusable UI components
│   │   ├── home.js      # Home screen
│   │   ├── products.js  # Products listing
│   │   ├── cart.js      # Shopping cart
│   │   └── checkout.js  # Checkout form
│   └── models/          # Data models
│       └── product.js   # Product model
├── config/              # Configuration files
├── keys/                # SSH keys (auto-generated)
├── scripts/             # Utility scripts
├── package.json         # Dependencies
├── .env.example         # Environment template
└── README.md            # Project documentation
```

## 🎯 Use Cases

### E-commerce
- Developer-focused product shops
- Unique, memorable shopping experience
- Perfect for tech products

### Games
- Text-based adventure games
- MUD (Multi-User Dungeon) servers
- Interactive fiction

### Tools
- Admin dashboards
- API explorers
- Database clients
- Log viewers

### Information
- Documentation browsers
- Knowledge bases
- News aggregators
- RSS readers

## 🎨 Example: Creating a Custom Screen

```javascript
// src/ui/myscreen.js
import { UIComponents } from './components.js';

export class MyScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.render();
  }

  render() {
    const menu = UIComponents.createList({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: 10,
      label: ' My Menu ',
      items: ['Option 1', 'Option 2', 'Option 3']
    });

    menu.on('select', (item, index) => {
      UIComponents.showMessage(
        this.screen, 
        `Selected: ${item}`, 
        'success'
      );
    });

    this.screen.key(['escape'], () => {
      this.context.navigate('home');
    });
  }
}
```

## 🔧 Customization

The generated template is fully customizable:

- **Screens**: Add/modify screens in `src/ui/`
- **Models**: Update data models in `src/models/`
- **Styling**: Change colors and layouts
- **Authentication**: Customize in `src/server/index.js`
- **API**: Add external API integrations

## 🛠️ Technology Stack

- **[ssh2](https://github.com/mscdex/ssh2)** - SSH server implementation
- **[blessed](https://github.com/chjj/blessed)** - TUI framework
- **[dotenv](https://github.com/motdotla/dotenv)** - Environment configuration
- **[nanoid](https://github.com/ai/nanoid)** - ID generation

## 🌐 Deployment

### Local Development
```bash
npm run dev  # Auto-reload on changes
```

### Production (PM2)
```bash
pm2 start src/server/index.js --name my-app
pm2 startup
pm2 save
```

### Docker
```bash
docker build -t my-app .
docker run -p 2222:2222 my-app
```

### Public Access
1. Open firewall port 2222
2. Configure port forwarding on router
3. Point domain to your server
4. Connect: `ssh your-domain.com -p 2222`

## 📚 Learn More

### Tutorials
- [Complete Usage Guide](./USAGE_GUIDE.md)
- [Quick Reference](./QUICK_REFERENCE.md)

### Resources
- [SSH2 Documentation](https://github.com/mscdex/ssh2)
- [Blessed Documentation](https://github.com/chjj/blessed)

## 💡 Project Ideas

1. **Developer Tools Shop** - Sell software licenses
2. **Text Game Server** - Multiplayer text adventures
3. **Admin Dashboard** - Server monitoring via SSH
4. **API Explorer** - Interactive API testing tool
5. **Documentation Browser** - Searchable docs
6. **Ticket System** - Support via terminal
7. **News Reader** - RSS aggregator
8. **Weather Dashboard** - Terminal weather app
9. **Chat Server** - Terminal chat rooms
10. **Code Snippet Manager** - Share code snippets

## 🤝 Contributing

Contributions welcome! Ideas for improvement:

- Additional UI components
- More example screens
- Database integrations
- Payment processing examples
- Testing utilities

## 📄 License

MIT License - Free to use for any project, commercial or personal!

## 🎉 Example Apps Built with This

Have you built something cool with this template? Let us know!

## ⚡ One-Liner Setup

```bash
./init.sh my-app && cd my-app && npm i && npm run generate-keys && npm start
```

Then connect with: `ssh localhost -p 2222`

---

**Built with ❤️ for the terminal community**

🚀 **[Get Started Now](#-quick-start)** | 📖 **[Read the Docs](./USAGE_GUIDE.md)** | ⭐ **[Star on GitHub](#)**
