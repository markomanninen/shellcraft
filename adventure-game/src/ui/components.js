import blessed from 'blessed';

export class UIComponents {
  static createBox(options = {}) {
    return blessed.box({
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        ...options.style
      },
      ...options
    });
  }

  static createList(options = {}) {
    return blessed.list({
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        selected: { bg: 'blue', fg: 'white' },
        item: { fg: 'white' },
        ...options.style
      },
      keys: true,
      vi: true,
      mouse: true,
      ...options
    });
  }

  static createTable(options = {}) {
    return blessed.listtable({
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        header: { fg: 'yellow', bold: true },
        cell: { fg: 'white' },
        ...options.style
      },
      align: 'left',
      keys: true,
      vi: true,
      ...options
    });
  }

  static createForm(options = {}) {
    return blessed.form({
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        ...options.style
      },
      keys: true,
      vi: true,
      ...options
    });
  }

  static createInput(options = {}) {
    return blessed.textbox({
      border: { type: 'line' },
      style: {
        border: { fg: 'green' },
        focus: { border: { fg: 'yellow' } },
        ...options.style
      },
      inputOnFocus: true,
      ...options
    });
  }

  static createButton(options = {}) {
    return blessed.button({
      border: { type: 'line' },
      style: {
        border: { fg: 'green' },
        focus: { border: { fg: 'yellow' }, bg: 'blue' },
        ...options.style
      },
      mouse: true,
      ...options
    });
  }

  static showMessage(screen, message, type = 'info') {
    const colors = {
      info: 'blue',
      success: 'green',
      error: 'red',
      warning: 'yellow'
    };

    const msg = blessed.message({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: 'shrink',
      border: { type: 'line' },
      style: {
        border: { fg: colors[type] },
        bg: colors[type],
        fg: 'white'
      }
    });

    msg.display(message, 3, () => {
      msg.destroy();
      screen.render();
    });
  }
}
