# Design Principles

The shellcraft apps are SSH terminal apps. An [ssh2](https://github.com/mscdex/ssh2)
server runs one [Ink](https://github.com/vadimdemedes/ink) app per SSH session.
All four demo apps and every app that `init.sh` generates build their screens
from the shared package [`@shellcraft/ui`](ui/README.md).

This page has three parts:

1. [Screen rules](#screen-rules): how a screen looks and behaves.
2. [Ink over SSH](#ink-over-ssh): what `serve()` does, and why.
3. [App structure](#app-structure): patterns the apps share.

The visual reference is the Figma file
[shellcraft](https://www.figma.com/design/oykSSRdp0xDbaot7ZkLFQc)
(pages 02 Foundations, 03 Components, 04 Templates). Component props and the
theme tokens are in [ui/README.md](ui/README.md).

## Screen rules

### 1. One title bar and one status bar per screen

Every screen is one `Screen`. Row 0 is the title bar: `App › Screen` on the
left, short meta (for example `cart: 3 · $69.97`) on the right. The last row
is the status bar: key hints on the left, the latest message on the right.
The body fills the rows between them. Do not draw a second header or footer.

```js
h(Screen, {
  app: 'Demo Shop',
  screen: 'Cart',
  meta: 'cart: 3 · $69.97',
  hints: [['↑↓', 'move'], ['c', 'checkout'], ['b', 'back']],
  message: ctx.message
}, body)
```

### 2. Key hints read `q quit`

A hint is the key, one space, then a lowercase verb: `q quit`, `↑↓ move`,
`⏎ select`, `b back`, `esc cancel`. The key is bold cyan and the verb muted
(`KeyHint` does this). Hints are two spaces apart. Use the same keys in every
app: `↑↓` (or `k` `j`) move, `⏎` selects, `b` or `esc` goes back, `q` quits.
Show only the keys that work on the current screen.

### 3. Colors only through the theme

Screens never name colors. They call the theme helpers:

```js
h(Text, textProps('muted'), 'hint')            // { dimColor: true }
h(Box, { borderStyle: 'round', ...borderProps('focus') })
```

The theme uses the 16 ANSI color names, so the user's terminal theme decides
the actual colors. Cyan marks focus, selection and keys. Green and yellow are
for success and warnings. Red is only for errors. The screen background is
never painted; the only fill is the selected row and the focused button.

### 4. Muted is dim, and never bold at the same time

Muted text and unfocused borders are the default color with SGR 2 (dim), not
gray. Gray (ANSI 8) is invisible on Solarized Dark and low-contrast on most
dark themes ([details](ui/README.md#why-muted-is-dim-not-gray)). Do not make
text bold and dim at once: terminals that treat both as one "intensity" show
only one of them. The tests check this with `boldDimText()`.

### 5. No floating boxes

No popups, modals or message boxes over the content. A result or an error
goes to the status bar (`ctx.notify('success', 'Saved')`). A field error goes
under its field. A slow action shows a `busy` message (a spinner) in the
status bar.

### 6. No Exit items

Menus have no Exit or Quit item. `q` quits on every screen, except while the
user types into a field. Ctrl-C always quits.

### 7. One focused panel at a time

Panels have a round border with the title in the top edge. The focused panel
has a cyan border and title; the others are dim. Only the focused list or
table gets `isActive`, so keys go to one place.

### 8. Empty is not an error

An empty list shows `EmptyState`: what is empty and the next step, for
example `Your cart is empty.` and `Browse products from the menu: b back`.
No red, no box.

### 9. Whole cells, 80×24 first

Sizes are whole terminal cells. Design for 80×24 and check 100×30 and wider.
A screen fills the terminal exactly. Work out a table's height from
`useTerminalSize().rows` minus the rows around it. Long content scrolls in a
`ScrollView`, `Table` or `SelectList` with a `height`, with `↑ N more` /
`↓ N more` rows instead of a scrollbar.

### 10. No emoji in the UI

Emoji have different widths in different terminals, which breaks alignment
and the selection bar. Use plain text and the glyphs the theme uses:
`›` `✓` `✗` `!` `i` `⏎` `↑↓` `█` `░`.

### 11. Forms: pick a field, then edit it

A form has two modes. `↑↓` moves between fields and `⏎` starts editing one.
While editing, `⏎` saves and `esc` cancels, and the status bar says so
(`⏎ save  esc cancel`). The screen calls `ctx.setTyping(true)` while editing,
so `q` is just a letter. `⏎` on the form's button checks all fields and moves
the focus to the first invalid one.

## Ink over SSH

`serve(stream, ptyInfo, element, { session })` from `@shellcraft/ui` runs an
Ink app on an ssh2 channel. Each point below is a problem we hit. The ones
under "What serve() does" are covered by `ui/test/ssh.test.js`, which feeds
the output into a headless xterm.

### Capture the pty request

The terminal size comes with the `pty` request, before the `shell` request.
Keep it and pass it on, together with the ssh2 session, which later emits
`window-change` when the user resizes the window:

```js
session.once('pty', (accept, reject, info) => {
  ptyInfo = info;
  accept();
});
session.once('shell', (accept) => {
  const stream = accept();
  serve(stream, ptyInfo, h(App, { session: userSession }), { session });
});
```

### What serve() does

- **TTY.** It sets `stream.columns`, `stream.rows` and `stream.isTTY` from
  the pty (80×24 without one) and adds a no-op `setRawMode`. Ink then accepts
  the channel as its stdin and stdout.
- **Line ends.** Ink writes `\n` between rows. Over SSH the client terminal is
  in raw mode and a bare LF only moves down, so the rows would staircase.
  `serve()` writes `\r\n`.
- **Colors.** chalk picks its color level once, from the server process. A
  server without a TTY (systemd, pm2, docker, `npm start | tee`) would send
  no colors to anyone. The ui package pins Ink's chalk to the 16 ANSI colors.
  `FORCE_COLOR=0` or `NO_COLOR=1` turns colors off.
- **Interactive mode.** Ink switches to "non-interactive" output in CI and
  without a TTY. `serve()` forces interactive rendering.
- **Full screen.** The app runs in the alternate screen, so the user's
  terminal comes back unchanged on exit. `Screen` is exactly `rows` tall: one
  row more and Ink clears the terminal on every frame. Frames use
  synchronized output and incremental rendering, so a key press rewrites
  only the rows that changed.
- **Resize.** On `window-change` it re-renders at the new size first and only
  then lets Ink redraw. In the other order the old, taller layout scrolls the
  terminal for one frame.
- **Exit.** Ctrl-C or `useApp().exit()` unmounts the app, leaves the
  alternate screen, shows the cursor, sends exit status 0 and ends the
  channel. It then drains the channel, because ssh2 emits `close` (where the
  app destroys its session) only after the readable side ended.
- **Disconnect.** A client that goes away unmounts the app. ssh2 never calls
  back for writes to a closed channel, so those writes are dropped.
- **Many users.** Ink adds a process `beforeExit` listener per app, and Node
  warns at 11. `serve()` removes it.

`q` is the app's job (call `useApp().exit()`), because a text field needs
the letter. For apps in the local terminal (animation-demo), `renderLocal()`
does the same full-screen work without the SSH parts.

### Do not accept the `none` method if you want key fingerprints

OpenSSH first tries the `none` authentication method. A server that accepts
it lets the user in before the client offers a key, so every session is
anonymous. To see keys and still let users without a key in, reject `none`
and offer `publickey` and `keyboard-interactive`, and accept
keyboard-interactive without prompts. ssh2 does not check a key's signature:
the app must, or anyone can claim any key. The generated apps do this in
`src/server/auth.js`.

### Import ssh2 with the default import

ssh2 is a CommonJS module. `import { Server } from 'ssh2'` fails in an ES
module (Node cannot see that export). Import the default and destructure:

```js
import ssh2 from 'ssh2';
const { Server } = ssh2;
```

## App structure

These patterns come from demo-shop and the generated apps.

- **One app per shell.** `src/server/router.js` calls `serve()` for each
  shell. `src/ui/app.js` holds the current screen and the status message and
  passes a `ctx` (`navigate`, `notify`, `setTyping`, `quit`, `session`) to
  every screen.
- **A screen is a component.** `ctx.navigate(name)` renders another screen
  with a new key, so the old screen unmounts. Its `useInput` handlers,
  intervals and animations go with it. There are no key handlers to clean up
  by hand.
- **State per session.** Keep user state on the session object, not in
  module globals: many users share one server process.
- **Timers end with the screen.** Use `useInterval` for periodic refresh and
  Ink's `useAnimation` for frames. Both stop on unmount, so a closed session
  leaves no timer behind.
- **Layout is flexbox.** Panels without a size split the free space. Give
  fixed widths in cells where a column must not move (a 30-cell menu, table
  columns).

## Testing

- `renderTerminal()` from `@shellcraft/ui/testing` renders a screen on a fake
  terminal of a given size. Tests press keys and check rows, styles
  (`styleAt`) and that nothing is bold and dim (`boldDimText`). Check 80×24
  and 100×30.
- `FakeSshChannel` and `FakeSshSession` run the app through `serve()` and
  check the bytes a client gets: alternate screen, colors, CRLF, resize, exit.
- An e2e test starts the real server and connects with an ssh2 client.

## Checklist

- [ ] Every screen is one `Screen` with a title bar and a status bar
- [ ] Key hints read `q quit`; `q` quits, Ctrl-C always quits
- [ ] No color names in app code: `textProps` / `borderProps` only
- [ ] Nothing bold and dim at once
- [ ] No popups or floating boxes; results in the status bar
- [ ] No Exit menu items
- [ ] One focused panel; only the focused list is `isActive`
- [ ] Empty states say what to do next, without red
- [ ] Works at 80×24 and 100×30
- [ ] No emoji in the UI
- [ ] Forms: pick a field, `⏎` edit, `⏎` save, `esc` cancel; `ctx.setTyping`
- [ ] The server passes `ptyInfo` and the ssh2 session to `serve()`
- [ ] Key signatures are checked; `none` is not accepted if sessions need key fingerprints
- [ ] ssh2 imported with the default import
- [ ] Screen tests with `renderTerminal()`, an SSH adapter test, an e2e test
