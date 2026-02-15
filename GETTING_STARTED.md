# ✅ Getting Started Checklist

Use this checklist to get up and running with your first terminal app!

## 📋 Pre-Setup

- [ ] You have Node.js installed (v18 or higher)
  ```bash
  node --version  # Should be v18.0.0 or higher
  ```
- [ ] You have npm installed
  ```bash
  npm --version
  ```
- [ ] You have an SSH client (built-in on macOS/Linux)
  ```bash
  ssh -V
  ```

## 🚀 Setup Steps

### Step 1: Make init.sh Executable
- [ ] Navigate to terminal_example directory
- [ ] Run: `chmod +x init.sh`
- [ ] Verify: `ls -l init.sh` should show `-rwxr-xr-x`

### Step 2: Generate Your First App
- [ ] Run: `./init.sh my-first-app`
- [ ] You should see: "🚀 Creating Terminal App: my-first-app"
- [ ] Navigate: `cd my-first-app`

### Step 3: Install Dependencies
- [ ] Run: `npm install`
- [ ] Wait for installation to complete (~30 seconds)
- [ ] Verify: `node_modules/` directory exists

### Step 4: Generate SSH Keys
- [ ] Run: `npm run generate-keys`
- [ ] You should see: "✓ Host key generated at keys/host_key"
- [ ] Verify: `ls keys/` shows `host_key`

### Step 5: Configure Environment
- [ ] Run: `cp .env.example .env`
- [ ] (Optional) Edit `.env` to change port or other settings
- [ ] Default port is 2222

### Step 6: Start the Server
- [ ] Run: `npm start`
- [ ] You should see:
  ```
  🚀 Terminal server listening on port 2222
  📡 Connect with: ssh localhost -p 2222
  ```
- [ ] Server is running (don't close this terminal)

### Step 7: Connect via SSH
- [ ] Open a **NEW** terminal window
- [ ] Run: `ssh localhost -p 2222`
- [ ] You should see the home screen!

## 🎉 Success Checks

### You Should See:
- [ ] A bordered terminal interface
- [ ] "TERMINAL APP v1.0.0" header
- [ ] Main menu with 5 options:
  - 📦 Browse Products
  - 🛒 View Cart
  - 💳 Checkout
  - 👤 Account
  - ❌ Exit
- [ ] Footer with navigation hints

### You Should Be Able To:
- [ ] Use arrow keys (↑/↓) to navigate menu
- [ ] Press Enter to select an option
- [ ] Browse products screen
- [ ] Add products to cart (press 'a')
- [ ] View cart with items
- [ ] Navigate to checkout
- [ ] Press 'b' or ESC to go back
- [ ] Press 'q' or Ctrl+C to quit

## 🐛 Troubleshooting

### Server Won't Start

**Error: "EADDRINUSE"**
- [ ] Port 2222 is already in use
- [ ] Solution: Kill existing process or change port in .env
  ```bash
  lsof -ti:2222 | xargs kill
  ```

**Error: "Cannot find module 'ssh2'"**
- [ ] Dependencies not installed
- [ ] Solution: Run `npm install` again

**Error: "Host key not found"**
- [ ] SSH keys not generated
- [ ] Solution: Run `npm run generate-keys`

### Can't Connect

**Error: "Connection refused"**
- [ ] Server is not running
- [ ] Solution: Start server with `npm start`

**Error: "Permission denied"**
- [ ] SSH keys issue
- [ ] Solution: Server accepts anonymous connections, should work

**Screen is Garbled**
- [ ] Terminal doesn't support colors
- [ ] Solution: Try a different terminal (iTerm2, Hyper, etc.)

### UI Issues

**Can't Navigate**
- [ ] Make sure terminal has focus
- [ ] Try clicking in the terminal window
- [ ] Use arrow keys, not mouse

**Keys Don't Work**
- [ ] Check if you're in a text input
- [ ] Press ESC to exit input mode
- [ ] Make sure Caps Lock is off

## 📚 Next Steps

### Once You Have It Working:

#### Beginner Level
- [ ] Read [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- [ ] Modify the home screen welcome message
- [ ] Change product names in `src/models/product.js`
- [ ] Change menu colors in `src/ui/home.js`

#### Intermediate Level
- [ ] Create a new custom screen
- [ ] Add a new UI component
- [ ] Integrate with a public API
- [ ] Add more product data

#### Advanced Level
- [ ] Add SQLite database
- [ ] Build a REST API
- [ ] Add payment processing
- [ ] Deploy to a server

## 🎯 Learning Resources

### Documentation to Read Next:
1. [ ] [VISUAL_DEMO.md](./VISUAL_DEMO.md) - See what each screen looks like
2. [ ] [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Component reference
3. [ ] [USAGE_GUIDE.md](./USAGE_GUIDE.md) - Complete tutorials
4. [ ] [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Technical overview

### Code to Explore:
1. [ ] `src/server/index.js` - SSH server setup
2. [ ] `src/ui/components.js` - UI component library
3. [ ] `src/ui/home.js` - Home screen implementation
4. [ ] `src/server/router.js` - Navigation system

## 🎨 Customization Checklist

### Quick Wins (5 minutes each):
- [ ] Change app title in `src/ui/home.js`
- [ ] Modify product list in `src/models/product.js`
- [ ] Update menu items in `src/ui/home.js`
- [ ] Change border colors (fg: 'cyan' → 'magenta')
- [ ] Add your name/brand to header

### Medium Tasks (30 minutes each):
- [ ] Create a new "About" screen
- [ ] Add more product fields (category, rating)
- [ ] Implement product search
- [ ] Add input validation
- [ ] Create a settings screen

### Larger Projects (Hours):
- [ ] Add database persistence
- [ ] Build REST API endpoints
- [ ] Implement user authentication
- [ ] Add payment processing
- [ ] Deploy to production server

## ✨ Bonus Challenges

- [ ] Change the color scheme to your brand colors
- [ ] Add ASCII art logo to home screen
- [ ] Create a loading animation
- [ ] Add keyboard shortcuts (Ctrl+P for products, etc.)
- [ ] Implement a help screen with all commands
- [ ] Add a "Recently Viewed" feature
- [ ] Create product categories
- [ ] Add quantity selection to cart
- [ ] Implement promo codes
- [ ] Add order confirmation email

## 📊 Progress Tracking

### Day 1
- [ ] Complete Pre-Setup
- [ ] Complete Setup Steps
- [ ] Successfully connect and explore
- [ ] Read QUICK_REFERENCE.md

### Day 2-3
- [ ] Make first customization
- [ ] Create new screen
- [ ] Read USAGE_GUIDE.md
- [ ] Experiment with components

### Week 1
- [ ] Build custom feature
- [ ] Add external API
- [ ] Deploy locally
- [ ] Share with friend

### Week 2+
- [ ] Add database
- [ ] Build API
- [ ] Deploy to production
- [ ] Launch your app!

## 🎓 Skill Building

### After Completing This Tutorial, You'll Know:
- [ ] SSH server concepts
- [ ] Terminal UI development
- [ ] Event-driven programming
- [ ] Session management
- [ ] Navigation patterns
- [ ] Component-based architecture
- [ ] Real-time user interaction
- [ ] Deployment strategies

## 🏆 Final Check

You're ready to move on when you can:
- [ ] Generate a new app from scratch
- [ ] Explain what each file does
- [ ] Modify the UI confidently
- [ ] Add a new screen
- [ ] Customize components
- [ ] Deploy and connect remotely

---

## 🆘 Need Help?

### Resources:
- **Quick Reference**: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- **Complete Guide**: [USAGE_GUIDE.md](./USAGE_GUIDE.md)
- **Visual Examples**: [VISUAL_DEMO.md](./VISUAL_DEMO.md)
- **Documentation Index**: [INDEX.md](./INDEX.md)

### Common Commands:
```bash
# Generate new app
./init.sh app-name

# Install dependencies
npm install

# Generate keys
npm run generate-keys

# Start server
npm start

# Connect
ssh localhost -p 2222

# Development mode (auto-reload)
npm run dev
```

---

**Ready? Let's start! ✅ Check off each box as you go!**

**Good luck building your terminal app! 🚀**
