// Cell widths and word wrapping for text the ui lays out itself
// (ScrollView, TextField, StatusBar). Widths come from Ink's own
// string-width, so they agree with how Ink measures and draws.
import { importFromInk } from './ink-deps.js';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const graphemes = (text) => Array.from(segmenter.segment(text), (s) => s.segment);

const inkStringWidth = await importFromInk('string-width');

/** Terminal cells a string takes (wide CJK and emoji count 2). */
export const textWidth = inkStringWidth
  ? (text) => inkStringWidth(String(text ?? ''))
  : (text) => graphemes(String(text ?? '')).length;

/** Split `text` after at most `cells` cells: [head, rest]. */
export function splitAtWidth(text, cells) {
  let used = 0;
  let head = '';
  const parts = graphemes(text);
  for (let i = 0; i < parts.length; i++) {
    const w = textWidth(parts[i]);
    if (used + w > cells) return [head, parts.slice(i).join('')];
    head += parts[i];
    used += w;
  }
  return [head, ''];
}

/** The last at most `cells` cells of `text`. */
export function tailToWidth(text, cells) {
  let used = 0;
  let tail = '';
  const parts = graphemes(text);
  for (let i = parts.length - 1; i >= 0; i--) {
    const w = textWidth(parts[i]);
    if (used + w > cells) break;
    tail = parts[i] + tail;
    used += w;
  }
  return tail;
}

/** `text` cut to at most `cells` cells, ending in "…" when it was cut. */
export function truncateToWidth(text, cells) {
  const value = String(text ?? '');
  if (textWidth(value) <= cells) return value;
  if (cells <= 0) return '';
  return `${splitAtWidth(value, cells - 1)[0].trimEnd()}…`;
}

// Wrap one paragraph (no tabs, no newlines). Lines are lists of pieces
// { text, start }: start is the piece's offset in the source (base + index
// in `line`), or -1 for the indent added to wrapped lines.
function wrapPieces(line, base, width, hangingIndent, keepIndent) {
  const text = line.replace(/\s+$/, '');
  if (text === '') return [[]];
  // A paragraph's leading spaces are its indent: wrapped lines keep it
  // (keepIndent) plus hangingIndent more, but always leave room for text.
  const lead = keepIndent ? text.match(/^ */)[0] : '';
  const firstIndent = lead.slice(0, Math.max(width - 1, 0));
  const contIndent = ' '.repeat(Math.min(textWidth(lead) + hangingIndent, Math.max(width - 1, 0)));

  const tokens = [];
  let pos = lead.length;
  for (const part of text.slice(lead.length).split(/( +)/)) {
    if (part !== '') tokens.push({ text: part, start: base + pos });
    pos += part.length;
  }

  const lines = [];
  let current = firstIndent ? [{ text: firstIndent, start: base }] : [];
  let used = textWidth(firstIndent);
  let hasText = false;
  let pendingSpace = null;

  const breakLine = () => {
    lines.push(current);
    current = contIndent ? [{ text: contIndent, start: -1 }] : [];
    used = contIndent.length;
    hasText = false;
    pendingSpace = null;
  };

  for (const token of tokens) {
    if (token.text.startsWith(' ')) {
      if (hasText) pendingSpace = token;
      continue;
    }
    let word = token.text;
    let start = token.start;
    let w = textWidth(word);
    const space = hasText && pendingSpace ? textWidth(pendingSpace.text) : 0;
    if (used + space + w <= width) {
      if (hasText && pendingSpace) current.push(pendingSpace);
      current.push({ text: word, start });
      used += space + w;
      hasText = true;
      pendingSpace = null;
      continue;
    }
    if (hasText) breakLine();
    // A word longer than the line: break it hard.
    while (used + w > width) {
      let [head, rest] = splitAtWidth(word, width - used);
      if (head === '') {
        head = graphemes(word)[0];
        rest = word.slice(head.length);
      }
      current.push({ text: head, start });
      hasText = true;
      breakLine();
      start += head.length;
      word = rest;
      w = textWidth(word);
    }
    if (word) {
      current.push({ text: word, start });
      used += w;
      hasText = true;
    }
  }
  if (hasText || lines.length === 0) lines.push(current);
  return lines;
}

const cleanWidth = (width) => Math.max(Math.floor(width) || 1, 1);

/**
 * Word-wrap text to `width` cells. Paragraphs are separated by "\n"; a
 * paragraph's leading spaces are kept on its wrapped lines (keepIndent),
 * plus `hangingIndent` cells more, e.g. 3 to line wrapped text up under
 * "T1 " in a log line. Words longer than a line are broken. Runs of spaces
 * inside a line are kept.
 */
export function wrapText(text, width, { hangingIndent = 0, keepIndent = true } = {}) {
  const w = cleanWidth(width);
  return String(text ?? '')
    .replace(/\t/g, '  ')
    .split(/\r?\n/)
    .flatMap((paragraph) =>
      wrapPieces(paragraph, 0, w, Math.max(hangingIndent, 0), keepIndent).map((pieces) =>
        pieces.map((p) => p.text).join('')
      )
    );
}

/**
 * wrapText for styled text: `segments` is [{ text, ...style }], read as one
 * string (e.g. a muted "T1  " and then the entry). Returns the wrapped lines
 * as lists of { text, style } pieces, style being the segment the text came
 * from (null for the indent added to wrapped lines).
 */
export function wrapSegments(segments, width, { hangingIndent = 0, keepIndent = true } = {}) {
  const w = cleanWidth(width);
  const parts = segments.map((segment) => ({ segment, text: String(segment?.text ?? '').replace(/\t/g, '  ') }));
  const bounds = [];
  let pos = 0;
  for (const part of parts) {
    bounds.push({ from: pos, to: pos + part.text.length, style: part.segment });
    pos += part.text.length;
  }
  const plain = parts.map((p) => p.text).join('');

  const style = (pieces) => {
    const out = [];
    const push = (text, s) => {
      if (text === '') return;
      const last = out.at(-1);
      if (last && last.style === s) last.text += text;
      else out.push({ text, style: s });
    };
    for (const piece of pieces) {
      if (piece.start < 0) {
        push(piece.text, null);
        continue;
      }
      const end = piece.start + piece.text.length;
      for (const b of bounds) {
        const from = Math.max(piece.start, b.from);
        const to = Math.min(end, b.to);
        if (from < to) push(piece.text.slice(from - piece.start, to - piece.start), b.style);
      }
    }
    return out;
  };

  const lines = [];
  let base = 0;
  for (const raw of plain.split('\n')) {
    const paragraph = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    for (const pieces of wrapPieces(paragraph, base, w, Math.max(hangingIndent, 0), keepIndent)) {
      lines.push(style(pieces));
    }
    base += raw.length + 1;
  }
  return lines;
}
