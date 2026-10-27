// The only place colors are named. Components get their color props from
// textProps() / borderProps() / borderTextProps() below, never from literals.
//
// Colors are ANSI color names, so the user's terminal theme decides the RGB;
// `undefined` means the terminal's default foreground. Muted text and
// default borders are not a color at all: they are the default foreground
// dimmed (SGR 2, "faint"), which follows the user's theme and can never
// equal the background (ANSI 8 "bright black" is the background color in
// Solarized Dark, and under 4.5:1 on most dark themes; see README).
//
// The screen background is never painted: the only fill is surface.accent
// for the selected row and the focused button.
//
// Do not combine muted (dim) with bold: SGR 1 and 2 share the reset 22 and
// terminals that treat them as one "intensity" attribute (ECMA-48, the
// Linux console) show only the one set last.

export const DIM = 'dim';

export const theme = Object.freeze({
  text: Object.freeze({
    default: undefined,
    muted: DIM,
    accent: 'cyan',
    success: 'green',
    warning: 'yellow',
    danger: 'red',
    onAccent: 'black'
  }),
  surface: Object.freeze({
    accent: 'cyan'
  }),
  border: Object.freeze({
    default: DIM,
    focus: 'cyan',
    danger: 'red'
  })
});

const NONE = Object.freeze({});
const DIM_TEXT = Object.freeze({ dimColor: true });
const DIM_BORDER = Object.freeze({ borderDimColor: true });

function lookup(group, token, kind) {
  if (!Object.prototype.hasOwnProperty.call(group, token)) {
    throw new Error(`Unknown ${kind} token "${token}"`);
  }
  return group[token];
}

/**
 * Ink <Text> props for a text token:
 * 'muted' → { dimColor: true }, 'default' → {}, others → { color }.
 */
export function textProps(token = 'default') {
  const value = lookup(theme.text, token, 'text');
  if (value === DIM) return DIM_TEXT;
  return value === undefined ? NONE : { color: value };
}

/**
 * Ink <Box> border props for a border token:
 * 'default' → { borderDimColor: true }, 'focus' / 'danger' → { borderColor }.
 */
export function borderProps(token = 'default') {
  const value = lookup(theme.border, token, 'border');
  return value === DIM ? DIM_BORDER : { borderColor: value };
}

/**
 * <Text> props for borders and rules drawn by hand (Panel's top edge,
 * TextField's underline), so they match borderProps().
 */
export function borderTextProps(token = 'default') {
  const value = lookup(theme.border, token, 'border');
  return value === DIM ? DIM_TEXT : { color: value };
}

export const glyphs = Object.freeze({
  separator: '›',
  marker: '›',
  cursor: '█',
  barFull: '█',
  barEmpty: '░',
  info: 'i',
  success: '✓',
  warning: '!',
  error: '✗',
  // Braille "dots" spinner, the same frames as cli-spinners "dots".
  spinner: Object.freeze(['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'])
});

// Message tones: text tokens for the glyph and for the text.
export const tones = Object.freeze({
  info: Object.freeze({ glyph: glyphs.info, glyphToken: 'accent', textToken: 'default' }),
  success: Object.freeze({ glyph: glyphs.success, glyphToken: 'success', textToken: 'success' }),
  warning: Object.freeze({ glyph: glyphs.warning, glyphToken: 'warning', textToken: 'warning' }),
  error: Object.freeze({ glyph: glyphs.error, glyphToken: 'danger', textToken: 'danger' }),
  busy: Object.freeze({ glyph: null, glyphToken: 'accent', textToken: 'muted' })
});

// Meter tones: text token for the filled part of the bar.
export const meterTones = Object.freeze({
  default: 'accent',
  warning: 'warning',
  danger: 'danger'
});
