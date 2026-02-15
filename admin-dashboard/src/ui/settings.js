import os from 'os';
import { UIComponents } from './components.js';

export class SettingsScreen {
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
      content: '{center}{bold}{cyan-fg}SETTINGS{/}',
      tags: true
    });

    const envBox = UIComponents.createBox({
      parent: this.screen,
      top: 4,
      left: 2,
      width: '96%',
      height: 12,
      label: ' Environment ',
      content: `
  {bold}Node Version:{/}    ${process.version}
  {bold}Platform:{/}        ${os.platform()} ${os.release()}
  {bold}Architecture:{/}    ${os.arch()}
  {bold}Home Directory:{/}  ${os.homedir()}
  {bold}Temp Directory:{/}  ${os.tmpdir()}
  {bold}Shell:{/}           ${process.env.SHELL || 'N/A'}
  {bold}Terminal:{/}        ${process.env.TERM || 'N/A'}
  {bold}SSH Port:{/}        ${process.env.SSH_PORT || '2222'}
`,
      tags: true,
      style: {
        border: { fg: 'cyan' }
      }
    });

    const sessionBox = UIComponents.createBox({
      parent: this.screen,
      top: 17,
      left: 2,
      width: '96%',
      height: 8,
      label: ' Session ',
      content: `
  {bold}Session ID:{/}      ${this.context.session.id}
  {bold}Fingerprint:{/}     ${this.context.session.fingerprint}
  {bold}Connected At:{/}    ${this.context.session.createdAt.toLocaleString()}
  {bold}Screen Size:{/}     ${this.screen.width}x${this.screen.height}
`,
      tags: true,
      style: {
        border: { fg: 'yellow' }
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

    this.screen.key(['b', 'escape'], () => {
      this.context.navigate('dashboard');
    });

    backBtn.focus();
  }
}
