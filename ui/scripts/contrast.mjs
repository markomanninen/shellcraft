// Contrast of ANSI 8 ("bright black", chalk 'gray', the first muted color)
// on the terminal background, for common terminal themes: the reason muted
// text is now dim (SGR 2) instead. Prints the Markdown table used in
// ui/README.md:  node scripts/contrast.mjs
//
// WCAG 2.x relative luminance and contrast ratio:
// https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio

export const themes = [
  {
    name: 'VS Code Dark+',
    background: '#1E1E1E',
    brightBlack: '#666666',
    source:
      'ansiBrightBlack: microsoft/vscode src/vs/workbench/contrib/terminal/common/terminalColorRegistry.ts; ' +
      'background: editor.background of extensions/theme-defaults/themes/dark_vs.json (terminal.background is unset and falls back to the panel/editor background)'
  },
  {
    name: 'VS Code Light+',
    background: '#FFFFFF',
    brightBlack: '#666666',
    source: 'terminalColorRegistry.ts (light); light_vs.json editor.background'
  },
  {
    name: 'macOS Terminal, Basic',
    background: '#FFFFFF',
    brightBlack: '#666666',
    source: 'Terminal.app column of the 3/4-bit color table, en.wikipedia.org/wiki/ANSI_escape_code; Basic profile = black on white'
  },
  {
    name: 'iTerm2 default',
    background: '#000000',
    brightBlack: '#686868',
    source: 'mbadolato/iTerm2-Color-Schemes, "iTerm2 Default"'
  },
  {
    name: 'Windows Terminal, Campbell',
    background: '#0C0C0C',
    brightBlack: '#767676',
    source: 'learn.microsoft.com/windows/terminal/customize-settings/color-schemes (Campbell)'
  },
  {
    name: 'Solarized Dark',
    background: '#002B36',
    brightBlack: '#002B36',
    source: 'altercation/solarized README: base03 #002b36 is both "8/4 brblack" and the dark background'
  },
  {
    name: 'Dracula',
    background: '#282A36',
    brightBlack: '#6272A4',
    source: 'spec.draculatheme.com (Background, AnsiBrightBlack)'
  },
  {
    name: 'GNOME Terminal, default (light)',
    background: '#FFFFFF',
    brightBlack: '#5D5D5D',
    source: 'gnome-terminal src/org.gnome.Terminal.gschema.xml: palette[8] #5d5d5d, background-color #ffffff'
  },
  {
    name: 'GNOME Terminal, dark style',
    background: '#1E1E1E',
    brightBlack: '#5D5D5D',
    source: 'same palette; background assumed #1e1e1e (palette[0], the dark Adwaita view background)'
  }
];

const channel = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export function luminance(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const verdict = (ratio) => (ratio >= 4.5 ? 'AA text' : ratio >= 3 ? 'AA large / UI only' : 'fails');

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('| Terminal theme | Background | Bright black | Contrast | WCAG 2.1 |');
  console.log('|---|---|---|---|---|');
  for (const t of themes) {
    const ratio = contrast(t.brightBlack, t.background);
    console.log(`| ${t.name} | \`${t.background}\` | \`${t.brightBlack}\` | ${ratio.toFixed(2)}:1 | ${verdict(ratio)} |`);
  }
}
