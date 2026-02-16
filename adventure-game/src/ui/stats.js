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
    const contentTop = 4;
    const footerHeight = 3;
    const availableHeight = Math.max(10, this.screen.height - contentTop - footerHeight);
    const progressHeight = Math.max(6, Math.min(9, Math.floor(availableHeight * 0.45)));
    const lowerTop = contentTop + progressHeight;
    const lowerHeight = Math.max(4, availableHeight - progressHeight);

    UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}{yellow-fg}GAME STATS{/}',
      tags: true
    });

    if (!gameState?.worldState) {
      UIComponents.createBox({
        parent: this.screen,
        top: 4,
        left: 2,
        width: '96%',
        height: 5,
        content: '\n  No game in progress. Start a new adventure first!',
        style: { border: { fg: 'red' } }
      });
      this.renderFooter();
      return;
    }

    const currentRoom = this.gameModel.getRoom(gameState.currentRoom);
    const director = gameState.worldState.director;
    const checks = gameState.worldState.metrics.checks;
    const checksTotal = checks.passed + checks.partial + checks.failed;
    const actionCounts = gameState.worldState.metrics.actionCounts;
    const questStats = Object.values(gameState.worldState.quests);
    const completedQuests = questStats.filter((quest) => quest.status === 'completed').length;

    UIComponents.createBox({
      parent: this.screen,
      top: contentTop,
      left: 0,
      width: '100%',
      height: progressHeight,
      label: ' Progress ',
      content: `
  {bold}Health:{/}            ${gameState.player.health} / ${gameState.player.maxHealth}
  {bold}Turns Taken:{/}       ${gameState.moves}
  {bold}Location:{/}          ${currentRoom?.name || gameState.currentRoom}
  {bold}Items Collected:{/}   ${gameState.inventory.length}
  {bold}Quests Completed:{/}  ${completedQuests} / ${questStats.length}
  {bold}Director:{/}          ${director.style} (${director.lastBeat})
  {bold}Tension:{/}           ${director.tension}  |  {bold}Phase:{/} ${gameState.worldState.time.phase}`,
      tags: true,
      style: { border: { fg: 'yellow' } }
    });

    UIComponents.createBox({
      parent: this.screen,
      top: lowerTop,
      left: 0,
      width: '50%',
      height: lowerHeight,
      label: ' Skill & Combat ',
      content: `
  Total: ${checksTotal}
  Passed: ${checks.passed}
  Partial: ${checks.partial}
  Failed: ${checks.failed}

  Combat Wins: ${gameState.worldState.metrics.combatVictories}
  Damage Dealt: ${gameState.worldState.metrics.damageDealt}
  Damage Taken: ${gameState.worldState.metrics.damageTaken}`,
      style: { border: { fg: 'cyan' } }
    });

    const actionProfile = Object.entries(actionCounts)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => `  ${key}: ${count}`)
      .join('\n');

    UIComponents.createBox({
      parent: this.screen,
      top: lowerTop,
      right: 0,
      width: '50%',
      height: lowerHeight,
      label: ' Action Profile ',
      content: `\n${actionProfile || '  No actions recorded yet.'}`,
      style: { border: { fg: 'magenta' } }
    });

    this.renderFooter();
  }

  renderFooter() {
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

    this.screen.key(['b', 'escape'], () => this.context.navigate('game'));
  }
}
