# @shellcraft/ui

Shared [Ink](https://github.com/vadimdemedes/ink) components, theme and SSH
adapter for the shellcraft apps. Plain ESM JavaScript, no build step
(`const h = React.createElement`, no JSX). The visual language follows the
Figma file *shellcraft* (pages 02 Foundations, 03 Components, 04 Templates).

- Ink 8, React 19 (peer dependencies: the app provides them, so there is one React)
- ssh2 1.x for `@shellcraft/ui/auth` only (an optional peer dependency)
- Node 22 or newer (Ink 8's engine range; CI uses Node 24)
- Changes: [CHANGELOG.md](CHANGELOG.md)

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
`useInput`, `useApp` and `useAnimation`:

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
| `StatusBar` | `hints: [[key, label]], message` | Hints two spaces apart, the latest message right-aligned. `message`: `'text'`, `{ tone, text }` or an element. When space runs out the message is shortened (`…`) first; the hints are cut only when not even 12 cells of message fit. |
| `KeyHint` | `k, label` | `q quit`: key bold cyan, verb muted. |
| `Message` | `tone: info\|success\|warning\|error\|busy`, children | `i` / `✓` / `!` / `✗` / spinner + text, one line. |
| `Panel` | `title, focused, width?, height?, padding = 1` | Round border with the title in the top edge: `╭─ Title ───╮`. Lists and tables use `padding={0}`. |
| `SelectList` / `ListItem` | `items: [{label, hint, disabled}], selectedIndex, onChange, onSelect, isActive, focused = true, height?` | ↑↓ (k/j) move, ⏎ select, 1-9 jump. Selected row: cyan fill, black bold, `›`. `focused={false}`: no selection bar and no keys (e.g. actions while typing elsewhere). With `height`, scrolls to keep the selection in view, with `↑ N more` / `↓ N more` rows. |
| `Table` / `TableRow` | `columns: [{label, width, align, grow}], rows, selectedIndex, onChange, onSelect, isActive, height?` | Header muted and underlined, no rules, cells truncate, 1 space between columns. `selectedIndex={-1}`: no selection bar. `height` = body rows; see Scrolling. |
| `TextField` | `label, value, focused, editing = focused, error, placeholder, onChange, onSubmit, onCancel, labelWidth = 11, valueWidth = 30` | Label column, value underlined; editing shows `█` (always at the end) and takes keys; error adds `✗ message` under the value. `valueWidth: 'fill'` takes the rest of the row; `labelWidth: 0` drops the label column. |
| `ScrollView` | `text \| lines \| rows, height?, width?, hangingIndent = 0, keepIndent = true, follow, offset, onOffsetChange, isActive, keys = 'all'` | Fixed-height scrolling region; see Scrolling. |
| `MoreIndicator` | `direction: 'up'\|'down', count, indent` | The dim `↑ N more` row the scrolling components use. |
| `Button` | `label, focused` | `[ label ]`; focused = cyan fill. Form actions only. |
| `Meter` | `label, value, max = 100, display?, tone` | 36 cells: label 8, bar 20, value 8 right-aligned. |
| `EmptyState` | `message, hint, k, label` | Centered, no box, no red. |
| `InfoRow` | `label, value, tone = 'default', bold, labelWidth = 11` | Muted label in a fixed column (always one cell before the value), value in default or a tone; both truncate. A muted value is never bold. |
| `infoRows(rows, labelWidth = 11)` | `[[label, value, tone?] \| null]` | InfoRows as an element array; `null` is a `BlankRow`. |
| `BlankRow` | | One empty row. |

Controlled lists: pass `selectedIndex` and `onChange`; without `onChange`
the component keeps its own selection. Only the focused list should have
`isActive` (the default) so keys go to one place.

### Hooks and helpers

- `useData(load, { interval })`: `{ data, error, loading, refresh }` from a
  sync or async loader. A sync loader renders with data on the first frame;
  `interval` (ms) reloads while the component is mounted and skips a tick
  while a load is still running; results that arrive after unmount or after
  a newer reload are dropped; a failed reload keeps the old data and sets
  `error` (a string). `refresh()` returns a promise of `true` when its result
  was shown.
- `useInterval(callback, ms)`: periodic callback, the latest one used, `ms`
  null pauses, cleared on unmount.
- `useAnimation({ interval })`: Ink's frame counter, re-exported (one shared
  timer for all animated components).
- `wrapText(text, width, { hangingIndent, keepIndent })`,
  `wrapSegments(segments, width, options)` (styled pieces per wrapped line),
  `textWidth(text)` (cells, from Ink's string-width),
  `truncateToWidth(text, cells)` (ends in `…`), `hintsWidth(hints)`.
- `wrappedRowCount(lines, width, options)`, `layoutLines(...)` and
  `maxScrollOffset(rows, height)` / `scrollLayout(...)`: the arithmetic
  ScrollView uses, for screens that drive one themselves.
- The theme helpers (`textProps`, `borderProps`, `borderTextProps`).

### Scrolling

`ScrollView`, `Table` and `SelectList` with a `height` show a window of
their content. When content is hidden, the first row says `↑ N more` and the
last `↓ N more` (dim; no colored scrollbar). Windows under 3 rows get no
indicators.

`ScrollView` takes one of:

- `text`: a string; `"\n"` separates paragraphs, each is word-wrapped;
- `lines`: each wrapped, one of `string`, `{ text, tone, bold,
  hangingIndent, keepIndent }` (`tone` a theme text token: `'muted'`,
  `'success'`, ...) or `{ segments: [{ text, tone, bold }], hangingIndent,
  keepIndent }` for several styles in one line, e.g. a muted turn number and
  the entry:
  `{ segments: [{ text: 'T1  ', tone: 'muted' }, { text: 'Arrived at the square' }], hangingIndent: 4 }`;
- `rows`: `[node]`, one row each, not wrapped.

Wrapping keeps a paragraph's leading spaces on its wrapped lines
(`keepIndent`), plus `hangingIndent` cells, so an indented narrative
paragraph stays indented and `T1 Arrived ...` log lines wrap under the text
(`hangingIndent: 3`). Long words are broken; wide characters count two
cells. Without `height`/`width` the view fills its parent (flexGrow) and
measures itself, which costs one extra render on mount; pass them when you
know the size. Keys while `isActive`: ↑↓ / k j, PgUp PgDn, Home End;
`keys: 'page'` leaves out ↑↓ and k j, so a list next to the view keeps them
(a story above an action list). `follow` keeps the view at the end as lines
are added until the user scrolls up (logs, a story); give it a new `key` to
start at the end again (a new turn). `offset` + `onOffsetChange` make it
controlled.

```js
h(Panel, { title: 'Story', focused: true },
  h(ScrollView, { lines: story, follow: true }),          // fills the panel
  h(TextField, { label: '>', labelWidth: 2, valueWidth: 'fill',
                 value, focused: true, onChange: setValue, onSubmit: act }))
```

`Table` with `height` keeps its header; the body rows scroll so the
selected row stays visible (↑↓, PgUp PgDn, Home End move the selection).
With `selectedIndex={-1}` the same keys scroll the rows. Work the height out
from the terminal: `useTerminalSize().rows` minus the rows around the table
(title bar, panel edges and padding, header, status bar).

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

## SSH authentication: `@shellcraft/ui/auth`

```js
import { authenticate, fingerprintOf } from '@shellcraft/ui/auth';

client.on('authentication', (ctx) => authenticate(ctx, (key) => { publicKey = key; }));
// later: session.fingerprint = fingerprintOf(publicKey)   // "SHA256:…" or 'anonymous'
```

`authenticate(ctx, onKey, { anonymous = true, allowKey = () => true })`:

- **publickey:** ssh2 leaves the signature check to the server; without it
  anyone could claim any public key. A key query without a signature is
  answered yes; `onKey(ctx.key)` is called only after the signature
  verified. `allowKey(key, ctx)` can turn keys away (an allow-list).
- **keyboard-interactive:** accepted without prompts: an anonymous session
  (`anonymous: false` turns that off and offers only publickey).
- **none, password, hostbased:** rejected, offering `AUTH_METHODS`
  (`publickey`, `keyboard-interactive`). OpenSSH tries `none` first; the
  first versions of the apps accepted it, so every user was anonymous and
  the client never offered its keys.

It is a separate entry point, so apps without SSH (animation-demo) do not
load ssh2. `test/auth.test.js` signs in with ssh2 and with the OpenSSH
client (when `ssh` is installed): with a key, without one, and with only
`none`. ssh2 clients without a key need `tryKeyboard: true` and a
`'keyboard-interactive'` handler that answers `finish([])`.

## Local terminal: `renderLocal()`

For apps that run in the local terminal instead of over SSH
(animation-demo):

```js
const cleanup = renderLocal(h(App), { quitKeys: ['q'] });
await cleanup.exited;          // the process can then exit on its own
```

`renderLocal(element, { stdin, stdout, quitKeys = [], altScreen = true,
incrementalRendering = true, onExit })` shares the full-screen code with
`serve()` (`src/fullscreen.js`): alternate screen with the cursor homed, a
Screen exactly the terminal's size, synchronous relayout on `'resize'`
(SIGWINCH) before Ink redraws, Ctrl-C and `quitKeys` exit, the alternate
screen left while Ink unmounts, so also on SIGINT/SIGTERM. No CRLF
translation: a local tty does that itself. Returns `cleanup()` with
`.exited` and `.instance`. `serve()` takes `quitKeys` too.

## Testing helpers

`@shellcraft/ui/testing` (used by the ui tests and the apps' tests):

- `renderTerminal(element, { columns, rows })`: render on a fake terminal of
  that size; `text()`, `lines()`, `lastFrame()`, `press('down', 'enter', 'a')`,
  `resize(cols, rows)`, `unmount()`, `waitUntilExit()`.
- `cleanupTerminals()`: unmount everything `renderTerminal` mounted and end
  every `serve()` / `renderLocal()` session still running; call it in
  `afterEach`. A test that fails halfway otherwise leaves its app mounted,
  and a live spinner, `useInterval` or animation keeps the test process
  alive after the last test: the run never ends. (The shellcraft test
  scripts also pass `--test-force-exit` as a safety net.)
- `waitFor(predicate, { timeout, interval, message })`: poll until a
  condition holds, e.g. a text in a fake SSH channel's output, instead of
  sleeping a fixed time that a loaded machine overruns.
- `styleAt(rawFrame, text)`: `{ fg, bg, bold, dim, underline }` of a text on
  screen; `styleAtCell(rawFrame, row, column)` for a cell.
- `boldDimText(rawFrame)`: characters that are bold and dim at once (should
  be `''`).
- `stripAnsi`, `keys`, `tick`.
- `FakeSshChannel`, `FakeSshSession`: a duplex stand-in for an ssh2 channel
  (`type()`, `disconnect()`, `exitCode`) and a session that emits
  `'window-change'`.
- `createFakeTty({ columns, rows, onOutput })`: TTY stdin/stdout for
  `renderLocal` tests (`type()`, `resize()`, `stdin.rawMode`). Feed the
  output to `@xterm/headless` with `convertEol: true` (the tty's ONLCR).

`npm test` runs `node --test test/*.test.js`.

## Vendored copy (`init.sh`)

Apps generated with `init.sh` carry this package as `vendor/ui`: `src/`,
this README, the changelog, `LICENSE` and `package.json` without `devDependencies` and
`scripts` (the tests stay here). They depend on it with
`"@shellcraft/ui": "file:./vendor/ui"`; npm links a `file:` path inside the
project, so `vendor/ui` uses the app's react, ink and ssh2 and there is one
React. Generated apps have no `.npmrc`: `install-links=true`, which the
shellcraft apps use to copy `../ui`, would make `npm ls` report the link as
invalid there. The generated `src/server/auth.js` wraps
`@shellcraft/ui/auth`.

To update a generated app, copy `ui/src`, `ui/README.md` and
`ui/package.json` (without its devDependencies and scripts) over
`vendor/ui`, then run `npm install` and `npm test`. The version and commit
the app was generated from are in its README.

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
