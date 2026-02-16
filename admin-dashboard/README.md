# Admin Dashboard

A terminal-based system monitoring dashboard accessible over SSH. Built with [ssh2](https://github.com/mscdex/ssh2) and [blessed](https://github.com/chjj/blessed), it displays real-time system information (CPU, memory, processes, network interfaces, services) directly in the terminal.

> **Security Warning**
>
> This application exposes real system information -- hostname, running processes, network interfaces, memory usage, and service status -- to any client that connects over SSH. Authentication is disabled for demo purposes (`none` auth method is accepted). **Do not run this on a public network or production server without adding proper authentication and access controls.**

## Features

- **Real-time system monitoring** using the Node.js `os` module and shell commands (`ps aux`, `launchctl`/`systemctl`)
- **SSH server** built on ssh2 for remote terminal access
- **Terminal UI** rendered with blessed (256-color, mouse support, scrollable regions)
- **Session management** via SSH public key fingerprint (falls back to `anonymous`)
- **Screen navigation** with a router that handles teardown and re-rendering between views
- **Reusable component library** for boxes, lists, tables, forms, inputs, buttons, and messages

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Dashboard Menu | `dashboard` | Main menu with navigation to all other screens |
| System Overview | `overview` | Hostname, platform, architecture, CPU count, memory, uptime, load averages |
| CPU and Memory | `resources` | Per-core CPU usage table and memory breakdown |
| Process Monitor | `processes` | Output of `ps aux` (top 10 processes) |
| System Logs | `logs` | Simulated log entries (randomly generated) |
| Network Info | `network` | All network interfaces with addresses, families, and netmasks |
| Services Status | `services` | Running services via `launchctl list` (macOS) or `systemctl` (Linux) |
| Settings | `settings` | Node version, environment info, and current session details |

## Architecture

```
src/
├── server/
│   ├── index.js        # SSH server entry point (ssh2)
│   ├── router.js       # Screen navigation and lifecycle management
│   └── session.js      # Session creation with fingerprint-based identity
├── ui/
│   ├── components.js   # Reusable blessed UI components
│   ├── dashboard.js    # Main dashboard menu
│   ├── overview.js     # System overview screen
│   ├── processes.js    # Process monitor screen
│   ├── resources.js    # CPU and memory screen
│   ├── logs.js         # System logs screen
│   ├── network.js      # Network interfaces screen
│   ├── services.js     # Running services screen
│   └── settings.js     # Environment and session info screen
└── models/
    └── system.js       # System data collection (os module, child_process)
```

## Quick Start

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

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SSH_PORT` | `2222` | Port the SSH server listens on |
| `HOST_KEY_PATH` | `./keys/host_key` | Path to the SSH host private key |
| `APP_NAME` | `Admin Dashboard` | Application display name |
| `NODE_ENV` | `development` | Node environment |

## Keyboard Controls

All screens share a common set of keyboard shortcuts:

| Key | Action |
|-----|--------|
| Up/Down arrows | Navigate menu items |
| Enter | Select menu item or activate button |
| `r` | Refresh current screen data |
| `b` or Escape | Go back to the dashboard menu |
| `q` or Ctrl-C | Quit the application |

## UI Components

The `UIComponents` class in `src/ui/components.js` provides factory methods for blessed widgets:

- **`createBox`** -- Static content container with border
- **`createList`** -- Selectable menu with keyboard and mouse support
- **`createTable`** -- Data grid (blessed `listtable`)
- **`createForm`** -- Input form container
- **`createInput`** -- Text input field
- **`createButton`** -- Clickable button with focus styling
- **`showMessage`** -- Timed popup notification (info, success, error, warning)

## How Navigation Works

The `CommandRouter` in `src/server/router.js` manages screen transitions:

1. Each screen is a class that receives a `context` object with `screen`, `session`, and `navigate`.
2. Calling `context.navigate('screenName')` tears down all current UI elements, clears key bindings, and instantiates the target screen class.
3. The global quit handler (`q`, `Ctrl-C`) is re-registered after each navigation to ensure it is always available.

## Session Data

Each SSH connection gets a session object containing:

- `id` -- Unique identifier (generated with nanoid)
- `fingerprint` -- MD5 hash of the client's SSH public key, or `"anonymous"` if no key is provided
- `createdAt` -- Timestamp of session creation

## Data Sources

The `SystemModel` in `src/models/system.js` collects data from:

- **`os.hostname()`**, **`os.platform()`**, **`os.arch()`** -- Host identification
- **`os.cpus()`** -- Per-core CPU model and usage calculation
- **`os.totalmem()`**, **`os.freemem()`** -- Memory statistics
- **`os.uptime()`**, **`os.loadavg()`** -- System uptime and load averages
- **`os.networkInterfaces()`** -- Network interface details
- **`ps aux | head -n 10`** -- Top running processes (macOS/Linux)
- **`launchctl list`** / **`systemctl list-units`** -- Running services (platform-dependent)

Logs shown on the Logs screen are simulated (randomly generated mock entries).

## Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# End-to-end tests only
npm run test:e2e
```

Tests use the Node.js built-in test runner (`node --test`). Test files are located in:

```
test/
├── unit/
│   ├── session.test.js
│   └── system.test.js
├── e2e/
│   ├── server.test.js
│   └── workflow.test.js
└── helpers/
    └── test-utils.js
```

## Development

Run with auto-reload:

```bash
npm run dev
```

This uses nodemon to restart the server when source files change.

## Dependencies

| Package | Purpose |
|---------|---------|
| [ssh2](https://github.com/mscdex/ssh2) | SSH server implementation |
| [blessed](https://github.com/chjj/blessed) | Terminal UI framework |
| [dotenv](https://github.com/motdotla/dotenv) | Environment variable loading |
| [nanoid](https://github.com/ai/nanoid) | Session ID generation |

## License

MIT
