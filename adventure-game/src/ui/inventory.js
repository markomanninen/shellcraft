import { UIComponents } from './components.js';

export class InventoryScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.render();
  }

  render() {
    const header = UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}{green-fg}INVENTORY{/}',
      tags: true
    });

    const gameState = this.context.session.gameState;

    if (!gameState || gameState.inventory.length === 0) {
      const emptyMsg = UIComponents.createBox({
        parent: this.screen,
        top: 'center',
        left: 'center',
        width: '60%',
        height: 5,
        content: '{center}{yellow-fg}Your inventory is empty!{/}\n{center}Explore and collect items.',
        tags: true
      });
    } else {
      const table = UIComponents.createTable({
        parent: this.screen,
        top: 4,
        left: 'center',
        width: '80%',
        height: '70%',
        label: ' Your Items ',
        data: [
          ['#', 'Item'],
          ...gameState.inventory.map((item, i) => [(i+1).toString(), item])
        ]
      });
    }

    const backBtn = UIComponents.createButton({
      parent: this.screen,
      bottom: 3,
      left: 'center',
      width: 15,
      height: 3,
      content: ' Back ',
      name: 'back'
    });

    backBtn.on('press', () => {
      this.context.navigate('game');
    });

    this.screen.key(['b', 'escape'], () => {
      this.context.navigate('game');
    });

    backBtn.focus();
  }
}
