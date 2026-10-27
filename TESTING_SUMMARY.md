# Testing

All tests use Node's built-in test runner (`node:test`). There is no test
framework to install.

## What Is Tested Where

| Where | Tests | Command |
|---|---|---|
| `ui/` | components, screen layout, scrolling, `serve()` over a fake SSH channel, `renderLocal()` | `cd ui && npm test` |
| demo apps | models, sessions, screens, SSH adapter (`test/unit/`); the real SSH server and workflows (`test/e2e/`) | `./npmw test` |
| generated apps | the same layers, created by `init.sh` | `npm test` |

CI (`.github/workflows/test.yml`) runs `npm ci` and `npm test` on Node 24 for
`ui`, `demo-shop`, `admin-dashboard`, `adventure-game` and `animation-demo`.
For the SSH apps it runs `npm run generate-keys` first.

## The Layers

### 1. Logic (unit)

Plain functions and classes: product and system models, session managers,
form validation, the adventure game's rules and LLM engine (with a mocked
Ollama client).

```js
it('should create anonymous session without key', () => {
  const session = new SessionManager().createSession(null);
  assert.strictEqual(session.fingerprint, 'anonymous');
});
```

### 2. Screens (unit)

`renderTerminal()` from `@shellcraft/ui/testing` renders the app on a fake
terminal of a given size. The test presses keys and checks what the user
would see:

```js
import { renderTerminal, cleanupTerminals, styleAt, boldDimText, tick } from '@shellcraft/ui/testing';

afterEach(() => cleanupTerminals());

it('home: menu focused, q quit hint', async () => {
  const t = renderTerminal(h(App, { session }), { columns: 80, rows: 24 });
  await tick(20);
  const lines = t.lines();
  assert.equal(lines.length, 24);                                 // fills the terminal
  assert.ok(lines[0].startsWith(' Demo Shop › Home'));            // title bar
  assert.equal(lines.at(-1), ' ↑↓ move  ⏎ select  1-3 jump  q quit');  // status bar
  assert.equal(styleAt(t.lastFrame(), 'Menu').fg, 'cyan');        // focused panel
  assert.equal(boldDimText(t.lastFrame()), '');                   // never bold + dim
  await t.press('enter');
  assert.ok(t.lines()[0].includes('Products'));
});
```

Good screen tests check:

- every screen at 80×24 and 100×30 (`t.resize()` for live resizes);
- row 0 is the title bar and the last row the status bar;
- no row is wider than the terminal;
- styles through `styleAt()`: focus is cyan, muted is dim, errors are red;
- results appear in the status bar, and there is no floating box;
- `q` quits, except while a field is being edited.

`cleanupTerminals()` in `afterEach` unmounts everything, so a failing test
cannot leave a spinner running and keep the process alive.

### 3. SSH adapter (unit)

`FakeSshChannel` and `FakeSshSession` stand in for ssh2. The test runs the
app through the router and `serve()` and checks the raw bytes:

```js
const channel = new FakeSshChannel((_text, done) => done());
const sshSession = new FakeSshSession();
const cleanup = new CommandRouter().handleConnection(channel, session, { cols: 80, rows: 24 }, sshSession);
await tick(80);
const out = channel.takeOutput();
assert.ok(out.startsWith('\u001B[?1049h'));   // alternate screen
assert.ok(out.includes('\u001B[36m'));        // colors without a TTY
assert.ok(!/[^\r]\n/.test(out));              // CRLF line ends
sshSession.windowChange(100, 30);             // resize
channel.type('q');
await cleanup.exited;                         // exit status 0, channel ended
```

### 4. Real server (e2e)

`test/e2e/server.test.js` starts `src/server/index.js` as a child process and
connects with an ssh2 client: plain connection, anonymous shell, and a pty
session that renders the home screen, resizes and quits with `q`.

In generated apps the e2e tests pick a free port and create a throwaway host
key, so they run right after `npm install`. They also sign in with a client
key, without a key (keyboard-interactive), and check that `none` alone is
refused; `test/unit/auth.test.js` checks the signature handling. The demo
apps use port 2223 and `keys/host_key` (run `npm run generate-keys` first).

## Running Tests

```bash
npm test               # unit, then e2e
npm run test:unit      # fast, no server
npm run test:e2e       # starts the server
npm run test:watch     # re-run on changes
node --test test/unit/screens.test.js   # one file
```

In this repository's demo apps, use `./npmw` in place of `npm`.

## Testing the Generator

`init.sh` has no CI job. To check a change, generate each app type into a
temporary directory outside the repository and run its tests:

```bash
for type in minimal ecommerce; do
  ./init.sh "/tmp/check-$type" "$type"
  (cd "/tmp/check-$type" && npm install && npm test)
done
```

Then start one (`npm run generate-keys && npm start`), connect with
`ssh localhost -p 2222`, and quit with `q`.
