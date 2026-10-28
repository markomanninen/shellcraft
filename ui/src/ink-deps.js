// Load a package the way Ink itself resolves it (chalk, string-width), so
// ui uses the very instance Ink renders with, also with nested
// node_modules or pnpm, without declaring Ink's internals as our deps.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function importFromInk(name) {
  try {
    const inkEntry = fileURLToPath(import.meta.resolve('ink'));
    const path = createRequire(inkEntry).resolve(name);
    return (await import(pathToFileURL(path).href)).default;
  } catch {
    return null;
  }
}
