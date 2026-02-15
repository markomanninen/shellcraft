import blessed from 'blessed';
import { UIComponents } from './components.js';

export class CartScreen {
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
      content: '{center}{bold}{cyan-fg}SHOPPING CART{/}',
      tags: true,
      border: { type: 'line' },
      style: { border: { fg: 'cyan' } }
    });

    const cart = this.context.session.cart;
    
    if (cart.length === 0) {
      // Empty cart message
      UIComponents.createBox({
        parent: this.screen,
        top: 'center',
        left: 'center',
        width: 40,
        height: 5,
        content: '{center}{yellow-fg}Your cart is empty!{/}\n{center}Browse products to add items.',
        tags: true,
        border: { type: 'line' },
        style: { border: { fg: 'yellow' } }
      });
    } else {
      const total = cart.reduce((sum, item) => sum + item.price, 0);
      
      // Cart items table
      blessed.listtable({
        parent: this.screen,
        top: 4,
        left: 2,
        width: '96%',
        height: '60%',
        label: ' Cart Items ',
        border: { type: 'line' },
        style: {
          border: { fg: 'cyan' },
          header: { fg: 'yellow', bold: true },
          cell: { fg: 'white' },
          selected: { bg: 'white', fg: 'black', bold: true }
        },
        align: 'left',
        keys: true,
        vi: true,
        mouse: true,
        interactive: true,
        noCellBorders: true,
        data: [
          ['Name', 'Price'],
          ...cart.map(item => [item.name, `$${item.price.toFixed(2)}`]),
          ['', ''],
          ['TOTAL', `$${total.toFixed(2)}`]
        ]
      });
    }

    // Footer
    UIComponents.createBox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}{gray-fg}[C] Checkout | [X] Clear Cart | [B] Back{/}',
      tags: true
    });

    // Key handlers
    this.screen.key(['c'], () => {
      if (cart.length > 0) {
        this.context.navigate('checkout');
      } else {
        UIComponents.showMessage(this.screen, 'Cart is empty!', 'warning');
      }
    });

    this.screen.key(['x'], () => {
      this.context.session.cart = [];
      this.context.navigate('cart');
    });

    this.screen.key(['b', 'escape'], () => {
      this.context.navigate('home');
    });

    this.screen.render();
  }
}
