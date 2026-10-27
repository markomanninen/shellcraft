# @shellcraft/ui

Shared [Ink](https://github.com/vadimdemedes/ink) components, theme and SSH
adapter for the shellcraft apps. Plain ESM JavaScript, no build step
(`const h = React.createElement`, no JSX). The visual language follows the
Figma file *shellcraft* (pages 02 Foundations, 03 Components, 04 Templates).

- Ink 8, React 19 (peer dependencies: the app provides them, so there is one React)
- Node 22 or newer (Ink 8's engine range; CI uses Node 24)

## Using it in an app

```jsonc
// package.json
"dependencies": {
  "@shellcraft/ui": "file:../ui",
  "ink": "^8.0.0",
  "react": "^19.3.1"
}
```

```ini
# .npmrc: copy the package into node_modules instead of symlinking it, so
# ui/ resolves react and ink from the app (one React) and `npm ci` works
# per app directory.
install-links=true
```

`npm ls react` in the app must show a single `react@19.x` (the others
`deduped`). npm does not refresh a copied `file:` package on a plain
`npm install`: after changing `ui/`, run `npm ci` in the app (or
`rm -rf node_modules/@shellcraft/ui && npm install`).

Import everything from the package, including Ink's `Box`, `Text`,
`useInput` and `useApp`:

```js
import React from 'react';
import { serve, Screen, Panel, SelectList } from '@shellcraft/ui';
const h = React.createElement;
```

## Theme

`theme.js` is the only place colors are named; colors are ANSI color names,
so the user's terminal theme decides the RGB. Muted text and default borders
are not a color: they are the terminal's default foreground with SGR 2
("faint"), which terminals draw blended toward the background (roughly 50%;
xterm.js uses half opacity). Faint follows the user's theme and can never be
the background color, which ANSI 8 can (see the contrast table below). The
screen background is never painted.

| Token | Value | Use |
|---|---|---|
| `text.default` | terminal default | body text |
| `text.muted` | default, dim (SGR 2) | hints, labels, placeholders, empty states |
| `text.accent` | `cyan` | app name, focus, keys |
| `text.success` / `warning` / `danger` | `green` / `yellow` / `red` | messages; red only for errors |
| `text.onAccent` | `black` | text on the accent fill |
| `surface.accent` | `cyan` | selected row, focused button |
| `border.default` / `focus` / `danger` | default, dim / `cyan` / `red` | panel borders; one focused panel at a time |

Components never spell out color props; they ask the theme:

```js
textProps('muted')          // { dimColor: true }
textProps('accent')         // { color: 'cyan' }
textProps('default')        // {}
borderProps('default')      // { borderDimColor: true }  for <Box borderStyle>
borderProps('focus')        // { borderColor: 'cyan' }
borderTextProps('default')  // { dimColor: true }        for borders drawn as text
```

**Bold and dim are never combined.** Ink (chalk) sends SGR `1`, then `2`,
and one `22` that resets both. xterm.js keeps bold and faint as separate
flags (checked with @xterm/headless), but ECMA-48 defines them as one
"intensity" attribute and terminals that follow it (the Linux console, for
one) show only the one set last. So the muted table header is dim +
underline and the meter label is dim, not bold; a bold label (the cart
total) is default-colored. `boldDimText()` in the testing helpers checks
frames for it.

## Components

All sizes are whole terminal cells. Design target 80×24; everything also
works at 100×30 and wider.

| Component | Props | Notes |
|---|---|---|
| `Screen` | `app, screen, meta, hints, message, width?, height?` | Full terminal (size from the stream, updated on resize). Row 0 TitleBar, last row StatusBar, body fills the rest. |
| `TitleBar` | `app, screen, meta` | `App › Screen` left, meta right, 1 cell padding. |
| `StatusBar` | `hints: [[key, label]], message` | Hints two spaces apart, the latest message right-aligned. `message`: `'text'`, `{ tone, text }` or an element. |
| `KeyHint` | `k, label` | `q quit`: key bold cyan, verb muted. |
| `Message` | `tone: info\|success\|warning\|error\|busy`, children | `i` / `✓` / `!` / `✗` / spinner + text, one line. |
| `Panel` | `title, focused, width?, height?, padding = 1` | Round border with the title in the top edge: `╭─ Title ───╮`. Lists and tables use `padding={0}`. |
| `SelectList` / `ListItem` | `items: [{label, hint, disabled}], selectedIndex, onChange, onSelect, isActive, height?` | ↑↓ (k/j) move, ⏎ select, 1-9 jump. Selected row: cyan fill, black bold, `›`. |
| `Table` / `TableRow` | `columns: [{label, width, align, grow}], rows, selectedIndex, onChange, onSelect, isActive, height?` | Header muted and underlined, no rules, cells truncate, 1 space between columns. `selectedIndex={-1}`: no selection bar. |
| `TextField` | `label, value, focused, editing = focused, error, placeholder, onChange, onSubmit, onCancel` | Label 11 cells, value 30 cells underlined; editing shows `█` and takes keys; error adds `✗ message` under the value. |
| `Button` | `label, focused` | `[ label ]`; focused = cyan fill. Form actions only. |
| `Meter` | `label, value, max = 100, display?, tone` | 36 cells: label 8, bar 20, value 8 right-aligned. |
| `EmptyState` | `message, hint, k, label` | Centered, no box, no red. |

Controlled lists: pass `selectedIndex` and `onChange`; without `onChange`
the component keeps its own selection. Only the focused list should have
`isActive` (the default) so keys go to one place.

## SSH: `serve()`

```js
// in the ssh2 'session' handler
session.once('pty', (accept, reject, info) => { ptyInfo = info; accept(); });
session.once('shell', (accept) => {
  const stream = accept();
  const cleanup = serve(stream, ptyInfo, h(App, props), { session });
});
```

`serve(stream, ptyInfo, element, { session, onExit, altScreen = true })`
renders on the channel and returns `cleanup()` (idempotent) with
`cleanup.resize(cols, rows)`, `cleanup.exited` (a promise) and
`cleanup.instance`. Ctrl-C always ends the session; `q` is the app's job
(call `useApp().exit()`), because a text field needs the letter.

What it does, and why (all covered by `test/ssh.test.js`, which feeds the
output into a headless xterm):

- **TTY:** sets `stream.columns/rows/isTTY` from the pty (80×24 without
  one) and adds a no-op `setRawMode`; the ssh client already has its own
  terminal in raw mode.
- **Line ends:** Ink writes `\n` between rows. A local tty turns that into
  CR LF (ONLCR), but an ssh2 server has no pty and the client terminal is
  raw (OpenSSH turns OPOST off), so a bare LF would only move down and the
  rows would staircase. `serve()` writes `\r\n`.
- **Colors:** chalk decides its color level once, from the *server*
  process, which over SSH often has no TTY: no colors for anyone. `color.js`
  resolves the chalk copy Ink imports and pins it to level 1 (the 16 ANSI
  colors the theme uses), whatever was imported first. `FORCE_COLOR=0` or
  `NO_COLOR` turns colors off. Tested in a child process without a TTY.
- **Interactive mode:** Ink switches itself to "non-interactive" (only the
  last frame, at exit) in CI and when stdout is not a TTY; `serve()` forces
  `interactive: true`.
- **Full screen:** the alternate screen is entered (with the cursor homed)
  before the first frame and left on exit. The Screen is exactly `rows`
  tall: Ink treats that as full screen and writes no trailing newline, so
  nothing scrolls. One row more and Ink would clear the terminal on every
  frame. Frames are wrapped in synchronized output (DEC 2026) and
  `incrementalRendering` is on, so a key press rewrites only the changed
  rows (about 400 bytes instead of 2.7 KB for a full 80×24 redraw).
- **Resize:** with `options.session`, `'window-change'` updates the size,
  clears the screen, re-renders the tree at the new size *synchronously*
  and only then emits `'resize'`. In the other order Ink first draws the old
  layout (24 rows into an 18-row terminal: it scrolls for a frame).
- **Exit:** Ctrl-C or `exit()` unmounts, leaves the alternate screen, shows
  the cursor, sends exit status 0 and ends the channel. The channel is then
  drained: ssh2 only emits `'close'` after its readable side ended, and with
  Ink gone nobody reads it, so the app's `'close'` handler (session cleanup)
  would never run.
- **Disconnect:** `'close'` unmounts. ssh2 never calls back for writes to a
  closed channel, which would leave Ink's unmount waiting forever, so such
  writes are dropped.
- **Many users:** Ink's `waitUntilExit()` adds a process `'beforeExit'`
  listener per instance (Node warns at 11); `serve()` removes it, since a
  server's event loop never runs dry.

## Testing helpers

`@shellcraft/ui/testing` (used by the ui tests and the apps' tests):

- `renderTerminal(element, { columns, rows })`: render on a fake terminal of
  that size; `text()`, `lines()`, `lastFrame()`, `press('down', 'enter', 'a')`,
  `resize(cols, rows)`, `unmount()`, `waitUntilExit()`.
- `styleAt(rawFrame, text)`: `{ fg, bg, bold, underline }` of a text on screen.
- `stripAnsi`, `keys`, `tick`.
- `FakeSshChannel`, `FakeSshSession`: a duplex stand-in for an ssh2 channel
  (`type()`, `disconnect()`, `exitCode`) and a session that emits
  `'window-change'`.

`npm test` runs `node --test test/*.test.js`.

## Why muted is dim, not gray

The first version used ANSI 8 (bright black, chalk `gray`) for muted text
and default borders. Its contrast against the background, computed from each
theme's published palette with the WCAG 2.1 formula
(`node scripts/contrast.mjs`):

| Terminal theme | Background | Bright black | Contrast | WCAG 2.1 |
|---|---|---|---|---|
| VS Code Dark+ | `#1E1E1E` | `#666666` | 2.90:1 | fails (see note) |
| VS Code Light+ | `#FFFFFF` | `#666666` | 5.74:1 | AA text |
| macOS Terminal, Basic | `#FFFFFF` | `#666666` | 5.74:1 | AA text |
| iTerm2 default | `#000000` | `#686868` | 3.77:1 | AA large / UI only |
| Windows Terminal, Campbell | `#0C0C0C` | `#767676` | 4.31:1 | AA large / UI only |
| Solarized Dark | `#002B36` | `#002B36` | 1.00:1 | invisible |
| Dracula | `#282A36` | `#6272A4` | 3.03:1 | AA large / UI only |
| GNOME Terminal, default (light) | `#FFFFFF` | `#5D5D5D` | 6.58:1 | AA text |
| GNOME Terminal, dark style | `#1E1E1E` | `#5D5D5D` | 2.53:1 | fails |

Sources:

- VS Code: `terminal.ansiBrightBlack` in
  [terminalColorRegistry.ts](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/terminal/common/terminalColorRegistry.ts)
  (`#666666` dark and light); `terminal.background` is unset and falls back
  to the panel/editor background, `editor.background` of
  [dark_vs.json](https://github.com/microsoft/vscode/blob/main/extensions/theme-defaults/themes/dark_vs.json)
  (`#1E1E1E`) and light_vs.json (`#FFFFFF`). Note: VS Code's
  `terminal.integrated.minimumContrastRatio` is on by default and lifts text
  to 4.5:1 when drawing ([docs](https://code.visualstudio.com/docs/terminal/appearance)),
  so in VS Code muted text ends up readable.
- macOS Terminal: Terminal.app column of the 3/4-bit color table in
  [ANSI escape code](https://en.wikipedia.org/wiki/ANSI_escape_code#3-bit_and_4-bit)
  (bright black 102,102,102); the Basic profile is black on white.
- iTerm2: "iTerm2 Default" in
  [mbadolato/iTerm2-Color-Schemes](https://github.com/mbadolato/iTerm2-Color-Schemes)
  (`windowsterminal/iTerm2 Default.json`).
- Windows Terminal: Campbell in
  [Color schemes](https://learn.microsoft.com/windows/terminal/customize-settings/color-schemes).
- Solarized: [README](https://github.com/altercation/solarized#the-values):
  base03 `#002b36` is both the dark background and the `8 brblack` slot.
- Dracula: [spec](https://spec.draculatheme.com/) (Background, AnsiBrightBlack).
- GNOME Terminal:
  [org.gnome.Terminal.gschema.xml](https://gitlab.gnome.org/GNOME/gnome-terminal/-/blob/master/src/org.gnome.Terminal.gschema.xml)
  (palette entry 8 `#5d5d5d`, `background-color` `#ffffff`). With the dark
  system style the background comes from the GTK theme; the dark row assumes
  `#1e1e1e` (palette entry 0).

Gray was fine on light themes and close to AA on Windows Terminal, but on
most dark themes it only met the 3:1 "large text / UI" level, and on
Solarized Dark it is the background color, so muted text disappeared. Hence
dim: it is derived from the theme's own foreground, so it always stays
between the text and the background. On Solarized Dark the foreground base0
`#839496` at about half strength over base03 is roughly `#426066`, about
2.2:1: low, but visible where gray was invisible. Muted is used for key-hint
verbs, title-bar meta, placeholders, disabled rows, empty-state hints, meter
labels, table headers and unfocused text-field labels; keys, values and
selected rows never depend on it. Terminals without SGR 2 support show muted
text at full strength, which costs hierarchy, not legibility.
