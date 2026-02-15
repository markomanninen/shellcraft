import { UIComponents } from './components.js';
import { SystemModel } from '../models/system.js';

export class NetworkScreen {
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
      content: '{center}{bold}{magenta-fg}NETWORK INFO{/}',
      tags: true
    });

    const interfaces = this.systemModel.getNetworkInfo();

    const table = UIComponents.createTable({
      parent: this.screen,
      top: 4,
      left: 2,
      width: '96%',
      height: '80%',
      label: ' Network Interfaces ',
      data: [
        ['Interface', 'Address', 'Family', 'Netmask', 'Internal'],
        ...interfaces.map(iface => [
          iface.interface,
          iface.address,
          iface.family,
          iface.netmask,
          iface.internal
        ])
      ],
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
      this.context.navigate('network');
    });

    this.screen.key(['b', 'escape'], () => {
      this.context.navigate('dashboard');
    });

    backBtn.focus();
  }
}
