// The only place colors are named. Components take colors from here, never
// from literals. Values are ANSI color names, so the user's terminal theme
// decides the actual RGB; `undefined` means "the terminal's default color".
// The screen background is never painted: the only fill is surface.accent
// for the selected row and the focused button.

export const theme = Object.freeze({
  text: Object.freeze({
    default: undefined,
    muted: 'gray', // ANSI 8, "bright black"
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
    default: 'gray',
    focus: 'cyan',
    danger: 'red'
  })
});

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

// Message tones: glyph color and text color.
export const tones = Object.freeze({
  info: Object.freeze({ glyph: glyphs.info, glyphColor: theme.text.accent, color: theme.text.default }),
  success: Object.freeze({ glyph: glyphs.success, glyphColor: theme.text.success, color: theme.text.success }),
  warning: Object.freeze({ glyph: glyphs.warning, glyphColor: theme.text.warning, color: theme.text.warning }),
  error: Object.freeze({ glyph: glyphs.error, glyphColor: theme.text.danger, color: theme.text.danger }),
  busy: Object.freeze({ glyph: null, glyphColor: theme.text.accent, color: theme.text.muted })
});

// Meter tones: bar color.
export const meterTones = Object.freeze({
  default: theme.text.accent,
  warning: theme.text.warning,
  danger: theme.text.danger
});
