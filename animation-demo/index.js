#!/usr/bin/env node
import blessed from 'blessed';
import { animations } from './animations.js';

// Normalize all frames: pad lines to consistent width per animation
animations.forEach(anim => {
  const maxWidth = Math.max(...anim.frames.flat().map(l => l.length));
  anim.frames = anim.frames.map(frame =>
    frame.map(line => line.padEnd(maxWidth))
  );
});

// --- State ---
let currentIndex = 0;
let frameIndex = 0;
let animInterval = null;

// --- Screen setup ---
const screen = blessed.screen({
  smartCSR: true,
  title: 'ASCII Animation Demo',
  fullUnicode: true
});

// --- Header ---
const header = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
  content: '{center}{bold}{cyan-fg}ASCII ANIMATION DEMO{/}',
  tags: true,
  border: { type: 'line' },
  style: { border: { fg: 'cyan' } }
});

// --- Animation display box ---
const animBox = blessed.box({
  parent: screen,
  top: 4,
  left: 'center',
  width: 40,
  height: 20,
  label: ` ${animations[0].name} `,
  tags: true,
  border: { type: 'line' },
  style: { border: { fg: animations[0].color || 'white' } },
  align: 'center',
  valign: 'middle'
});

// --- Info bar ---
const infoBar = blessed.box({
  parent: screen,
  top: 25,
  left: 0,
  width: '100%',
  height: 3,
  tags: true,
  border: { type: 'line' },
  style: { border: { fg: 'gray' } }
});

// --- Animation list sidebar ---
const sidebar = blessed.box({
  parent: screen,
  top: 4,
  right: 0,
  width: 28,
  height: animations.length + 2,
  label: ' Animations ',
  tags: true,
  border: { type: 'line' },
  style: { border: { fg: 'yellow' } }
});

function updateSidebar() {
  const lines = animations.map((a, i) => {
    const marker = i === currentIndex ? '{bold}{cyan-fg}>{/}' : ' ';
    const num = `{yellow-fg}${i + 1}{/}`;
    const name = i === currentIndex ? `{bold}{white-fg}${a.name}{/}` : `{gray-fg}${a.name}{/}`;
    return ` ${marker} ${num} ${name}`;
  });
  sidebar.setContent(lines.join('\n'));
}

// --- Footer ---
const footer = blessed.box({
  parent: screen,
  bottom: 0,
  left: 0,
  width: '100%',
  height: 1,
  content: '{center}{gray-fg}1-7: Switch | +/-: Speed | Space: Pause | q: Quit{/}',
  tags: true
});

// --- Animation engine ---
let paused = false;
let speedMultiplier = 1;

function getEffectiveInterval() {
  const base = animations[currentIndex].interval;
  return Math.max(50, Math.round(base / speedMultiplier));
}

function renderFrame() {
  const anim = animations[currentIndex];
  const frame = anim.frames[frameIndex];
  const colorTag = anim.color || 'white';
  const content = frame.map(line => `{${colorTag}-fg}${line}{/}`).join('\n');
  animBox.setContent(content);

  // Update info
  const speedLabel = speedMultiplier === 1 ? '1x' : `${speedMultiplier.toFixed(1)}x`;
  const pauseLabel = paused ? '{red-fg}PAUSED{/}' : '{green-fg}PLAYING{/}';
  infoBar.setContent(`{center}Frame ${frameIndex + 1}/${anim.frames.length} | Interval: ${getEffectiveInterval()}ms | Speed: ${speedLabel} | ${pauseLabel}{/}`);

  screen.render();
}

function nextFrame() {
  const anim = animations[currentIndex];
  frameIndex = (frameIndex + 1) % anim.frames.length;
  renderFrame();
}

function startAnimation() {
  stopAnimation();
  frameIndex = 0;
  renderFrame();
  if (!paused) {
    animInterval = setInterval(nextFrame, getEffectiveInterval());
  }
}

function stopAnimation() {
  if (animInterval) {
    clearInterval(animInterval);
    animInterval = null;
  }
}

function switchAnimation(index) {
  if (index < 0 || index >= animations.length) return;
  currentIndex = index;
  const anim = animations[currentIndex];

  // Update box appearance
  animBox.setLabel(` ${anim.name} `);
  animBox.style.border.fg = anim.color || 'white';

  // Resize box to fit the largest frame
  const maxWidth = Math.max(...anim.frames.flat().map(l => l.length)) + 4;
  const maxHeight = Math.max(...anim.frames.map(f => f.length)) + 2;
  animBox.width = Math.max(maxWidth, 30);
  animBox.height = Math.max(maxHeight, 10);

  updateSidebar();
  startAnimation();
}

function togglePause() {
  paused = !paused;
  if (paused) {
    stopAnimation();
    renderFrame();
  } else {
    animInterval = setInterval(nextFrame, getEffectiveInterval());
    renderFrame();
  }
}

function adjustSpeed(delta) {
  speedMultiplier = Math.max(0.2, Math.min(5, speedMultiplier + delta));
  if (!paused) {
    stopAnimation();
    animInterval = setInterval(nextFrame, getEffectiveInterval());
  }
  renderFrame();
}

// --- Key bindings ---
screen.key(['q', 'C-c'], () => process.exit(0));
screen.key(['space'], () => togglePause());
screen.key(['+', '='], () => adjustSpeed(0.2));
screen.key(['-', '_'], () => adjustSpeed(-0.2));

// Number keys 1-8 to switch
for (let i = 0; i < animations.length; i++) {
  screen.key([`${i + 1}`], () => switchAnimation(i));
}

// Arrow keys to cycle
screen.key(['left'], () => {
  const prev = (currentIndex - 1 + animations.length) % animations.length;
  switchAnimation(prev);
});
screen.key(['right'], () => {
  const next = (currentIndex + 1) % animations.length;
  switchAnimation(next);
});

// --- Start ---
updateSidebar();
switchAnimation(0);
screen.render();
