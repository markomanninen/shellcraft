# SSH Terminal App Design Principles

This document captures the critical design principles discovered while building SSH-based terminal applications with blessed and ssh2.

## Critical SSH/Blessed Integration Rules

### 1. Set Stream Dimensions BEFORE Creating Screen

**Problem**: blessed.screen() cannot determine terminal dimensions from SSH streams, causing blank screens.

**Solution**: Set stream properties before creating the screen:

```javascript
handleConnection(stream, session, ptyInfo) {
  // CRITICAL: Set stream dimensions BEFORE creating blessed screen
  stream.columns = ptyInfo?.cols || 80;
  stream.rows = ptyInfo?.rows || 24;
  stream.isTTY = true;
  
  // Now create the screen
  const screen = blessed.screen({...});
}
```

### 2. Disable smartCSR

**Problem**: blessed's smart rendering buffers output, which doesn't flush properly over SSH.

**Solution**: Always set `smartCSR: false`:

```javascript
const screen = blessed.screen({
  smartCSR: false,  // CRITICAL: Disable smart rendering
  input: stream,
  output: stream,
  terminal: 'xterm-256color',
  fullUnicode: true
});
```

### 3. Capture PTY Info in SSH Session

**Problem**: Terminal dimensions are communicated via the PTY request, not the shell request.

**Solution**: Capture ptyInfo and pass it to the router:

```javascript
// In index.js SSH server setup:
session.once('pty', (accept, reject, info) => {
  ptyInfo = info;  // Capture dimensions
  accept();
});

session.once('shell', (accept, reject) => {
  const stream = accept();
  router.handleConnection(stream, userSession, ptyInfo);  // Pass ptyInfo
});
```

## UI Design Principles

### 4. Avoid Emojis in TUI Elements

**Problem**: Emojis have variable character widths (1-2 cells) but are counted as single characters, causing layout issues and selection bar overflow.

**Solution**: Use ASCII characters or simple text instead of emojis.

```javascript
// BAD
items: ['📦 Products', '🛒 Cart', '💳 Checkout']

// GOOD  
items: ['  Products', '  Cart', '  Checkout']
```

### 5. Use Fixed Widths for Nested Elements

**Problem**: Percentage widths (`'96%'`) in nested elements can cause infinite recursion in width calculation.

**Solution**: Use fixed numeric widths:

```javascript
// BAD - can cause stack overflow
const list = blessed.list({
  parent: container,
  width: '98%',  // Percentage inside container
  height: '100%-3'
});

// GOOD
const list = blessed.list({
  parent: container,
  width: 90,  // Fixed width
  height: 10
});
```

### 6. Clean Up Key Handlers on Navigation

**Problem**: Screen-level key handlers (`screen.key()`) persist across navigation, causing duplicate handlers and unexpected behavior. Note: `screen.unkey(key)` without the exact callback reference does nothing in blessed — handlers accumulate silently.

**Solution**: Use nuclear cleanup with `removeAllListeners` for all `key *` events, then re-register the global quit handler:

```javascript
// Global quit handler — saved so we can re-register after cleanup
const quitHandler = () => {
  // Don't quit when typing in a text input (q would disconnect!)
  if (screen.focused && screen.focused.type === 'textbox') return;
  screen.destroy();
  stream.end();
};
screen.key(['C-c', 'q'], quitHandler);

// Save original method before override
const originalKey = screen.key.bind(screen);

const context = {
  navigate: (screenName, data) => {
    // Remove ALL 'key *' listeners, then re-register quit handler
    const keyEvents = Object.keys(screen._events || {}).filter(
      e => e.startsWith('key ')
    );
    keyEvents.forEach(event => {
      screen.removeAllListeners(event);
    });
    originalKey(['C-c', 'q'], quitHandler);

    // Destroy UI and show new screen
    while (screen.children.length > 0) {
      screen.children[0].destroy();
    }
    screen.clearRegion(0, screen.width, 0, screen.height);
    this.showScreen(screenName, context, data);
  }
};
```

**Important**: Blessed uses a custom EventEmitter, not Node's — `screen.eventNames()` does not exist. Use `Object.keys(screen._events || {})` instead.

### 7. Use blessed.list Instead of blessed.listtable for Selection

**Problem**: `blessed.listtable` has unreliable selection highlighting.

**Solution**: Use `blessed.list` with formatted text items:

```javascript
const items = products.map(p => {
  return `${p.id.padEnd(10)} ${p.name.padEnd(22)} $${p.price.toFixed(2)}`;
});

const list = blessed.list({
  items: items,
  style: {
    selected: { bg: 'white', fg: 'black', bold: true },
    item: { fg: 'white' }
  },
  keys: true,
  vi: true,
  mouse: true
});
```

### 8. Form Fields - Selection Mode vs Edit Mode

**Problem**: blessed's textbox captures Tab and other keys, making navigation difficult.

**Solution**: Use a two-mode approach:
1. **Selection mode**: Navigate between fields with arrow keys
2. **Edit mode**: Press Enter to edit, Enter to save, Escape to cancel

```javascript
// Field selection with arrow keys
this.screen.key(['up'], () => { currentField--; updateSelection(); });
this.screen.key(['down'], () => { currentField++; updateSelection(); });
this.screen.key(['enter'], () => { editField(); });
```

### 9. Robust Error Handling for Async Operations

**Problem**: Timeouts and async operations can crash if screen state changes.

**Solution**: Wrap in try-catch and check element existence:

```javascript
setTimeout(() => {
  try {
    if (msg && msg.parent) {
      msg.destroy();
      screen.render();
    }
  } catch (e) {}
}, 2000);
```

## SSH2 Import Pattern

**Problem**: ssh2 uses CommonJS exports, causing import issues with ES modules.

**Solution**: Use default import then destructure:

```javascript
// BAD - doesn't work
import { Server } from 'ssh2';

// GOOD
import ssh2 from 'ssh2';
const { Server } = ssh2;
```

## Summary Checklist

When building SSH terminal apps:

- [ ] Set `stream.columns`, `stream.rows`, `stream.isTTY` before `blessed.screen()`
- [ ] Use `smartCSR: false` in screen options
- [ ] Capture `ptyInfo` from PTY event and pass to router
- [ ] Avoid emojis in UI elements
- [ ] Use fixed widths for nested elements
- [ ] Track and cleanup screen-level key handlers on navigation
- [ ] Use `blessed.list` for reliable selection highlighting
- [ ] Use selection/edit mode pattern for forms
- [ ] Wrap async operations in try-catch
- [ ] Import ssh2 with default import pattern
