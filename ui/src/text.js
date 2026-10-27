// Cell widths and word wrapping for text the ui lays out itself
// (ScrollView, TextField). Widths come from Ink's own string-width, so
// they agree with how Ink measures and draws.
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

function wrapParagraph(paragraph, width, hangingIndent, keepIndent) {
  const line = paragraph.replace(/\t/g, '  ').replace(/\s+$/, '');
  if (line === '') return [''];
  // A paragraph's leading spaces are its indent: wrapped lines keep it
  // (keepIndent) plus hangingIndent more, but always leave room for text.
  const lead = keepIndent ? line.match(/^ */)[0] : '';
  const firstIndent = lead.slice(0, Math.max(width - 1, 0));
  const contIndent = ' '.repeat(Math.min(textWidth(lead) + hangingIndent, Math.max(width - 1, 0)));
  const tokens = line.slice(lead.length).split(/( +)/).filter((t) => t !== '');

  const lines = [];
  let current = firstIndent;
  let used = textWidth(firstIndent);
  let hasText = false;
  let pendingSpace = '';

  const breakLine = () => {
    lines.push(current);
    current = contIndent;
    used = contIndent.length;
    hasText = false;
    pendingSpace = '';
  };

  for (const token of tokens) {
    if (token.startsWith(' ')) {
      if (hasText) pendingSpace = token;
      continue;
    }
    let word = token;
    let w = textWidth(word);
    const space = hasText ? textWidth(pendingSpace) : 0;
    if (used + space + w <= width) {
      current += (hasText ? pendingSpace : '') + word;
      used += space + w;
      hasText = true;
      pendingSpace = '';
      continue;
    }
    if (hasText) breakLine();
    // A word longer than the line: break it hard.
    while (used + w > width) {
      let [head, rest] = splitAtWidth(word, width - used);
      if (head === '') [head, rest] = [graphemes(word)[0], word.slice(graphemes(word)[0].length)];
      current += head;
      hasText = true;
      breakLine();
      word = rest;
      w = textWidth(word);
    }
    if (word) {
      current += word;
      used += w;
      hasText = true;
    }
  }
  if (hasText || lines.length === 0) lines.push(current);
  return lines;
}

/**
 * Word-wrap text to `width` cells. Paragraphs are separated by "\n"; a
 * paragraph's leading spaces are kept on its wrapped lines (keepIndent),
 * plus `hangingIndent` cells more, e.g. 3 to line wrapped text up under
 * "T1 " in a log line. Words longer than a line are broken. Runs of spaces
 * inside a line are kept.
 */
export function wrapText(text, width, { hangingIndent = 0, keepIndent = true } = {}) {
  const w = Math.max(Math.floor(width), 1);
  return String(text ?? '')
    .split(/\r?\n/)
    .flatMap((paragraph) => wrapParagraph(paragraph, w, Math.max(hangingIndent, 0), keepIndent));
}
