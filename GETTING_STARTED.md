# Getting Started

## Prerequisites

- Node.js v18+ (`node --version`)
- npm (`npm --version`)
- SSH client (built-in on macOS/Linux; `ssh -V`)

## Command Convention (Repo Demos)

For demo apps inside this repository, use `./npmw ...` in each app directory.
It auto-loads `nvm` if your shell does not expose `node`/`npm` on PATH.

## Step 1: Make init.sh Executable

```bash
chmod +x init.sh
```

## Step 2: Generate a New App

```bash
./init.sh my-app            # defaults to minimal template
./init.sh my-app ecommerce  # e-commerce starter template
```

The first argument is the project name, the second is the app type (`ecommerce` or `minimal`).

## Step 3: Install and Run

If `npm` is not available in your shell, run:
`source ~/.nvm/nvm.sh && nvm use default`

```bash
cd my-app
npm install
npm run generate-keys
cp .env.example .env        # optional: edit port or other settings
npm start
```

## Step 4: Connect

Open a new terminal window:

```bash
ssh localhost -p 2222
```

You should see a bordered terminal UI with a menu, header, and footer with navigation hints. Use arrow keys to navigate, Enter to select, `q` or Ctrl+C to quit.

---

## Trying the Demo Apps

Each demo is a self-contained app inside the repo. They all follow the same setup pattern:

```bash
cd <app-directory>
./npmw install
./npmw run generate-keys
cp .env.example .env
./npmw start
# then in another terminal: ssh localhost -p 2222
```

### demo-shop

E-commerce storefront. Browse products, add to cart, checkout. This is the same template that `./init.sh my-app` generates.

```bash
cd demo-shop && ./npmw install && ./npmw run generate-keys && ./npmw start
```

### adventure-game

Text adventure with LLM-powered dynamic descriptions. Requires Ollama running locally for LLM mode -- without it the game falls back to static room descriptions (fully playable, just not dynamic). Configure `OLLAMA_BASE_URL` and `OLLAMA_MODEL` in `.env`.

```bash
cd adventure-game && ./npmw install && ./npmw run generate-keys && ./npmw start
```

Keyboard shortcuts once connected: `h` = help/menu, `i` = inventory, `q` = quit, arrow keys to move between rooms.

### admin-dashboard

Server monitoring dashboard with system stats, process list, and log viewer.

```bash
cd admin-dashboard && ./npmw install && ./npmw run generate-keys && ./npmw start
```

### animation-demo

Standalone ASCII animation showcase (runs directly in the terminal, no SSH):

```bash
cd animation-demo && ./npmw install && ./npmw start
```

---

## Success Checks

After connecting to any SSH app you should see:

- A bordered terminal interface with header and footer
- A menu or interactive content area
- Arrow key navigation works (up/down)
- Enter selects menu items
- `q` or Ctrl+C disconnects cleanly

## Troubleshooting

### Server won't start

**EADDRINUSE** -- port 2222 is already in use:
```bash
lsof -ti:2222 | xargs kill
```

**Cannot find module 'ssh2'** -- run `npm install` again.

**Host key not found** -- run `npm run generate-keys`.

### Can't connect

**Connection refused** -- make sure the server is running in another terminal.

**Screen is garbled** -- try a different terminal emulator (iTerm2, Hyper, Windows Terminal). Some terminals have limited color/unicode support.

### Keys don't work

- Make sure the terminal window has focus.
- If you're in a text input, press ESC first.
- Use arrow keys, not mouse.

## Next Steps

1. Read [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for the component and API cheat sheet.
2. Modify the home screen or data models in whichever demo you're exploring.
3. Create a new screen: add a file in `src/ui/`, register it in `src/server/router.js`, and link it from a menu.
4. Check [USAGE_GUIDE.md](./USAGE_GUIDE.md) for deeper tutorials.

### Code to explore

- `src/server/index.js` -- SSH server setup
- `src/ui/components.js` -- reusable UI component library
- `src/ui/home.js` -- home screen implementation
- `src/server/router.js` -- screen navigation and cleanup

---

**Quick start one-liner:**
```bash
./init.sh my-app && cd my-app && npm i && npm run generate-keys && npm start
```
