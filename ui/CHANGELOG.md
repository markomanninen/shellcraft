# Changelog

All notable changes to `@shellcraft/ui`. Versions follow semver; the
package is private and consumed as `file:../ui` (shellcraft apps) or
`vendor/ui` (generated apps).

## 0.2.0

Pieces the four app ports had built locally, moved here. Everything from
0.1.0 keeps working as before.

### Added

- `@shellcraft/ui/auth`: `authenticate(ctx, onKey, { anonymous, allowKey })`,
  `AUTH_METHODS`, `fingerprintOf(key)`. Verifies publickey signatures before
  trusting a key, lets keyless clients in through keyboard-interactive
  without prompts, rejects `none` and passwords. ssh2 is an optional peer
  dependency, loaded only by this entry point.
- `InfoRow`, `infoRows(rows, labelWidth)`, `BlankRow`: label/value rows with a
  muted label column.
- `useData(load, { interval })`: sync/async loader with periodic reload;
  skips a tick while loading, drops late and stale results.
- `useAnimation` re-exported from Ink.
- `SelectList` `focused={false}`: the list without a selection bar, taking no
  keys.
- `ScrollView` `keys: 'page'` (only PgUp/PgDn/Home/End, so ↑↓ can belong to
  a list) and `keys: 'none'`.
- `ScrollView` `lines` entries with `segments: [{ text, tone, bold }]`: several
  styles in one wrapped line; per-line `keepIndent`.
- Exports: `wrappedRowCount`, `layoutLines`, `maxScrollOffset`,
  `scrollLayout`, `wrapSegments`, `truncateToWidth`, `hintsWidth`.
- README: SSH authentication and the vendored copy (`init.sh`).

### Changed

- `StatusBar`: when hints and message do not fit, the message is shortened
  (with `…`) first; the hints are cut only when not even 12 cells of
  message fit. Before, the hints were cut first.
- A muted `ScrollView` line or `InfoRow` value is never bold as well (bold
  and dim show as only one of them on some terminals).

## 0.1.0

First version, with the demo-shop port.

- Theme from the Figma file: ANSI color names only, muted text and default
  borders dim (SGR 2) on the terminal's default color; `textProps`,
  `borderProps`, `borderTextProps`.
- Components: `Screen`, `TitleBar`, `StatusBar`, `KeyHint`, `Message`,
  `Spinner`, `Panel` (title in the top border), `SelectList`/`ListItem`,
  `Table`/`TableRow`, `TextField`, `Button`, `Meter`, `EmptyState`,
  `ScrollView`, `MoreIndicator`.
- Scrolling with dim `↑ N more` / `↓ N more` rows in `ScrollView`, `Table`
  and `SelectList`; word wrap with hanging indent.
- `serve()`: Ink on an ssh2 channel (pty size, CRLF, 16 colors, alternate
  screen, incremental redraws, resize, clean exit and disconnect).
- `renderLocal()`: the same full-screen handling on the local terminal.
- `useInterval`, `useTerminalSize`, `wrapText`, `textWidth`.
- `@shellcraft/ui/testing`: `renderTerminal`, `styleAt`, `boldDimText`,
  fake SSH channel and TTY.
