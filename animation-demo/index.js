#!/usr/bin/env node
// ASCII animation viewer in the local terminal (no SSH). q or Ctrl-C quits;
// the process ends by itself once the app has left the alternate screen.
import { run } from './app.js';

const cleanup = run();
await cleanup.exited;
