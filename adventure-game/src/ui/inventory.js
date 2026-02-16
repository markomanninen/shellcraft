import { UIComponents } from './components.js';

export class InventoryScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.render();
  }

  render() {
    const contentTop = 4;
    const footerHeight = 3;
    const contentHeight = Math.max(8, this.screen.height - contentTop - footerHeight);

    UIComponents.createBox({
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
      UIComponents.createBox({
        parent: this.screen,
        top: contentTop,
        left: 'center',
        width: '60%',
        height: contentHeight,
        label: ' Your Items ',
        content: '{center}{yellow-fg}Your inventory is empty!{/}\n{center}Explore and collect items.',
        tags: true,
        valign: 'middle'
      });
    } else {
      const table = UIComponents.createTable({
        parent: this.screen,
        top: contentTop,
        left: 'center',
        width: '80%',
        height: contentHeight,
        label: ' Your Items ',
        data: [
          ['#', 'Item'],
          ...gameState.inventory.map((item, i) => [(i+1).toString(), item])
        ]
      });

      table.focus();
    }

    UIComponents.createBox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{gray-fg}b=back | q=quit{/}',
      tags: true
    });

    this.screen.key(['b', 'escape'], () => {
      this.context.navigate('game');
    });
  }
}
