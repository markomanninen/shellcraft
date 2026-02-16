import { UIComponents } from './components.js';

export class HelpScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.render();
  }

  bindScrollKeys(box) {
    this.screen.key(['up'], () => {
      box.scroll(-1);
      this.screen.render();
    });
    this.screen.key(['down'], () => {
      box.scroll(1);
      this.screen.render();
    });
    this.screen.key(['pageup'], () => {
      box.scroll(-6);
      this.screen.render();
    });
    this.screen.key(['pagedown'], () => {
      box.scroll(6);
      this.screen.render();
    });
    this.screen.key(['home'], () => {
      box.setScroll(0);
      this.screen.render();
    });
    this.screen.key(['end'], () => {
      box.setScrollPerc(100);
      this.screen.render();
    });
  }

  renderFooter() {
    UIComponents.createBox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{gray-fg}up/down, pgup/pgdn to scroll | b=back | q=quit{/}',
      tags: true
    });

    this.screen.key(['b', 'escape'], () => {
      this.context.navigate('game');
    });
  }

  render() {
    const contentTop = 4;
    const footerHeight = 3;
    const contentHeight = Math.max(8, this.screen.height - contentTop - footerHeight);

    UIComponents.createBox({
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
      top: contentTop,
      left: 'center',
      width: '80%',
      height: contentHeight,
      label: ' How to Play ',
      content: `
  {bold}OBJECTIVE:{/}
  Explore the world, collect items, and find the treasure!

  {bold}CONTROLS:{/}
  Up/Down      - Navigate menus
  Enter        - Select option
  1-9          - Quick-select menu/action entries
  h            - Return to main menu (from room)
  i            - View inventory (from room)
  j            - View journal (from room)
  q / Ctrl+C   - Quit game

  {bold}GAMEPLAY:{/}
  - Deterministic rules resolve inventory, quests, and faction reputation
  - Combat encounters are deterministic and resolve with skill checks
  - Skill checks affect action outcomes (success / partial / fail)
  - NPCs track trust and memory based on your interactions
  - Director pacing adapts tone and tension as you play
  - Room HUD now surfaces HP/tension meters and active objective context
  - Screen routing uses short animated transitions between views

  {bold}TIPS:{/}
  - Check your journal for active objectives and faction standing
  - Talk to NPCs to unlock better quest paths
  - Defeat guardians before attempting high-value objective pickups
  - Use key items in meaningful locations (especially the temple)
  - Balance exploration and caution as tension rises

  {bold}GOOD LUCK, ADVENTURER!{/}
`,
      tags: true,
      keys: true,
      vi: true,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        style: { bg: 'cyan' }
      }
    });

    this.bindScrollKeys(helpText);
    this.renderFooter();
    helpText.focus();
  }
}
