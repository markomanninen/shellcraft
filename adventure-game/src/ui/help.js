import { UIComponents } from './components.js';

export class HelpScreen {
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
      content: '{center}{bold}{cyan-fg}HELP{/}',
      tags: true
    });

    const helpText = UIComponents.createBox({
      parent: this.screen,
      top: 4,
      left: 'center',
      width: '80%',
      height: '75%',
      label: ' How to Play ',
      content: `
  {bold}OBJECTIVE:{/}
  Explore the world, collect items, and find the treasure!

  {bold}CONTROLS:{/}
  Up/Down      - Navigate menus
  Enter        - Select option
  h            - Return to main menu (from room)
  i            - View inventory (from room)
  q / Ctrl+C   - Quit game

  {bold}GAMEPLAY:{/}
  - Move between rooms using directional commands
  - Pick up items you find
  - Explore all areas to discover secrets
  - Find the treasure chamber to win!

  {bold}TIPS:{/}
  - Check your inventory often
  - Read room descriptions carefully
  - Some rooms may have hidden paths
  - Collect useful items on your journey

  {bold}GOOD LUCK, ADVENTURER!{/}
`,
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        style: { bg: 'cyan' }
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
      this.context.navigate('game');
    });

    this.screen.key(['b', 'escape'], () => {
      this.context.navigate('game');
    });

    backBtn.focus();
  }
}
