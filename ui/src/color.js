// Pin Ink's colors to the basic 16 ANSI colors.
//
// chalk (inside Ink) picks its color level once, at import time, from the
// *server* process. Over SSH the server often has no TTY (systemd, pm2,
// docker, CI, `npm start | tee`), so chalk decides "no colors" for every
// client; with a truecolor server terminal it would pick 24-bit instead.
// Neither says anything about the client's terminal. Every terminal we
// target handles the 16 ANSI colors, which is all the theme uses, so set
// level 1 on the chalk copy Ink itself imports. This works whatever was
// imported first, and leaves process.env alone.
//
// Opt out (no colors at all) with FORCE_COLOR=0 or NO_COLOR=1.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const env = process.env;
export const colorDisabled =
  env.FORCE_COLOR === '0' || env.FORCE_COLOR === 'false' || (env.NO_COLOR !== undefined && env.NO_COLOR !== '');

let inkChalk = null;
try {
  // Resolve chalk from Ink's own location, so this is the very instance
  // Ink's <Text> uses (also with nested node_modules or pnpm).
  const inkEntry = fileURLToPath(import.meta.resolve('ink'));
  const chalkPath = createRequire(inkEntry).resolve('chalk');
  inkChalk = (await import(pathToFileURL(chalkPath).href)).default;
} catch {
  inkChalk = null;
}

if (inkChalk) {
  inkChalk.level = colorDisabled ? 0 : 1;
}

/** chalk level Ink renders with (0 none, 1 basic 16 colors), or null if unknown. */
export const colorLevel = () => (inkChalk ? inkChalk.level : null);
