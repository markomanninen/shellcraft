import { UIComponents } from './components.js';
import { SystemModel } from '../models/system.js';

export class ServicesScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.systemModel = new SystemModel();
    this.render();
  }

  async render() {
    const header = UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}{green-fg}SERVICES STATUS{/}',
      tags: true
    });

    const loading = UIComponents.createBox({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: 40,
      height: 5,
      content: '{center}Loading services...{/}',
      tags: true
    });

    this.screen.render();

    const services = await this.systemModel.getServices();

    loading.destroy();

    const serviceBox = UIComponents.createBox({
      parent: this.screen,
      top: 4,
      left: 2,
      width: '96%',
      height: '80%',
      label: ' Running Services ',
      content: services,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        style: { bg: 'cyan' }
      },
      style: {
        border: { fg: 'green' }
      }
    });

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
      this.context.navigate('dashboard');
    });

    this.screen.key(['r'], () => {
      this.context.navigate('services');
    });

    this.screen.key(['b', 'escape'], () => {
      this.context.navigate('dashboard');
    });

    this.screen.render();
    backBtn.focus();
  }
}
