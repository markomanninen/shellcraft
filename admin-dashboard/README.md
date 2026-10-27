# Admin Dashboard

A terminal-based system monitoring dashboard accessible over SSH. Built with [ssh2](https://github.com/mscdex/ssh2) and [Ink](https://github.com/vadimdemedes/ink) (through the shared [`@shellcraft/ui`](../ui/README.md) package), it displays live system information (CPU, memory, processes, network interfaces, services) directly in the terminal.

> **Security Warning**
>
> This application exposes real system information -- hostname, running processes, network interfaces, memory usage, and service status -- to any client that connects over SSH. Authentication is disabled for demo purposes (`none` auth method is accepted). **Do not run this on a public network or production server without adding proper authentication and access controls.**

## Features

- **Real-time system monitoring** using the Node.js `os` module and shell commands (`ps aux`, `launchctl`/`systemctl`)
- **SSH server** built on ssh2 for remote terminal access
- **Terminal UI** rendered with Ink (React for the terminal) via `@shellcraft/ui`: title bar, panels, tables, meters and a status bar, in the 16 ANSI colors of the user's own terminal theme
- **Live stats**: CPU, memory, load and processes refresh every 2 seconds on the screens that show them (`r` refreshes by hand)
- **Session management** via SSH public key fingerprint (falls back to `anonymous`)
- **Resizes with the terminal** (80×24 is the design target)

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Dashboard | `dashboard` | Menu + detail: the menu (focused) and a summary of the highlighted item that follows the selection; ⏎ opens it |
| System overview | `overview` | Hostname, platform, architecture, CPUs, uptime, load averages, memory; CPU and memory meters (live) |
| CPU & memory | `resources` | Overall and per-core CPU meters, memory meter and totals (live) |
| Processes | `processes` | `ps aux` (first 9 processes) as a table (live) |
| Logs | `logs` | Simulated log; follows new entries (one every 2 s), WARN in yellow, ERROR in red |
| Network | `network` | All interface addresses with family, netmask (IPv6 as prefix length) and internal flag |
| Services | `services` | `launchctl list` (macOS) or `systemctl list-units` (Linux) as a table |
| Settings | `settings` | Node version, server environment, client terminal type and the current session |

Meters turn yellow from 75 % and red from 90 %. Results and errors (for
example "Error fetching processes") appear in the status bar on the last row.

## Architecture

```
src/
├── server/
│   ├── index.js        # SSH server entry point (ssh2)
│   ├── router.js       # Hands each SSH shell to the Ink app (serve())
│   └── session.js      # Session creation with fingerprint-based identity
├── ui/                 # Ink screens (function components, no JSX)
│   ├── app.js          # AdminApp: current screen, status message, menu selection, log
│   ├── dashboard.js    # Home: menu + detail
│   ├── overview.js     # System overview screen and summary
│   ├── resources.js    # CPU & memory screen and summary
│   ├── processes.js    # Processes screen and summary
│   ├── logs.js         # Logs screen and summary
│   ├── network.js      # Network screen and summary
│   ├── services.js     # Services screen and summary
│   ├── settings.js     # Settings screen and summary
│   ├── parts.js        # Shared: label/value rows, meter tones, useData (live refresh), b/r keys
│   └── tables.js       # ps / launchctl / systemctl output → table columns and rows
└── models/
    └── system.js       # System data collection (os module, child_process)
```

## Quick Start

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

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SSH_PORT` | `2222` | Port the SSH server listens on |
| `HOST_KEY_PATH` | `./keys/host_key` | Path to the SSH host private key |
| `APP_NAME` | `Admin Dashboard` | Application display name |
| `NODE_ENV` | `development` | Node environment |

## Keyboard Controls

The status bar on the last row lists the keys of the current screen.

| Key | Action |
|-----|--------|
| ↑↓ or `k`/`j` | Move in the menu; scroll tables and the log |
| `1`-`7` | Jump to a menu item |
| Enter | Open the highlighted item |
| PgUp/PgDn, Home/End | Scroll a page, jump to the ends (End resumes following the log) |
| `r` | Refresh the screen's data |
| `b` or Escape | Back to the dashboard (the same item stays highlighted) |
| `q` or Ctrl-C | Quit |

## UI

The screens use the shared Ink package [`@shellcraft/ui`](../ui/README.md)
(`file:../ui`, copied into `node_modules` by `install-links=true` in
`.npmrc`, so there is one React). It provides `Screen` (title bar, body,
status bar), `Panel`, `SelectList`, `Table`, `Meter`, `ScrollView`,
`EmptyState`, the theme and the SSH adapter `serve()`. After changing
`../ui`, refresh the copy with `./npmw ci`.

The home screen is the Figma template *Menu + detail* (page 04 Templates):
`Admin › Dashboard` with the host name on the right, a 30-cell menu panel
with focus, and the detail panel beside it.

## How Navigation Works

`CommandRouter.handleConnection()` in `src/server/router.js` renders
`AdminApp` on the SSH channel with `serve()` (alternate screen, resize on
`window-change`, Ctrl-C, exit status 0). `AdminApp` holds the current screen
and passes each screen a `ctx` with `navigate(name)`, `notify(tone, text)`
for the status bar, the session and the `SystemModel`. A screen's refresh
timer belongs to the screen, so it stops when you navigate away or
disconnect.

## Session Data

Each SSH connection gets a session object containing:

- `id` -- Unique identifier (generated with nanoid)
- `fingerprint` -- MD5 hash of the client's SSH public key, or `"anonymous"` if no key is provided
- `createdAt` -- Timestamp of session creation

## Data Sources

The `SystemModel` in `src/models/system.js` collects data from:

- **`os.hostname()`**, **`os.platform()`**, **`os.arch()`** -- Host identification
- **`os.cpus()`** -- Per-core CPU model and usage, measured between two samples (the first since boot)
- **`os.totalmem()`**, **`os.freemem()`** -- Memory statistics
- **`os.uptime()`**, **`os.loadavg()`** -- System uptime and load averages
- **`os.networkInterfaces()`** -- Network interface details
- **`ps aux | head -n 10`** -- Top running processes (macOS/Linux)
- **`launchctl list`** / **`systemctl list-units`** -- Running services (platform-dependent)

Logs shown on the Logs screen are simulated (randomly generated mock entries).

## Testing

```bash
# Run all tests
./npmw test

# Unit tests only
./npmw run test:unit

# End-to-end tests only
./npmw run test:e2e
```

Tests use the Node.js built-in test runner (`node --test`). The screen tests
stub the `SystemModel`, so they do not depend on the machine. The e2e tests
need a host key (`./npmw run generate-keys`). Test files are located in:

```
test/
├── unit/
│   ├── screens.test.js      # every screen at 80×24 and 100×30 (demo data)
│   ├── ssh-adapter.test.js  # serve() on a fake SSH channel
│   ├── tables.test.js       # ps / launchctl / systemctl parsing
│   ├── session.test.js
│   └── system.test.js
├── e2e/
│   ├── server.test.js
│   └── workflow.test.js
└── helpers/
    ├── demo-system.js       # SystemModel stub with fixed demo data
    └── test-utils.js
```

## Development

Run with auto-reload:

```bash
./npmw run dev
```

This uses nodemon to restart the server when source files change.

## Dependencies

| Package | Purpose |
|---------|---------|
| [ssh2](https://github.com/mscdex/ssh2) | SSH server implementation |
| [`@shellcraft/ui`](../ui/README.md) | Shared Ink components, theme and SSH adapter |
| [ink](https://github.com/vadimdemedes/ink), [react](https://react.dev) | Terminal UI |
| [dotenv](https://github.com/motdotla/dotenv) | Environment variable loading |
| [nanoid](https://github.com/ai/nanoid) | Session ID generation |

## License

MIT
