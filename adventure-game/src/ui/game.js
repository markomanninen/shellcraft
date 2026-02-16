import { UIComponents } from './components.js';

export class GameScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.render();
  }

  render() {
    const hasGame = !!this.context.session.gameState;

    const header = UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}{cyan-fg}TERMINAL ADVENTURE{/}',
      tags: true
    });

    const items = hasGame
      ? [
          '  Continue Adventure',
          '  Start New Adventure',
          '  View Inventory',
          '  Game Stats',
          '  Help',
          '  Exit'
        ]
      : [
          '  Start New Adventure',
          '  View Inventory',
          '  Game Stats',
          '  Help',
          '  Exit'
        ];

    const menu = UIComponents.createList({
      parent: this.screen,
      top: 4,
      left: 'center',
      width: '60%',
      height: items.length + 4,
      label: ' Main Menu ',
      items,
      keys: false,
      vi: false
    });

    let menuActive = false;
    const handleSelect = (index) => {
      if (!menuActive) return;

      if (hasGame) {
        switch(index) {
          case 0: this.context.navigate('room'); break;
          case 1: this.startNewGame(); break;
          case 2: this.context.navigate('inventory'); break;
          case 3: this.context.navigate('stats'); break;
          case 4: this.context.navigate('help'); break;
          case 5: this.context.exit(); break;
        }
      } else {
        switch(index) {
          case 0: this.startNewGame(); break;
          case 1: this.context.navigate('inventory'); break;
          case 2: this.context.navigate('stats'); break;
          case 3: this.context.navigate('help'); break;
          case 4: this.context.exit(); break;
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
      content: '{center}Use arrows | Enter to select | q to quit{/}',
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

    setTimeout(() => {
      menuActive = true;
      menu.select(0);
      menu.focus();
      this.screen.render();
    }, 0);
  }

  startNewGame() {
    this.context.session.gameState = {
      currentRoom: 'start',
      inventory: [],
      visitedRooms: new Set(['start']),
      moves: 0,
      messageHistory: [],
      llmEnabled: true,
      isFirstTurn: true
    };
    this.context.saveGame();
    this.context.navigate('room');
  }
}
