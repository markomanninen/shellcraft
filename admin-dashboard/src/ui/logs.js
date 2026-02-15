import { UIComponents } from './components.js';
import { SystemModel } from '../models/system.js';

export class LogsScreen {
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
      content: '{center}{bold}{yellow-fg}SYSTEM LOGS{/}',
      tags: true
    });

    const logs = this.systemModel.getMockLogs();

    const logsTable = UIComponents.createTable({
      parent: this.screen,
      top: 4,
      left: 2,
      width: '96%',
      height: '80%',
      label: ' Recent Logs ',
      data: [
        ['Time', 'Level', 'Message'],
        ...logs.map(log => [
          log.timestamp,
          log.level,
          log.message
        ])
      ],
      style: {
        border: { fg: 'yellow' },
        header: { fg: 'yellow', bold: true }
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
      this.context.navigate('logs');
    });

    this.screen.key(['b', 'escape'], () => {
      this.context.navigate('dashboard');
    });

    backBtn.focus();
  }
}
