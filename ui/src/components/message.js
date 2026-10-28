import React from 'react';
import { Text, useAnimation } from 'ink';
import { glyphs, tones, textProps } from '../theme.js';

const h = React.createElement;

/** A braille-dots spinner frame in the accent color. */
export function Spinner({ token = tones.busy.glyphToken, interval = 80 }) {
  const { frame } = useAnimation({ interval });
  return h(Text, textProps(token), glyphs.spinner[frame % glyphs.spinner.length]);
}

/**
 * One-line status message: glyph + text. Lives in the StatusBar or under a
 * field, never in a box over content.
 * tone: info | success | warning | error | busy
 */
export function Message({ tone = 'info', children }) {
  const t = tones[tone] ?? tones.info;
  const glyph = tone === 'busy'
    ? h(Spinner, { token: t.glyphToken })
    : h(Text, textProps(t.glyphToken), t.glyph);
  return h(Text, { wrap: 'truncate-end' }, glyph, ' ', h(Text, textProps(t.textToken), children));
}

/**
 * Normalise what apps pass as a status message:
 * null | 'text' | { tone, text } | a React element.
 */
export function toMessageElement(message) {
  if (message === null || message === undefined || message === false || message === '') return null;
  if (React.isValidElement(message)) return message;
  if (typeof message === 'string') return h(Message, { tone: 'info' }, message);
  return h(Message, { tone: message.tone ?? 'info' }, message.text ?? '');
}
