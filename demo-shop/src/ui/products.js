import blessed from 'blessed';
import { UIComponents } from './components.js';
import { ProductModel } from '../models/product.js';

export class ProductsScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.productModel = new ProductModel();
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
      content: '{center}{bold}{cyan-fg}PRODUCTS{/}',
      tags: true,
      border: { type: 'line' },
      style: { border: { fg: 'cyan' } }
    });

    const products = this.productModel.getAll();
    
    // Container with border
    const container = blessed.box({
      parent: this.screen,
      top: 4,
      left: 2,
      right: 2,
      bottom: 3,
      label: ' Available Products ',
      border: { type: 'line' },
      style: { border: { fg: 'cyan' } }
    });

    // Header row
    blessed.text({
      parent: container,
      top: 0,
      left: 1,
      right: 1,
      height: 1,
      content: 'ID         Name                   Description                    Price',
      style: { fg: 'yellow', bold: true }
    });

    // Product items as list
    const items = products.map(p => {
      return `${p.id.padEnd(10)} ${p.name.padEnd(22)} ${p.description.padEnd(30)} $${p.price.toFixed(2)}`;
    });

    const list = blessed.list({
      parent: container,
      top: 1,
      left: 1,
      right: 1,
      bottom: 1,
      items: items,
      keys: true,
      vi: true,
      mouse: true,
      style: {
        item: { fg: 'white' },
        selected: { fg: 'black', bg: 'white', bold: true }
      }
    });

    // Footer
    UIComponents.createBox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}{gray-fg}[A] Add to Cart | [B] Back | Use arrows to select{/}',
      tags: true
    });

    // Key handlers
    this.screen.key(['a'], () => {
      const index = list.selected;
      if (index >= 0) {
        const product = products[index];
        this.context.session.cart.push(product);
        UIComponents.showMessage(this.screen, `Added ${product.name} to cart!`, 'success');
      }
    });

    this.screen.key(['b', 'escape'], () => {
      this.context.navigate('home');
    });

    list.focus();
    this.screen.render();
  }
}
