// Run by ssh.test.js in a child process with piped stdio (no TTY): render
// a screen through serve() and report whether the bytes sent to the
// "client" carry ANSI colors. With --ink-first, ink is imported before the
// ui package, the order that used to defeat FORCE_COLOR tricks.
const inkFirst = process.argv.includes('--ink-first');
if (inkFirst) await import('ink');

const React = (await import('react')).default;
const { serve, colorLevel, Screen, Panel, Text } = await import('../../src/index.js');
const { FakeSshChannel: FakeChannel } = await import('../../src/testing.js');

const h = React.createElement;
const channel = new FakeChannel((_text, callback) => callback());
const cleanup = serve(
  channel,
  { cols: 80, rows: 24 },
  h(Screen, { app: 'Color', screen: 'Check', hints: [['q', 'quit']] }, h(Panel, { title: 'Panel' }, h(Text, null, 'hello')))
);
await new Promise((resolve) => setTimeout(resolve, 100));
const raw = channel.output.join('');
cleanup();
await cleanup.exited;

console.log(JSON.stringify({
  stdoutIsTTY: Boolean(process.stdout.isTTY),
  forceColor: process.env.FORCE_COLOR ?? null,
  level: colorLevel(),
  cyan: raw.includes('\u001B[36m'),
  dim: raw.includes('\u001B[2m')
}));
process.exit(0);
