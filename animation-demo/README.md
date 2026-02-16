# Animation Demo

A standalone terminal animation viewer built with [blessed](https://github.com/chjj/blessed). Displays a collection of ASCII art animations directly in the terminal -- no SSH server required.

## Animations

| Name | Description |
|------|-------------|
| Crystal Ball | Swirling mystic orb |
| Bubbling Cauldron | Animated potion brewing |
| Hourglass | Flowing sand timer |
| Atom Orbit | Spinning electron orbits |
| Wizard Casting | Wizard casting a spell |
| DNA Helix | Rotating double helix |
| Watson Orb | Pulsing energy orb |

## Quick Start

```bash
npm install
npm start
```

## Controls

| Key | Action |
|-----|--------|
| Left / Right | Switch between animations |
| q / Ctrl-C | Quit |

## Files

```
animation-demo/
├── package.json       # Project config (blessed dependency)
├── index.js           # Entry point, blessed screen setup, animation runner
└── animations.js      # Animation frame definitions (7 animations)
```

## How It Works

Each animation is defined as an array of frames, where each frame is an array of strings (lines of ASCII art). The viewer cycles through frames at the animation's configured interval. Frame lines are padded to consistent width for clean rendering.

## Dependencies

| Package | Purpose |
|---------|---------|
| [blessed](https://github.com/chjj/blessed) | Terminal UI framework |

## License

MIT
