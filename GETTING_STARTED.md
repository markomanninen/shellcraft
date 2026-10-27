# Getting Started

## Prerequisites

- Node.js 22 or newer (`node --version`). Ink 8 needs it.
- npm (`npm --version`)
- An SSH client (`ssh -V`; built into macOS, Linux and Windows 10+)

If `node` or `npm` is missing in your shell but you use nvm, run
`source ~/.nvm/nvm.sh && nvm use default`. Inside this repository, the
`./npmw` wrapper in each demo app does that for you.

## Step 1: Generate a New App

```bash
./init.sh my-app            # minimal starter (the default)
./init.sh my-app ecommerce  # products, cart and checkout
```

The first argument is the directory to create, the second the app type. The
script refuses to write into a directory that is not empty. `./init.sh --help`
shows the usage.

## Step 2: Install and Test

```bash
cd my-app
npm install
npm test
```

`npm test` runs the unit and screen tests, then starts the server on a free
port and connects to it over SSH. It does not need a host key.

## Step 3: Start the Server

```bash
npm run generate-keys       # creates keys/host_key
cp .env.example .env        # optional: port and listen address
npm start
```

## Step 4: Connect

In another terminal:

```bash
ssh localhost -p 2222
```

You should see:

- a title bar on the first row: `My App › Home`
- a menu panel with a cyan border on the left, details on the right
- key hints on the last row: `↑↓ move  ⏎ open  1-2 jump  q quit`

Arrow keys move, Enter opens, `b` goes back, `q` quits. Ctrl-C always quits.

---

## Trying the Demo Apps

Each demo is an app directory in this repository:

```bash
cd <app-directory>
./npmw install
./npmw run generate-keys
cp .env.example .env        # optional
./npmw start
# in another terminal: ssh localhost -p 2222
```

`./quick-start.sh` does the same from a menu.

| App | What it shows | Notes |
|---|---|---|
| `demo-shop` | products, cart, checkout form | the reference for `./init.sh my-app ecommerce` |
| `adventure-game` | text RPG narrated by an LLM | needs [Ollama](https://ollama.com/) for narration; set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` in `.env` |
| `admin-dashboard` | live stats of the machine it runs on | reads the host OS |
| `animation-demo` | ASCII animations | runs in your terminal, no SSH: `./npmw install && ./npmw start` |

Each screen lists its keys in the status bar. Each app's README has the details.

## Success Checks

After you connect to any SSH app:

- The title bar is on the first row and the key hints are on the last row.
- The UI fills the terminal; it does not scroll.
- Arrow keys move the selection, Enter selects.
- Resizing the terminal window redraws the screen at the new size.
- `q` disconnects cleanly, and your terminal looks as it did before.

## Troubleshooting

### The server does not start

- **EADDRINUSE**: port 2222 is in use. Stop the other server
  (`lsof -ti:2222 | xargs kill`) or set another `SSH_PORT` in `.env`.
- **Cannot find module**: run `npm install` again.
- **Host key not found**: run `npm run generate-keys`.
- **Unsupported engine / syntax errors in ink**: update Node to 22 or newer.

### You cannot connect

- **Connection refused**: start the server, and check the port.
- **Host key warning** after you generated a new key: remove the old entry
  with `ssh-keygen -R "[localhost]:2222"`.

### The screen looks wrong

- **No colors**: unset `FORCE_COLOR=0` or `NO_COLOR` in the server's
  environment.
- **Broken lines or boxes**: use a terminal with Unicode support (iTerm2,
  Terminal.app, GNOME Terminal, Windows Terminal, VS Code).

### Keys do not work

- Make sure the terminal window has focus.
- In a text field, `⏎` saves and `esc` cancels; `q` is just a letter there.

## Next Steps

1. Read the code of the screens in `src/ui/`. Each one is short.
2. Add a screen: [USAGE_GUIDE.md](USAGE_GUIDE.md#adding-a-screen).
3. Keep [QUICK_REFERENCE.md](QUICK_REFERENCE.md) open while you code.
4. Follow the screen rules in [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md).

---

**One line:**

```bash
./init.sh my-app && cd my-app && npm i && npm test && npm run generate-keys && npm start
```
