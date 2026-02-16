import { UIComponents } from './components.js';
import { createInitialGameState } from '../models/game-state.js';

function buildProgressBar(value, max, width = 16) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    throw new Error('[game-ui] Invalid bar values');
  }

  const clamped = Math.min(Math.max(value, 0), max);
  const filled = Math.round((clamped / max) * width);
  return `${'='.repeat(filled)}${'-'.repeat(width - filled)}`;
}

export class GameScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.render();
  }

  render() {
    const hasGame = !!this.context.session.gameState;
    const gameState = this.context.session.gameState;

    UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 4,
      content: '{center}{bold}{cyan-fg}TERMINAL ADVENTURE{/}\n{center}{gray-fg}Deterministic RPG Engine | Narrative Director Layer{/}',
      tags: true
    });

    const items = hasGame
      ? [
          'Continue Adventure',
          'Start New Adventure',
          'View Inventory',
          'Journal',
          'Game Stats',
          'Help',
          'Exit'
        ]
      : [
          'Start New Adventure',
          'View Inventory',
          'Journal',
          'Game Stats',
          'Help',
          'Exit'
        ];

    const actionItems = items.map((item, idx) => `${String(idx + 1).padStart(2, ' ')}. ${item}`);
    const menuLeft = hasGame ? 0 : 'center';
    const menuWidth = hasGame ? '58%' : '70%';

    const menu = UIComponents.createList({
      parent: this.screen,
      top: 4,
      left: menuLeft,
      width: menuWidth,
      height: items.length + 4,
      label: ' Command Console ',
      items: actionItems,
      keys: false,
      vi: false,
      style: {
        border: { fg: 'cyan' },
        selected: { bg: 'blue', fg: 'white' },
        item: { fg: 'white' }
      }
    });

    if (hasGame) {
      const quests = Object.values(gameState.worldState.quests);
      const completedQuests = quests.filter((quest) => quest.status === 'completed').length;
      const activeQuest = quests.find((quest) => quest.status === 'active');
      const hpBar = buildProgressBar(gameState.player.health, gameState.player.maxHealth);
      const tensionBar = buildProgressBar(
        gameState.worldState.director.tension,
        100
      );

      UIComponents.createBox({
        parent: this.screen,
        top: 4,
        left: '58%',
        width: '42%',
        height: 11,
        label: ' Campaign Snapshot ',
        content: `
  Location: ${gameState.currentRoom}
  Turn: ${gameState.moves}
  Inventory: ${gameState.inventory.length} item(s)
  Quest Progress: ${completedQuests}/${quests.length}
  Objective: ${activeQuest ? activeQuest.title : 'No active objective'}

  HP      [${hpBar}] ${gameState.player.health}/${gameState.player.maxHealth}
  Tension [${tensionBar}] ${gameState.worldState.director.tension}/100`,
        style: { border: { fg: 'yellow' } }
      });
    }

    let menuActive = false;
    const handleSelect = (index) => {
      if (!menuActive) return;

      if (hasGame) {
        switch (index) {
          case 0: this.context.navigate('room'); break;
          case 1: this.startNewGame(); break;
          case 2: this.context.navigate('inventory'); break;
          case 3: this.context.navigate('journal'); break;
          case 4: this.context.navigate('stats'); break;
          case 5: this.context.navigate('help'); break;
          case 6: this.context.exit(); break;
        }
      } else {
        switch (index) {
          case 0: this.startNewGame(); break;
          case 1: this.context.navigate('inventory'); break;
          case 2: this.context.navigate('journal'); break;
          case 3: this.context.navigate('stats'); break;
          case 4: this.context.navigate('help'); break;
          case 5: this.context.exit(); break;
        }
      }
    };

    menu.on('select', (_item, index) => handleSelect(index));

    const footer = UIComponents.createBox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{gray-fg}Use arrows or 1-9 | Enter to select | q to quit{/}',
      tags: true,
      style: { fg: 'gray' }
    });

    // Explicit arrow/enter key routing (blessed focus workaround)
    this.screen.key(['up'], () => {
      if (!menuActive) return;
      menu.up();
      this.screen.render();
    });
    this.screen.key(['down'], () => {
      if (!menuActive) return;
      menu.down();
      this.screen.render();
    });
    this.screen.key(['enter'], () => {
      if (!menuActive) return;
      handleSelect(menu.selected);
    });
    this.screen.key(['1', '2', '3', '4', '5', '6', '7', '8', '9'], (_ch, key) => {
      if (!menuActive) return;
      const index = Number(key.name) - 1;
      if (Number.isInteger(index) && index >= 0 && index < items.length) {
        menu.select(index);
        this.screen.render();
        handleSelect(index);
      }
    });

    setTimeout(() => {
      menuActive = true;
      menu.select(0);
      menu.focus();
      this.screen.render();
    }, 0);
  }

  startNewGame() {
    this.context.session.gameState = createInitialGameState();
    this.context.saveGame();
    this.context.navigate('room');
  }
}
