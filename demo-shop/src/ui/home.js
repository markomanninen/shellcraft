import blessed from 'blessed';
import { UIComponents } from './components.js';

export class HomeScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.render();
  }

  render() {
    // Header
    UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}{cyan-fg}DEMO SHOP v1.0.0{/}',
      tags: true,
      border: { type: 'line' },
      style: { border: { fg: 'cyan' } }
    });

    // Menu container
    const menuBox = UIComponents.createBox({
      parent: this.screen,
      top: 5,
      left: 'center',
      width: 32,
      height: 9,
      label: ' Main Menu ',
      border: { type: 'line' },
      style: { border: { fg: 'cyan' } }
    });

    // Menu list
    const menu = blessed.list({
      parent: menuBox,
      top: 0,
      left: 1,
      width: 28,
      height: 7,
      items: [
        '  Browse Products',
        '  View Cart',
        '  Checkout',
        '  Exit'
      ],
      style: {
        selected: { bg: 'blue', fg: 'white' },
        item: { fg: 'white' }
      },
      keys: false,
      vi: false,
      mouse: true
    });

    let menuActive = false;
    const handleSelect = (index) => {
      if (!menuActive) return;
      switch(index) {
        case 0:
          this.context.navigate('products');
          break;
        case 1:
          this.context.navigate('cart');
          break;
        case 2:
          this.context.navigate('checkout');
          break;
        case 3:
          this.context.exit();
          break;
      }
    };

    menu.on('select', (_item, index) => handleSelect(index));

    // Footer
    UIComponents.createBox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}{gray-fg}Use arrows to navigate | Enter to select | q to quit{/}',
      tags: true
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
}
