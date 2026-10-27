// Small pieces the admin screens share: the screen frame (title, meta,
// b/r keys), label widths and meter tones. Label/value rows (InfoRow,
// infoRows, BlankRow) and the data hook (useData) come from @shellcraft/ui.
import React from 'react';
import { Screen, useInput } from '@shellcraft/ui';

const h = React.createElement;

export const APP_NAME = 'Admin';

/** Label column of the full screens (fits "Architecture"). */
export const LABEL_WIDTH = 14;
/** Label column of the home detail panel (Figma: 12 cells). */
export const SUMMARY_LABEL_WIDTH = 12;

/** Meter tone for a percentage: warning from 75 %, danger from 90 %. */
export function meterTone(percent) {
  if (percent >= 90) return 'danger';
  if (percent >= 75) return 'warning';
  return 'default';
}

/**
 * Keys every screen but home shares: b (or Esc) back to the dashboard, r
 * reload (when the screen has a `refresh`), with "Refreshed" in the status
 * bar once the new data is on screen. q is handled by the app.
 */
export function useScreenKeys(ctx, refresh) {
  useInput((input, key) => {
    if (input === 'b' || key.escape) {
      ctx.navigate('dashboard');
    } else if (input === 'r' && refresh) {
      Promise.resolve(refresh()).then((shown) => {
        if (shown) ctx.notify('success', 'Refreshed');
      });
    }
  });
}

/** Status bar hints of a detail screen. */
export function screenHints({ scroll = false, refresh = false } = {}) {
  return [
    scroll ? ['↑↓', 'scroll'] : null,
    refresh ? ['r', 'refresh'] : null,
    ['b', 'back'],
    ['q', 'quit']
  ].filter(Boolean);
}

/**
 * Screen with the app name and the host name as title bar meta. `message`
 * overrides the app's status message (e.g. a load error).
 */
export function AdminScreen({ ctx, screen, hints, message, children }) {
  return h(
    Screen,
    { app: APP_NAME, screen, meta: ctx.hostname, hints, message: message ?? ctx.message },
    children
  );
}

/** Status bar message while a screen waits for its first data, or failed. */
export function loadMessage({ loading, error, data }, what) {
  if (error) return { tone: 'error', text: error };
  if (loading && data === undefined) return { tone: 'busy', text: `Loading ${what}` };
  return undefined;
}
