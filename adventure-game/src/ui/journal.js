import { UIComponents } from './components.js';

export class JournalScreen {
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

  render() {
    const gameState = this.context.session.gameState;
    const contentTop = 4;
    const footerHeight = 3;
    const contentHeight = Math.max(8, this.screen.height - contentTop - footerHeight);

    UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}{magenta-fg}ADVENTURE JOURNAL{/}',
      tags: true
    });

    if (!gameState?.worldState) {
      UIComponents.createBox({
        parent: this.screen,
        top: 4,
        left: 2,
        width: '96%',
        height: 6,
        content: '\n  No active adventure. Start a new game to unlock the journal.',
        style: { border: { fg: 'red' } }
      });
      this.renderFooter();
      return;
    }

    const questLines = Object.values(gameState.worldState.quests)
      .map((quest) => `  [${quest.status.toUpperCase()}] ${quest.title} (${Math.round(quest.progress)}%)`)
      .join('\n');

    const encounterLines = Object.values(gameState.worldState.encounters)
      .map((encounter) => {
        if (encounter.defeated) return `  ${encounter.name}: defeated`;
        return `  ${encounter.name}: ${encounter.currentHp}/${encounter.maxHp} HP`;
      })
      .join('\n');

    const factionLines = Object.entries(gameState.worldState.factions)
      .map(([name, score]) => `  ${name}: ${score}`)
      .join('\n');

    const npcLines = Object.values(gameState.worldState.npcs)
      .map((npc) => {
        const memory = npc.memory[npc.memory.length - 1] || 'No interactions yet';
        return `  ${npc.name} (trust ${npc.trust})\n    ${memory}`;
      })
      .join('\n');

    const missionLog = UIComponents.createBox({
      parent: this.screen,
      top: contentTop,
      left: 'center',
      width: '94%',
      height: contentHeight,
      label: ' Mission Log ',
      content: `
{bold}Quests{/}
${questLines}

{bold}Encounters{/}
${encounterLines}

{bold}Factions{/}
${factionLines}

{bold}NPC Memory{/}
${npcLines}
`,
      tags: true,
      keys: true,
      vi: true,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        style: { bg: 'magenta' }
      }
    });

    this.bindScrollKeys(missionLog);
    this.renderFooter();
    missionLog.focus();
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

    this.screen.key(['b', 'escape'], () => this.context.navigate('game'));
  }
}
