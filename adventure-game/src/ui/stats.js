import { UIComponents } from './components.js';
import { GameModel } from '../models/game.js';

export class StatsScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.gameModel = new GameModel();
    this.render();
  }

  render() {
    const gameState = this.context.session.gameState;
    const allRooms = this.gameModel.getAllRooms();
    const totalRooms = allRooms.length;

    const header = UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}{yellow-fg}GAME STATS{/}',
      tags: true
    });

    if (!gameState) {
      UIComponents.createBox({
        parent: this.screen,
        top: 4,
        left: 2,
        width: '96%',
        height: 5,
        content: '\n  No game in progress. Start a new adventure first!',
        style: {
          border: { fg: 'red' }
        }
      });
    } else if (gameState.llmEnabled) {
      // LLM mode stats
      const exchanges = Math.floor((gameState.messageHistory.length - 1) / 2);

      UIComponents.createBox({
        parent: this.screen,
        top: 4,
        left: 0,
        width: '100%',
        height: 7,
        label: ' Progress ',
        content: `
  {bold}Mode:{/}              LLM (AI Game Master)
  {bold}Turns Taken:{/}       ${gameState.moves}
  {bold}Items Collected:{/}   ${gameState.inventory.length}
  {bold}Conversations:{/}     ${exchanges} exchanges`,
        tags: true,
        style: {
          border: { fg: 'yellow' }
        }
      });

      const invText = gameState.inventory.length > 0
        ? gameState.inventory.map(i => `  ${i}`).join('\n')
        : '  Empty';

      UIComponents.createBox({
        parent: this.screen,
        top: 12,
        left: 0,
        width: '100%',
        height: Math.max(gameState.inventory.length + 2, 5),
        label: ' Inventory ',
        content: `\n${invText}`,
        tags: true,
        style: {
          border: { fg: 'green' }
        }
      });
    } else {
      // Static mode stats
      const visitedCount = gameState.visitedRooms.size;
      const totalItems = allRooms.reduce((sum, r) => sum + r.items.length, 0);
      const collectedItems = gameState.inventory.length;
      const progressPct = Math.round(((visitedCount + collectedItems) / (totalRooms + totalItems)) * 100);

      UIComponents.createBox({
        parent: this.screen,
        top: 4,
        left: 0,
        width: '100%',
        height: 8,
        label: ' Progress ',
        content: `
  {bold}Mode:{/}              Offline (Static)
  {bold}Moves Made:{/}        ${gameState.moves}
  {bold}Rooms Explored:{/}    ${visitedCount} / ${totalRooms}
  {bold}Items Collected:{/}   ${collectedItems} / ${totalItems}
  {bold}Completion:{/}        ${progressPct}%
  {bold}Current Location:{/}  ${this.gameModel.getRoom(gameState.currentRoom).name}`,
        tags: true,
        style: {
          border: { fg: 'yellow' }
        }
      });

      const visitedList = Array.from(gameState.visitedRooms).map(id => {
        const room = this.gameModel.getRoom(id);
        return `  ${room.name}`;
      }).join('\n');

      const unvisitedList = allRooms
        .filter(r => !gameState.visitedRooms.has(r.id))
        .map(r => `  {gray-fg}${r.name} (unexplored){/}`)
        .join('\n');

      UIComponents.createBox({
        parent: this.screen,
        top: 13,
        left: 0,
        width: '50%',
        height: totalRooms + 3,
        label: ' Rooms ',
        content: `\n${visitedList}${unvisitedList ? '\n' + unvisitedList : ''}`,
        tags: true,
        style: {
          border: { fg: 'cyan' }
        }
      });

      const invText = gameState.inventory.length > 0
        ? gameState.inventory.map(i => `  ${i}`).join('\n')
        : '  Empty';

      UIComponents.createBox({
        parent: this.screen,
        top: 13,
        right: 0,
        width: '50%',
        height: totalRooms + 3,
        label: ' Inventory ',
        content: `\n${invText}`,
        tags: true,
        style: {
          border: { fg: 'green' }
        }
      });
    }

    // Footer
    UIComponents.createBox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{gray-fg}b=back | q=quit{/}',
      tags: true,
      style: { fg: 'white' }
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
