// Wizard Casting animation frames for LLM loading screen
const frames = [
  [
    '                *        ',
    '      /\\       .         ',
    '     /  \\                ',
    '    / () \\               ',
    '   /======\\     *        ',
    '   | /||\\ |              ',
    '   |/ || \\|   .          ',
    '     /||\\                ',
    '      ||          *      ',
    '     /  \\                ',
    '    /    \\               ',
  ],
  [
    '              *          ',
    '      /\\                 ',
    '     /  \\    .           ',
    '    / () \\               ',
    '   /======\\---+          ',
    '   | /||\\    /           ',
    '   |/ || \\  *  .         ',
    '     /||\\                ',
    '      ||          *      ',
    '     /  \\                ',
    '    /    \\               ',
  ],
  [
    '                  .      ',
    '      /\\    *            ',
    '     /  \\         *      ',
    '    / () \\      /        ',
    '   /======\\---+          ',
    '   | /||\\   .            ',
    '   |/ || \\               ',
    '     /||\\         .      ',
    '      ||                 ',
    '     /  \\     *          ',
    '    /    \\               ',
  ],
  [
    '          .              ',
    '      /\\          *      ',
    '     /  \\                ',
    '    / () \\               ',
    '   /======\\     .        ',
    '   | /||\\ |              ',
    '   |/ || \\|   *          ',
    '     /||\\                ',
    '      ||     .           ',
    '     /  \\                ',
    '    /    \\        *      ',
  ],
];

// Pad all lines to consistent width
const maxWidth = Math.max(...frames.flat().map(l => l.length));
frames.forEach(frame => {
  for (let i = 0; i < frame.length; i++) {
    frame[i] = frame[i].padEnd(maxWidth);
  }
});

export const wizardAnimation = {
  frames,
  interval: 500,
  color: 'blue',
};
