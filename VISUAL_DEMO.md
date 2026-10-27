# Visual Demo

What you see when you connect. The frames below are real: the app code
rendered them on an 80×24 terminal with `renderTerminal()` from
`@shellcraft/ui/testing`. They are shown without colors; the
[color legend](#colors) says where color goes. The design source is the
[Figma file](https://www.figma.com/design/oykSSRdp0xDbaot7ZkLFQc)
(04 Templates has every layout).

## Anatomy of a Screen

```
 App › Screen                                                         meta   ← title bar (row 0)
╭─ Focused panel ─────────────╮╭─ Other panel ───────────────────────────────╮
│                             ││                                             │  ← body: panels fill
│                             ││                                             │    the rows between
╰─────────────────────────────╯╰─────────────────────────────────────────────╯
 ↑↓ move  ⏎ select  q quit                                    ✓ last message   ← status bar (last row)
```

- **Title bar**: app name (bold cyan) `›` screen name (bold), meta on the right (dim).
- **Panels**: round borders with the title in the top edge. One panel has focus
  (cyan); the others are dim.
- **Status bar**: key hints (`q quit`: key in bold cyan, verb dim) and the
  latest message. Results appear here, never in a popup.

## demo-shop

### Home (menu + detail)

```
 Demo Shop › Home                                              cart: 3 · $69.97
╭─ Menu ─────────────────────╮╭─ Cart ─────────────────────────────────────────╮
│ › Browse products        1 ││                                                │
│   View cart              2 ││ Developer Blend         2 × $24.99             │
│   Checkout               3 ││ Terminal Espresso       1 × $19.99             │
│                            ││                                                │
│                            ││ Total                   $69.97                 │
│                            ││                                                │
│                            ││                                                │
│                            ││                                                │
│                            ││                                                │
│                            ││                                                │
│                            ││                                                │
│                            ││                                                │
│                            ││                                                │
│                            ││                                                │
│                            ││                                                │
│                            ││                                                │
│                            ││                                                │
│                            ││                                                │
│                            ││                                                │
│                            ││                                                │
│                            ││                                                │
╰────────────────────────────╯╰────────────────────────────────────────────────╯
 ↑↓ move  ⏎ select  1-3 jump  q quit
```

The selected row `› Browse products` is black on cyan. There is no Exit item:
`q` quits.

### Products (table), after pressing `a`

```
 Demo Shop › Products                                          cart: 1 · $24.99
╭─ Products ───────────────────────────────────────────────────────────────────╮
│ ID         Name                     Description                        Price │
│ prod_001   Developer Blend          Dark roast for late nights        $24.99 │
│ prod_002   Terminal Espresso        Quick and powerful                $19.99 │
│ prod_003   Command Line Coffee      Medium roast, smooth finish       $21.99 │
│ prod_004   Git Commit Grounds       Light roast with fruity notes     $22.99 │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯
 ↑↓ move  a add to cart  c cart  b back         ✓ Added Developer Blend to cart
```

The header row is dim and underlined. `✓ Added …` is green, in the status bar.

### Cart (table + total)

```
 Demo Shop › Cart                                              cart: 3 · $69.97
╭─ Cart ───────────────────────────────────────────────────────────────────────╮
│ Product                                             Qty     Price   Subtotal │
│ Developer Blend                                       2    $24.99     $49.98 │
│ Terminal Espresso                                     1    $19.99     $19.99 │
│                                                                              │
│ Total                                                                 $69.97 │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯
 ↑↓ move  c checkout  x clear cart  b back
```

### Cart, empty

```
 Demo Shop › Cart                                                   cart: empty
╭─ Cart ───────────────────────────────────────────────────────────────────────╮
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                             Your cart is empty.                              │
│                    Browse products from the menu: b back                     │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯
 ↑↓ move  c checkout  x clear cart  b back
```

An empty list is not an error: no red, no box, and a hint for the next step.

### Checkout (form), after `⏎` on `[ Place order ]` with two bad fields

```
 Demo Shop › Checkout                                          cart: 3 · $69.97
╭─ Shipping ───────────────────────────────────────────────────────────────────╮
│                                                                              │
│ Name       Marko                                                             │
│                                                                              │
│ Email      m@                                                                │
│            ✗ Enter a full address                                            │
│ Address    Street, city                                                      │
│            ✗ Enter a shipping address                                        │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯
╭─ Order ──────────────────────────────────────────────────────────────────────╮
│                                                                              │
│ Developer Blend         2 × $24.99                                           │
│ Terminal Espresso       1 × $19.99                                           │
│                                                                              │
│ Total                   $69.97                                               │
│                                                                              │
│ [ Place order ]                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯
 ↑↓ field  ⏎ edit  b back                        ✗ Fix 2 fields before ordering
```

Field errors are red, under their field. Focus moved to the first bad field
(Email). `Street, city` is a dim placeholder. While a field is being edited,
the status bar reads `⏎ save  esc cancel`.

### Navigation

```
Home
 ├─ ⏎ Browse products ─▶ Products   a add to cart · c → Cart · b/esc → Home
 ├─ ⏎ View cart ───────▶ Cart       c → Checkout · x clear cart · b/esc → Home
 └─ ⏎ Checkout ────────▶ Checkout   ⏎ edit a field · ⏎ [ Place order ] → Home · b/esc → Cart
```

`1`-`3` move the selection to a menu item. `q` quits everywhere except while
a field is being edited. Ctrl-C always quits. A placed order returns to Home
with `✓ Order placed: 3 items, $69.97` in the status bar.

## A Generated App (`./init.sh my-app`)

### Home

```
 My App › Home                                                      user: marko
╭─ Menu ─────────────────────╮╭─ Getting started ──────────────────────────────╮
│ › Getting started        1 ││                                                │
│   Session                2 ││ Where the code lives and how to add a screen   │
│                            ││ of your own.                                   │
│                            ││                                                │
```

### Getting started (scrolling text)

```
 My App › Getting started
╭─ Getting started ────────────────────────────────────────────────────────────╮
│                                                                              │
│ How this app works                                                           │
│ src/server/index.js runs the SSH server. For every shell,                    │
│ src/server/router.js passes the channel to serve() from @shellcraft/ui,      │
│ which renders the Ink app in src/ui/app.js.                                  │
│                                                                              │
│ Add a screen                                                                 │
│ 1. Create src/ui/my-screen.js: a function component that returns one Screen. │
│ 2. Add it to the screens map in src/ui/app.js.                               │
│ 3. Open it with ctx.navigate('my-screen'). Give it a b back key.             │
│                                                                              │
│ Design rules                                                                 │
│ - One title bar and one status bar per screen. Screen draws both.            │
│ - Key hints read "q quit": the key, then the verb.                           │
│ - Colors only through the theme helpers (textProps, borderProps).            │
│ - Results go to the status bar (ctx.notify), not into floating boxes.        │
│ - No Exit menu items: q quits.                                               │
│                                                                              │
│ ↓ 5 more                                                                     │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯
 ↑↓ scroll  b back  q quit
```

`↓ 5 more` (dim) replaces a scrollbar.

### Session (table without a selection bar)

```
 My App › Session
╭─ Session ────────────────────────────────────────────────────────────────────╮
│ Field        Value                                                           │
│ Session      Nn91pE3_M-YwUNvUFs7yr                                           │
│ User         marko                                                           │
│ Key          anonymous                                                       │
│ Connected    2026-10-27 20:40:01 UTC                                         │
│ Terminal     80×24                                                           │
```

The `Terminal` row follows when you resize the window.

## The Other Demo Apps

adventure-game, admin-dashboard and animation-demo use the same parts: one
title bar, panels, one status bar with key hints. Their screens are described
in each app's README.

## Colors

| Where | Color |
|---|---|
| App name in the title bar, keys in hints, focused panel border and title | cyan |
| Selected row, focused button | black on cyan |
| Hint verbs, meta, placeholders, unfocused borders, table headers | default color, dim |
| Success messages | green |
| Warnings | yellow |
| Errors (messages and field errors) | red |
| Everything else | the terminal's default color |

The 16 ANSI colors follow the user's terminal theme. The background is never
painted.

## Sizes

The screens are designed for 80×24 and fill any larger terminal. Resizing the
window redraws the screen at the new size. Tables and lists that do not fit
scroll, with `↑ N more` / `↓ N more` rows.

## A Session, Step by Step

```
$ ssh localhost -p 2222
  Demo Shop › Home                        the menu has focus
  ⏎                                       → Products
  ↓ a                                     ✓ Added Terminal Espresso to cart
  c                                       → Cart: 1 item, total $19.99
  c                                       → Checkout, Name field focused
  ⏎ John Doe ⏎                            name saved
  ↓ ⏎ john@example.com ⏎                  email saved
  ↓ ⏎ 123 Main St ⏎                       address saved
  ↓ ⏎                                     [ Place order ]
  Demo Shop › Home                        ✓ Order placed: 1 item, $19.99
  q
Connection to localhost closed.
```

Your terminal looks as it did before you connected: the app ran in the
alternate screen.
