import { UIComponents } from './components.js';

export class DashboardScreen {
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
      content: '{center}{bold}{cyan-fg}SYSTEM ADMIN DASHBOARD{/}',
      tags: true,
      style: {
        border: { fg: 'cyan' }
      }
    });

    const menu = UIComponents.createList({
      parent: this.screen,
      top: 4,
      left: 'center',
      width: '60%',
      height: 14,
      label: ' Dashboard Menu ',
      items: [
        '  System Overview',
        '  CPU & Memory',
        '  Process Monitor',
        '  System Logs',
        '  Network Info',
        '  Services Status',
        '  Settings',
        '  Exit'
      ],
      keys: false,
      vi: false
    });

    let menuActive = false;
    const handleSelect = (index) => {
      if (!menuActive) return;
      switch(index) {
        case 0:
          this.context.navigate('overview');
          break;
        case 1:
          this.context.navigate('resources');
          break;
        case 2:
          this.context.navigate('processes');
          break;
        case 3:
          this.context.navigate('logs');
          break;
        case 4:
          this.context.navigate('network');
          break;
        case 5:
          this.context.navigate('services');
          break;
        case 6:
          this.context.navigate('settings');
          break;
        case 7:
          this.context.exit();
          break;
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
}
