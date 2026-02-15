import { UIComponents } from './components.js';
import { SystemModel } from '../models/system.js';

export class ResourcesScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.systemModel = new SystemModel();
    this.render();
  }

  render() {
    const header = UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}{blue-fg}CPU & MEMORY{/}',
      tags: true
    });

    const cpuUsage = this.systemModel.getCPUUsage();

    const cpuTable = UIComponents.createTable({
      parent: this.screen,
      top: 4,
      left: 2,
      width: '96%',
      height: cpuUsage.length + 4,
      label: ' CPU Cores ',
      data: [
        ['Core', 'Model', 'Usage'],
        ...cpuUsage.map(cpu => [
          cpu.core.toString(),
          cpu.model.substring(0, 40),
          cpu.usage
        ])
      ],
      style: {
        border: { fg: 'green' }
      }
    });

    const memory = this.systemModel.getMemoryUsage();

    const memBox = UIComponents.createBox({
      parent: this.screen,
      top: cpuUsage.length + 9,
      left: 2,
      width: '96%',
      height: 8,
      label: ' Memory Details ',
      content: `
  {bold}Total Memory:{/}    ${memory.total}
  {bold}Used Memory:{/}     ${memory.used}
  {bold}Free Memory:{/}     ${memory.free}
  {bold}Usage Percent:{/}   ${memory.percent}

  {yellow-fg}Press 'r' to refresh{/}
`,
      tags: true,
      style: {
        border: { fg: 'magenta' }
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
      this.context.navigate('resources');
    });

    this.screen.key(['b', 'escape'], () => {
      this.context.navigate('dashboard');
    });

    backBtn.focus();
  }
}
