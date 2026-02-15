# Terminal App Quick Reference

## 🎬 Getting Started

```bash
# Create new app
./init.sh my-app-name

# Setup
cd my-app-name
npm install
npm run generate-keys
npm start

# Connect
ssh localhost -p 2222
```

## 📁 Project Structure

```
src/
├── server/
│   ├── index.js      # Main SSH server
│   ├── router.js     # Screen router
│   └── session.js    # Session manager
├── ui/
│   ├── components.js # UI components library
│   ├── home.js       # Home screen
│   ├── products.js   # Products screen
│   ├── cart.js       # Cart screen
│   └── checkout.js   # Checkout screen
└── models/
    └── product.js    # Data models
```

## 🎨 UI Components Cheat Sheet

### Box
```javascript
UIComponents.createBox({
  parent: screen,
  top: 0, left: 0,
  width: '50%', height: 10,
  content: 'Hello World',
  style: { fg: 'white', border: { fg: 'cyan' } }
})
```

### List (Menu)
```javascript
UIComponents.createList({
  parent: screen,
  top: 5, left: 'center',
  width: '50%', height: 10,
  items: ['Item 1', 'Item 2', 'Item 3']
})
```

### Table
```javascript
UIComponents.createTable({
  parent: screen,
  top: 5, left: 2,
  width: '96%', height: 15,
  data: [
    ['Column 1', 'Column 2'],
    ['Value 1', 'Value 2']
  ]
})
```

### Form + Input
```javascript
const form = UIComponents.createForm({
  parent: screen,
  top: 5, width: '60%', height: 15
})

const input = UIComponents.createInput({
  parent: form,
  top: 1, left: 2,
  width: '90%', height: 3,
  label: ' Name '
})

form.on('submit', (data) => {
  console.log(data)
})
```

### Button
```javascript
const btn = UIComponents.createButton({
  parent: screen,
  top: 10, left: 5,
  width: 15, height: 3,
  content: 'Click Me'
})

btn.on('press', () => {
  console.log('Button clicked!')
})
```

### Message
```javascript
UIComponents.showMessage(screen, 'Hello!', 'success')
// Types: 'info', 'success', 'error', 'warning'
```

## 🧭 Navigation

```javascript
// Navigate to screen
context.navigate('products')

// Navigate with data
context.navigate('detail', { id: '123' })

// Go back
context.navigate('home')

// Exit
context.exit()
```

## 🔑 Keyboard Shortcuts

```javascript
// Single key
screen.key(['q'], callback)

// Multiple keys
screen.key(['q', 'escape'], callback)

// With modifiers
screen.key(['C-c'], callback)  // Ctrl+C
screen.key(['M-x'], callback)  // Alt+X

// Arrow keys
screen.key(['up', 'down', 'left', 'right'], callback)
```

## 👤 Session Access

```javascript
// Get session
const session = context.session

// User fingerprint
const fingerprint = session.fingerprint

// Cart data
const cart = session.cart
cart.push(product)

// Custom data
session.user = { name: 'John' }
```

## 🎨 Styling

### Colors
`black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`,
`gray`, `lightred`, `lightgreen`, `lightyellow`, `lightblue`, etc.

### Style Object
```javascript
style: {
  fg: 'white',              // Text color
  bg: 'blue',               // Background
  border: { fg: 'cyan' },   // Border color
  focus: { border: { fg: 'yellow' } },
  selected: { bg: 'blue', fg: 'white' }
}
```

### Text Formatting (with tags: true)
```javascript
content: '{center}Centered{/}\n' +
         '{bold}Bold{/}\n' +
         '{red-fg}Red text{/}\n' +
         '{blue-bg}Blue background{/}'
```

## 🆕 Creating a New Screen

1. **Create file** `src/ui/myscreen.js`:

```javascript
import { UIComponents } from './components.js'

export class MyScreen {
  constructor(context) {
    this.context = context
    this.screen = context.screen
    this.render()
  }

  render() {
    const box = UIComponents.createBox({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: '60%',
      content: 'My Screen'
    })

    screen.key(['escape'], () => {
      context.navigate('home')
    })
  }
}
```

2. **Register** in `src/server/router.js`:

```javascript
import { MyScreen } from '../ui/myscreen.js'

this.screens = {
  myscreen: MyScreen,  // Add here
  // ...
}
```

3. **Add to menu** in `src/ui/home.js`

## 🌐 API Integration

```javascript
async fetchData() {
  try {
    const res = await fetch('https://api.example.com/data')
    return await res.json()
  } catch (err) {
    UIComponents.showMessage(this.screen, 'Error!', 'error')
  }
}
```

## 🗄️ Database (SQLite)

```bash
npm install better-sqlite3
```

```javascript
import Database from 'better-sqlite3'
const db = new Database('data/app.db')

// Create
db.exec(`CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  name TEXT
)`)

// Insert
db.prepare('INSERT INTO items (name) VALUES (?)').run('Item 1')

// Query
const items = db.prepare('SELECT * FROM items').all()
```

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production (PM2)
```bash
npm install -g pm2
pm2 start src/server/index.js --name my-app
pm2 startup
pm2 save
```

### Docker
```bash
docker build -t my-app .
docker run -p 2222:2222 my-app
```

## 🐛 Common Issues

### Screen not updating
```javascript
screen.render()  // Always call after changes
```

### Elements overlapping
```javascript
// Destroy old elements first
screen.children.forEach(child => child.destroy())
```

### Keys not working
```javascript
element.focus()  // Ensure focus
```

## 📝 NPM Scripts

```bash
npm start          # Start server
npm run dev        # Dev with auto-reload
npm run generate-keys  # Generate SSH keys
```

## 🔧 Environment Variables

```bash
SSH_PORT=2222              # Server port
HOST_KEY_PATH=./keys/host_key  # SSH key path
NODE_ENV=development       # Environment
```

## 💡 Quick Tips

1. **Focus**: Always set focus to interactive elements
2. **Cleanup**: Destroy elements before creating new ones
3. **Render**: Call `screen.render()` after changes
4. **Context**: Pass data via context.navigate()
5. **Keys**: Use meaningful key bindings (q=quit, b=back, etc.)
6. **Feedback**: Show messages for user actions
7. **Colors**: Use colors to indicate state/importance
8. **Testing**: Connect locally before deploying

## 📚 Resources

- SSH2: https://github.com/mscdex/ssh2
- Blessed: https://github.com/chjj/blessed

---

**Quick start: `./init.sh my-app && cd my-app && npm i && npm run generate-keys && npm start`**
