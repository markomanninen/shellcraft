import blessed from 'blessed';
import { UIComponents } from './components.js';

export class CheckoutScreen {
  constructor(context, data = {}) {
    this.context = context;
    this.screen = context.screen;
    this.formData = context.session.checkoutFormData || { name: '', email: '', address: '' };
    this.startOnSubmit = data.startOnSubmit || false;
    this.render();
  }

  render() {
    const cart = this.context.session.cart;

    if (cart.length === 0) {
      this.showEmptyCart();
      return;
    }

    this.showOrderForm();
  }

  showEmptyCart() {
    UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}{cyan-fg}CHECKOUT{/}',
      tags: true,
      border: { type: 'line' },
      style: { border: { fg: 'cyan' } }
    });

    UIComponents.createBox({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: 40,
      height: 5,
      content: '{center}{yellow-fg}Your cart is empty!{/}\n{center}Add items before checkout.',
      tags: true,
      border: { type: 'line' },
      style: { border: { fg: 'yellow' } }
    });

    UIComponents.createBox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}{gray-fg}[B] Back to Home{/}',
      tags: true
    });

    this.screen.key(['b', 'escape'], () => {
      this.context.navigate('home');
    });

    this.screen.render();
  }

  _removeFormHandlers() {
    if (this._formHandlers) {
      this._formHandlers.forEach(({ keys, handler }) => {
        try { this.screen.unkey(keys, handler); } catch(e) {}
      });
      this._formHandlers = null;
    }
  }

  showOrderForm() {
    this._removeFormHandlers();

    const cart = this.context.session.cart;
    const total = cart.reduce((sum, item) => sum + item.price, 0);

    // Header
    UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}{cyan-fg}CHECKOUT{/}',
      tags: true,
      border: { type: 'line' },
      style: { border: { fg: 'cyan' } }
    });

    // Order summary
    UIComponents.createBox({
      parent: this.screen,
      top: 4,
      left: 'center',
      width: 50,
      height: 3,
      content: `{center}Items: ${cart.length} | {green-fg}Total: $${total.toFixed(2)}{/}`,
      tags: true,
      border: { type: 'line' },
      style: { border: { fg: 'green' } }
    });

    // Form container
    const formBox = UIComponents.createBox({
      parent: this.screen,
      top: 8,
      left: 'center',
      width: 60,
      height: 11,
      label: ' Shipping Information ',
      border: { type: 'line' },
      style: { border: { fg: 'cyan' } }
    });

    const fields = [
      { label: 'Name:', value: this.formData.name || '', top: 1 },
      { label: 'Email:', value: this.formData.email || '', top: 3 },
      { label: 'Address:', value: this.formData.address || '', top: 5 },
      { label: '[ SUBMIT ORDER ]', value: null, top: 7, isButton: true }
    ];

    // Start on submit button if returning from confirmation, otherwise start on first field
    let currentField = this.startOnSubmit ? 3 : 0;
    const fieldBoxes = [];

    fields.forEach((field, idx) => {
      if (field.isButton) {
        const btn = blessed.box({
          parent: formBox,
          top: field.top,
          left: 'center',
          width: 20,
          height: 1,
          content: '{center}SUBMIT ORDER{/}',
          tags: true,
          style: { fg: 'black', bg: 'green' }
        });
        fieldBoxes.push({ box: btn, field, idx, isButton: true });
      } else {
        blessed.text({
          parent: formBox,
          top: field.top,
          left: 2,
          content: field.label,
          style: { fg: 'yellow' }
        });

        const box = blessed.box({
          parent: formBox,
          top: field.top,
          left: 12,
          width: 44,
          height: 1,
          content: field.value || '(press Enter to edit)',
          style: { fg: 'white', bg: 'black' }
        });
        fieldBoxes.push({ box, field, idx, isButton: false });
      }
    });

    const updateSelection = () => {
      fieldBoxes.forEach((fb, i) => {
        if (i === currentField) {
          if (fb.isButton) {
            fb.box.style.bg = 'white';
            fb.box.style.fg = 'black';
          } else {
            fb.box.style.bg = 'blue';
            fb.box.style.fg = 'white';
          }
        } else {
          if (fb.isButton) {
            fb.box.style.bg = 'green';
            fb.box.style.fg = 'black';
          } else {
            fb.box.style.bg = 'black';
            fb.box.style.fg = 'white';
          }
        }
      });
      this.screen.render();
    };

    // Footer
    UIComponents.createBox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}{gray-fg}Up/Down: select field | Enter: edit/submit | [B] Back{/}',
      tags: true
    });

    // Guard: screen-level handlers fire even when a textbox has focus,
    // so we must ignore them while editing a field.
    let isEditing = false;

    const editField = () => {
      const fb = fieldBoxes[currentField];

      if (fb.isButton) {
        submitOrder();
        return;
      }

      isEditing = true;

      const input = blessed.textbox({
        parent: formBox,
        top: fb.field.top,
        left: 12,
        width: 44,
        height: 1,
        style: { fg: 'white', bg: 'green' },
        inputOnFocus: true
      });

      fb.box.hide();
      input.setValue(fb.field.value);
      input.focus();
      this.screen.render();

      input.on('submit', (value) => {
        isEditing = false;
        fb.field.value = value || '';
        fb.box.setContent(value || '(empty)');
        input.destroy();
        fb.box.show();
        updateSelection();
      });

      input.on('cancel', () => {
        isEditing = false;
        input.destroy();
        fb.box.show();
        updateSelection();
      });
    };

    const submitOrder = () => {
      this.formData.name = fields[0].value;
      this.formData.email = fields[1].value;
      this.formData.address = fields[2].value;

      // Store form data in session so it persists
      this.context.session.checkoutFormData = this.formData;

      if (!this.formData.name || !this.formData.email || !this.formData.address) {
        UIComponents.showMessage(this.screen, 'Please fill in all fields!', 'warning');
        return;
      }

      this.showConfirmation(cart, total);
    };

    // All handlers guard on isEditing to avoid side effects while typing in a textbox
    const handleUp = () => {
      if (isEditing) return;
      currentField = Math.max(0, currentField - 1);
      updateSelection();
    };
    const handleDown = () => {
      if (isEditing) return;
      currentField = Math.min(3, currentField + 1);
      updateSelection();
    };
    const handleEnter = () => {
      if (isEditing) return;
      editField();
    };
    const handleBack = () => {
      if (isEditing) return;
      this.context.navigate('cart');
    };

    this.screen.key(['up', 'k'], handleUp);
    this.screen.key(['down', 'j'], handleDown);
    this.screen.key(['enter'], handleEnter);
    this.screen.key(['b', 'escape'], handleBack);

    this._formHandlers = [
      { keys: ['up', 'k'], handler: handleUp },
      { keys: ['down', 'j'], handler: handleDown },
      { keys: ['enter'], handler: handleEnter },
      { keys: ['b', 'escape'], handler: handleBack }
    ];

    updateSelection();
    this.screen.render();
  }

  showConfirmation(cart, total) {
    // Remove form key handlers before transitioning
    this._removeFormHandlers();

    // Clear screen
    while (this.screen.children.length > 0) {
      this.screen.children[0].destroy();
    }

    // Header
    UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}{cyan-fg}CONFIRM ORDER{/}',
      tags: true,
      border: { type: 'line' },
      style: { border: { fg: 'cyan' } }
    });

    // Order details box
    const detailsBox = UIComponents.createBox({
      parent: this.screen,
      top: 4,
      left: 'center',
      width: 60,
      height: 12,
      label: ' Order Details ',
      border: { type: 'line' },
      style: { border: { fg: 'green' } }
    });

    blessed.text({ parent: detailsBox, top: 1, left: 2, content: `Name:    ${this.formData.name}`, style: { fg: 'white' } });
    blessed.text({ parent: detailsBox, top: 2, left: 2, content: `Email:   ${this.formData.email}`, style: { fg: 'white' } });
    blessed.text({ parent: detailsBox, top: 3, left: 2, content: `Address: ${this.formData.address}`, style: { fg: 'white' } });
    blessed.text({ parent: detailsBox, top: 5, left: 2, content: '─'.repeat(54), style: { fg: 'cyan' } });
    blessed.text({ parent: detailsBox, top: 6, left: 2, content: `Items: ${cart.length}  |  Total: $${total.toFixed(2)}`, style: { fg: 'green', bold: true } });

    // Confirmation menu
    const menu = blessed.list({
      parent: detailsBox,
      top: 8,
      left: 'center',
      width: 40,
      height: 2,
      items: [
        '> CONFIRM - Place Order',
        '> CANCEL - Edit Form'
      ],
      style: {
        selected: { bg: 'white', fg: 'black', bold: true },
        item: { fg: 'white' }
      },
      keys: true,
      vi: true,
      mouse: true
    });

    UIComponents.createBox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}{gray-fg}Up/Down: select | Enter: confirm{/}',
      tags: true
    });

    // Guard: blessed auto-focuses the list on append, so the Enter keypress
    // from form submit propagates to the menu instantly. Block until next tick.
    let menuActive = false;

    menu.on('select', (_item, index) => {
      if (!menuActive) return;
      menuActive = false;
      if (index === 0) {
        delete this.context.session.checkoutFormData;
        this.context.session.cart = [];
        UIComponents.showMessage(this.screen, 'Order placed successfully!', 'success');
        setTimeout(() => {
          this.context.navigate('home');
        }, 2000);
      } else {
        this.context.navigate('checkout', { startOnSubmit: true });
      }
    });

    // Activate menu after current tick so the Enter keypress fully resolves first
    setTimeout(() => {
      menuActive = true;
      menu.focus();
      this.screen.render();
    }, 0);
  }
}
