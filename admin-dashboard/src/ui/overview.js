import { UIComponents } from './components.js';
import { SystemModel } from '../models/system.js';

export class OverviewScreen {
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
      content: '{center}{bold}{green-fg}SYSTEM OVERVIEW{/}',
      tags: true
    });

    const info = this.systemModel.getSystemInfo();

    const infoBox = UIComponents.createBox({
      parent: this.screen,
      top: 4,
      left: 2,
      width: '48%',
      height: 14,
      label: ' System Information ',
      content: `
  {bold}Hostname:{/}     ${info.hostname}
  {bold}Platform:{/}     ${info.platform}
  {bold}Architecture:{/} ${info.arch}
  {bold}CPUs:{/}         ${info.cpus} cores
  {bold}Total Memory:{/} ${info.totalMemory}
  {bold}Free Memory:{/}  ${info.freeMemory}
  {bold}Uptime:{/}       ${info.uptime}
`,
      tags: true,
      style: {
        border: { fg: 'cyan' }
      }
    });

    const loadBox = UIComponents.createBox({
      parent: this.screen,
      top: 4,
      right: 2,
      width: '48%',
      height: 14,
      label: ' Load Average ',
      content: `
  {bold}1 min:{/}  ${info.loadAvg[0]}
  {bold}5 min:{/}  ${info.loadAvg[1]}
  {bold}15 min:{/} ${info.loadAvg[2]}

  {yellow-fg}Press 'r' to refresh{/}
`,
      tags: true,
      style: {
        border: { fg: 'yellow' }
      }
    });

    const memory = this.systemModel.getMemoryUsage();

    const memBox = UIComponents.createBox({
      parent: this.screen,
      bottom: 8,
      left: 'center',
      width: '96%',
      height: 6,
      label: ' Memory Usage ',
      content: `
  {bold}Total:{/} ${memory.total}  |  {bold}Used:{/} ${memory.used}  |  {bold}Free:{/} ${memory.free}  |  {bold}Usage:{/} ${memory.percent}
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
      this.context.navigate('overview');
    });

    this.screen.key(['b', 'escape'], () => {
      this.context.navigate('dashboard');
    });

    backBtn.focus();
  }
}
