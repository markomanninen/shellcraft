import { UIComponents } from './components.js';
import { SystemModel } from '../models/system.js';

export class ProcessesScreen {
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
      content: '{center}{bold}{red-fg}PROCESSES{/}',
      tags: true
    });

    const loading = UIComponents.createBox({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: 40,
      height: 5,
      content: '{center}Loading processes...{/}',
      tags: true
    });

    this.screen.render();

    const processes = await this.systemModel.getProcesses();

    loading.destroy();

    const processBox = UIComponents.createBox({
      parent: this.screen,
      top: 4,
      left: 2,
      width: '96%',
      height: '80%',
      label: ' Top Processes ',
      content: processes,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        style: { bg: 'cyan' }
      },
      style: {
        border: { fg: 'red' }
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
      this.context.navigate('processes');
    });

    this.screen.key(['b', 'escape'], () => {
      this.context.navigate('dashboard');
    });

    this.screen.render();
    backBtn.focus();
  }
}
