# Animation Demo

A standalone terminal animation viewer built with [Ink](https://github.com/vadimdemedes/ink)
and the shared [@shellcraft/ui](../ui/README.md) components. It shows a
collection of ASCII art animations full screen in the local terminal -- no
SSH server required.

<p align="center">
  <img src="../docs/images/animation-demo.svg" alt="animation-demo: several animations, switched with the number keys" width="748">
</p>

```
 Animation Demo › Crystal Ball                                       speed 1.0×
╭─ Crystal Ball ───────────────────────────────────╮╭─ Animations ─────────────╮
│                                                  ││ › Crystal Ball         1 │
│                                                  ││   Bubbling Cauldron    2 │
│                    .'''''''`.                    ││   Hourglass            3 │
│                  .'          `.                  ││   ...                    │
╰──────────────────────────────────────────────────╯╰──────────────────────────╯
 space pause  +/- speed  ←→ switch  1-7 jump  q quit       i Frame 1/4 · 350 ms
```

## Animations

| # | Name | Description | Interval |
|---|------|-------------|----------|
| 1 | Crystal Ball | Swirling mystic orb | 350 ms |
| 2 | Bubbling Cauldron | Animated potion brewing | 400 ms |
| 3 | Hourglass | Flowing sand timer | 500 ms |
| 4 | Atom Orbit | Spinning electron orbits | 150 ms |
| 5 | Wizard Casting | Wizard casting a spell | 500 ms |
| 6 | DNA Helix | Rotating double helix | 200 ms |
| 7 | Watson Orb | Pulsing energy orb | 200 ms |

## Quick Start

Node 22 or newer (Ink 8).

```bash
./npmw ci        # or ./npmw install
./npmw start
```

## Controls

| Key | Action |
|-----|--------|
| Left / Right | Previous / next animation (wraps around) |
| 1-7, Up / Down | Pick an animation from the list |
| Space | Pause / play (goes on from the same frame) |
| + or = / - or _ | Faster / slower, 0.2× steps from 0.2× to 5× (at least 50 ms a frame) |
| q / Ctrl-C | Quit |

The title bar shows the speed, the status bar the frame and the interval
(`Frame 2/4 · 350 ms`, or `Paused · frame 2/4`).

## Layout

The screen is the terminal's size (design target 80×24). The list of
animations is a 28-column panel on the right and has the focus; the stage
panel takes the rest and centers the frame. At 80×24 the stage has 48×18
cells inside; the largest frames are 25 columns (Wizard Casting) and 14 rows
(Crystal Ball), so every frame fits from 57×20 up. In a smaller terminal
the frame is clipped, not wrapped.

## Files

```
animation-demo/
├── package.json       # ink, react, @shellcraft/ui (file:../ui)
├── .npmrc             # install-links=true: ui is copied, one React
├── index.js           # Entry point: run() and wait until the app exits
├── app.js             # App (Screen, stage Panel, SelectList), run()
├── animations.js      # Animation frames (7 animations), normalize()
└── test/
    ├── screens.test.js  # every frame at 80×24 and 100×30, keys
    └── local.test.js    # renderLocal on a fake TTY + headless xterm
```

## How It Works

Each animation is an array of frames, where each frame is an array of
strings (lines of ASCII art), plus a base interval and a theme tone
(`accent`, `success`, `warning` or `default`; the theme names the colors).
`normalize()` pads every line to the animation's widest line and every frame
to its tallest, so the art stays in place from frame to frame.

The frame counter is Ink's `useAnimation({ interval })`. Pausing, a speed
change or a switch restarts it; the frame on screen is kept as the starting
point, so the animation goes on from where it was (a switch starts at frame
1). `renderLocal()` from @shellcraft/ui runs it full screen: alternate
screen, `q` and Ctrl-C quit, the terminal is restored and the process ends
by itself.

## Tests

```bash
./npmw test
```

`node --test test/*.test.js`: every frame of every animation rendered at
80×24 and 100×30 (whole, centered, no line wider than the terminal, nothing
bold and dim at once), the keys, and the app on a fake TTY behind
@xterm/headless (alternate screen, animating, resize, `q` and Ctrl-C exit,
`node index.js` ends by itself after `q`).

After changing `../ui`, run `./npmw ci` here: npm does not refresh a copied
`file:` package on `npm install`.

## Dependencies

| Package | Purpose |
|---------|---------|
| [ink](https://github.com/vadimdemedes/ink) | React for the terminal |
| [react](https://react.dev) | Components |
| [@shellcraft/ui](../ui/README.md) | Shared components, theme, `renderLocal()` |
| [@xterm/headless](https://github.com/xtermjs/xterm.js) (dev) | Headless terminal for the tests |

## License

MIT
