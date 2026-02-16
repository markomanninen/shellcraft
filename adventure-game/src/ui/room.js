import { UIComponents } from './components.js';
import { LLMGameEngine } from '../llm/game-engine.js';
import { RulesEngine } from '../models/rules-engine.js';
import { normalizeGameState } from '../models/game-state.js';
import { GAME_CONFIG } from '../config/game-config.js';
import { wizardAnimation } from './loading-animation.js';

export function validateRenderableResponse(response) {
  if (!response || typeof response !== 'object') {
    throw new Error('[room] Invalid cached response: expected object');
  }

  if (!Array.isArray(response.items_here) || !Array.isArray(response.actions)) {
    throw new Error('[room] Invalid cached response: "items_here" and "actions" must be arrays');
  }

  if (typeof response.room_name !== 'string' || typeof response.description !== 'string') {
    throw new Error('[room] Invalid cached response: missing room metadata');
  }

  if (response.actions.length === 0) {
    throw new Error('[room] Invalid cached response: "actions" must not be empty');
  }

  if (typeof response.message !== 'string') {
    throw new Error('[room] Invalid cached response: "message" must be a string');
  }

  if (!response.director || typeof response.director !== 'object') {
    throw new Error('[room] Invalid cached response: missing "director"');
  }

  if (typeof response.director.style !== 'string' || typeof response.director.lastBeat !== 'string') {
    throw new Error('[room] Invalid cached response: invalid "director" payload');
  }

  if (!Number.isFinite(response.director.tension)) {
    throw new Error('[room] Invalid cached response: "director.tension" must be numeric');
  }

  if (typeof response.phase !== 'string' || !GAME_CONFIG.gameplay.timePhases.includes(response.phase)) {
    throw new Error('[room] Invalid cached response: invalid "phase"');
  }

  if (!response.player || typeof response.player !== 'object') {
    throw new Error('[room] Invalid cached response: missing "player"');
  }

  if (!Number.isFinite(response.player.health) || !Number.isFinite(response.player.maxHealth)) {
    throw new Error('[room] Invalid cached response: invalid "player" payload');
  }

  if (response.active_encounter !== null && response.active_encounter !== undefined) {
    if (typeof response.active_encounter !== 'object') {
      throw new Error('[room] Invalid cached response: "active_encounter" must be object or null');
    }
    if (
      typeof response.active_encounter.name !== 'string' ||
      !Number.isFinite(response.active_encounter.currentHp) ||
      !Number.isFinite(response.active_encounter.maxHp)
    ) {
      throw new Error('[room] Invalid cached response: invalid "active_encounter" payload');
    }
  }

  return response;
}

export function buildMeterBar(value, max, width = 18) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0 || width < 1) {
    throw new Error('[room] Invalid meter values');
  }

  const clamped = Math.min(Math.max(value, 0), max);
  const filled = Math.round((clamped / max) * width);
  return `${'='.repeat(filled)}${'-'.repeat(width - filled)}`;
}

export function classifyAction(action) {
  if (typeof action !== 'string' || !action.trim()) {
    return 'ACTION';
  }

  const text = action.toLowerCase();
  if (text.includes('back to menu')) return 'SYSTEM';
  if (text.includes('game master')) return 'CUSTOM';

  if (/(^go\b|north|south|east|west|travel|retreat|enter|leave|return)/.test(text)) return 'MOVE';
  if (/(attack|strike|fight|combat|defend|slay|guardian|sentinel|wolf)/.test(text)) return 'COMBAT';
  if (/(talk|speak|ask|persuade|negotiate|elder|ranger|keeper)/.test(text)) return 'SOCIAL';
  if (/(look|investigate|inspect|search|examine|scout|read)/.test(text)) return 'LOOK';
  if (/(take|pick|grab|loot|collect|recover|claim|use)/.test(text)) return 'USE';

  return 'ACTION';
}

function buildActionLabel(action, index) {
  const slot = String(index + 1).padStart(2, ' ');
  const tag = classifyAction(action).padEnd(6, ' ');
  return `${slot}. [${tag}] ${action}`;
}

export class RoomScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.llmEngine = new LLMGameEngine();
    this.rulesEngine = new RulesEngine();
    this.alive = true;
    this.loadingInterval = null;

    this.context.session.gameState = normalizeGameState(this.context.session.gameState);
    this.render();
  }

  render() {
    const gameState = this.context.session.gameState;

    if (gameState.pendingError) {
      const error = gameState.pendingError;
      delete gameState.pendingError;
      this.renderError(error);
      return;
    }

    if (gameState.pendingResponse) {
      const pendingResponse = gameState.pendingResponse;
      delete gameState.pendingResponse;
      try {
        const response = validateRenderableResponse(pendingResponse);
        gameState.lastResponse = response;
        this.renderRoom(response, gameState);
      } catch (error) {
        delete gameState.lastResponse;
        this.context.saveGame();
        this.renderError(error);
      }
      return;
    }

    if (gameState.pendingTurn || gameState.pendingAction || gameState.isFirstTurn || !gameState.lastResponse) {
      this.renderLoading();
      this.fetchTurnNarration(gameState);
      return;
    }

    try {
      const resumeResponse = validateRenderableResponse(gameState.lastResponse);
      this.renderRoom(resumeResponse, gameState);
    } catch (error) {
      delete gameState.lastResponse;
      this.context.saveGame();
      this.renderError(error);
    }
  }

  renderLoading() {
    const { frames, interval, color } = wizardAnimation;
    const frameHeight = frames[0].length;
    const frameWidth = frames[0][0].length;

    const animBox = UIComponents.createBox({
      parent: this.screen,
      top: 2,
      left: 'center',
      width: frameWidth + 4,
      height: frameHeight + 2,
      label: ' Resolving Turn ',
      tags: true,
      style: { border: { fg: color } },
      align: 'center',
      valign: 'middle'
    });

    let frameIndex = 0;
    const renderFrame = () => {
      if (!this.alive) return;
      const frame = frames[frameIndex];
      const content = frame.map((line) => `{${color}-fg}${line}{/}`).join('\n');
      animBox.setContent(content);
      this.screen.render();
      frameIndex = (frameIndex + 1) % frames.length;
    };

    renderFrame();
    this.loadingInterval = setInterval(renderFrame, interval);

    UIComponents.createBox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{gray-fg}h=menu | q=quit{/}',
      tags: true,
      style: { fg: 'white' }
    });

    this.screen.key(['h'], () => {
      this.cleanupLoading();
      this.context.navigate('game');
    });

    this.screen.render();
  }

  cleanupLoading() {
    this.alive = false;
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
      this.loadingInterval = null;
    }
  }

  async fetchTurnNarration(gameState) {
    try {
      if (!gameState.pendingTurn) {
        const action = gameState.isFirstTurn
          ? '__start__'
          : (gameState.pendingAction || GAME_CONFIG.gameplay.genericActions[0]);
        const turn = this.rulesEngine.resolveTurn(gameState, action);
        gameState.pendingTurn = turn;
        delete gameState.pendingAction;
        this.context.saveGame();
      }

      const narration = await this.llmEngine.narrateTurn(gameState.pendingTurn, gameState.messageHistory);
      if (!this.alive) return;

      gameState.messageHistory = narration.messages;
      const turn = gameState.pendingTurn;
      const combinedMessage = `${turn.outcome.message} ${narration.response.message}`.trim();
      const response = {
        room_name: turn.room.name,
        description: narration.response.description,
        items_here: turn.itemsHere,
        actions: turn.actions,
        message: combinedMessage,
        game_over: turn.gameOver,
        director: turn.director,
        phase: turn.phase,
        player: turn.player,
        active_encounter: turn.activeEncounter,
        action_outcome: turn.outcome.status,
        deterministic_message: turn.outcome.message
      };

      delete gameState.pendingTurn;
      gameState.lastTurn = turn;
      gameState.lastResponse = response;
      gameState.pendingResponse = response;

      if (response.game_over) {
        gameState.pendingResponse._gameOver = true;
      }

      this.context.saveGame();
      this.cleanupLoading();
      this.context.navigate('room');
    } catch (error) {
      if (!this.alive) return;
      this.cleanupLoading();
      gameState.pendingError = error;
      this.context.navigate('room');
    }
  }

  renderRoom(response, gameState) {
    if (response._gameOver) {
      this.renderGameOver(response);
      return;
    }

    const hpBar = buildMeterBar(response.player.health, response.player.maxHealth);
    const tensionMax = GAME_CONFIG.systems.pacing.maxTension;
    const tensionBar = buildMeterBar(response.director.tension, tensionMax);
    const activeQuest = Object.values(gameState.worldState.quests)
      .find((quest) => quest.status === 'active');
    const objectiveText = activeQuest
      ? `${activeQuest.title} (${Math.round(activeQuest.progress)}%)`
      : 'No active objective';
    const itemsText = response.items_here.length > 0
      ? `Visible: ${response.items_here.join(', ')}`
      : 'Visible: none';
    const encounterText = response.active_encounter
      ? `Threat: ${response.active_encounter.name} (${response.active_encounter.currentHp}/${response.active_encounter.maxHp} HP)`
      : 'Threat: none';
    const roomMeta = `Phase: ${response.phase} | Style: ${response.director.style} | Beat: ${response.director.lastBeat}`;
    const footerHeight = 4;
    const topHeight = Math.max(9, Math.min(13, Math.floor(this.screen.height * 0.45)));
    const lowerHeight = Math.max(7, this.screen.height - topHeight - footerHeight);
    const rawMessage = response.message || '';
    const displayMessage = rawMessage.length > 260
      ? `${rawMessage.slice(0, 257)}...`
      : rawMessage;
    const msgLineWidth = Math.max(30, Math.floor(this.screen.width * 0.62) - 10);
    const messageHeight = displayMessage
      ? Math.min(Math.ceil(displayMessage.length / msgLineWidth) + 2, 5)
      : 0;
    const rightPaneTop = topHeight;
    const leftPaneTop = topHeight + messageHeight;
    const actionsHeight = Math.max(4, lowerHeight - messageHeight);

    UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '64%',
      height: topHeight,
      label: ` ${response.room_name} `,
      content: `\n  ${response.description}\n\n  ${roomMeta}`,
      tags: true,
      style: { border: { fg: 'yellow' } }
    });

    UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: '64%',
      width: '36%',
      height: topHeight,
      label: ' Tactical Telemetry ',
      content: `
  HP      [${hpBar}] ${response.player.health}/${response.player.maxHealth}
  Tension [${tensionBar}] ${response.director.tension}/${tensionMax}

  ${encounterText}
  Objective:
  ${objectiveText}`,
      style: { border: { fg: 'cyan' } }
    });

    if (displayMessage) {
      UIComponents.createBox({
        parent: this.screen,
        top: topHeight,
        left: 0,
        width: '64%',
        height: messageHeight,
        label: ' Outcome ',
        content: `  {green-fg}${displayMessage}{/}`,
        tags: true,
        style: { border: { fg: 'green' } }
      });
    }

    const invText = gameState.inventory.length > 0
      ? gameState.inventory.join(', ')
      : 'Empty';
    const invDisplay = invText.length > 180 ? `${invText.slice(0, 177)}...` : invText;

    UIComponents.createBox({
      parent: this.screen,
      top: rightPaneTop,
      left: '64%',
      width: '36%',
      height: lowerHeight,
      label: ' Field Notes ',
      content: `
  ${itemsText}

  Inventory:
  ${invDisplay}

  Turn: ${gameState.moves}
  Last Outcome: ${response.action_outcome || 'n/a'}`,
      style: { border: { fg: 'green' } }
    });

    const allActions = [
      ...response.actions,
      GAME_CONFIG.gameplay.freeTextLabel,
      GAME_CONFIG.gameplay.backToMenuLabel
    ];
    const actionItems = allActions.map((action, index) => buildActionLabel(action, index));

    const actions = UIComponents.createList({
      parent: this.screen,
      top: leftPaneTop,
      left: 0,
      width: '64%',
      height: actionsHeight,
      label: ' Tactical Actions ',
      items: actionItems,
      keys: false,
      vi: false,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        style: { bg: 'magenta' }
      },
      style: {
        border: { fg: 'magenta' },
        selected: { bg: 'blue', fg: 'white' },
        item: { fg: 'white' }
      }
    });

    let menuActive = false;
    const handleSelect = (index) => {
      if (!menuActive) return;
      const action = allActions[index];
      if (!action) return;

      if (action === GAME_CONFIG.gameplay.backToMenuLabel) {
        this.context.navigate('game');
        return;
      }

      if (action === GAME_CONFIG.gameplay.freeTextLabel) {
        this.showTextInput(actions, gameState);
        return;
      }

      gameState.pendingAction = action;
      this.context.navigate('room');
    };

    actions.on('select', (_item, index) => handleSelect(index));

    const isEditing = () => this.screen.focused?.type === 'textbox';
    UIComponents.createBox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: footerHeight,
      content: `{center}Turn ${gameState.moves} | HP ${response.player.health}/${response.player.maxHealth} | Tension ${response.director.tension}/${tensionMax}{/}\n{center}{gray-fg}1-9=quick action | Enter=select | h=menu | i=inventory | j=journal | q=quit{/}`,
      tags: true,
      style: { fg: 'white' }
    });

    this.screen.key(['h'], () => {
      if (isEditing()) return;
      this.context.navigate('game');
    });
    this.screen.key(['i'], () => {
      if (isEditing()) return;
      this.context.navigate('inventory');
    });
    this.screen.key(['j'], () => {
      if (isEditing()) return;
      this.context.navigate('journal');
    });

    this.screen.key(['up'], () => {
      if (isEditing() || !menuActive) return;
      actions.up();
      this.screen.render();
    });
    this.screen.key(['down'], () => {
      if (isEditing() || !menuActive) return;
      actions.down();
      this.screen.render();
    });
    this.screen.key(['enter'], () => {
      if (isEditing() || !menuActive) return;
      handleSelect(actions.selected);
    });
    this.screen.key(['1', '2', '3', '4', '5', '6', '7', '8', '9'], (_ch, key) => {
      if (isEditing() || !menuActive) return;
      const index = Number(key.name) - 1;
      if (Number.isInteger(index) && index >= 0 && index < allActions.length) {
        actions.select(index);
        this.screen.render();
        handleSelect(index);
      }
    });

    setTimeout(() => {
      menuActive = true;
      actions.select(0);
      actions.focus();
      this.screen.render();
    }, 0);
  }

  showTextInput(actionsList, gameState) {
    const inputBox = UIComponents.createInput({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: 3,
      label: ' Enter Action (Esc=cancel) ',
      style: { border: { fg: 'yellow' } }
    });

    inputBox.on('submit', (value) => {
      inputBox.destroy();
      const text = value?.trim();
      if (text) {
        gameState.pendingAction = text;
        this.context.navigate('room');
        return;
      }
      actionsList.focus();
      this.screen.render();
    });

    inputBox.on('cancel', () => {
      inputBox.destroy();
      actionsList.focus();
      this.screen.render();
    });

    inputBox.focus();
    this.screen.render();
  }

  renderError(error) {
    const message = (error.message || 'Unknown error').slice(0, 120);
    UIComponents.createBox({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '75%',
      height: 10,
      label: ' Turn Failed ',
      content: `\n  {red-fg}Turn narration failed.{/}\n\n  ${message}\n\n  {gray-fg}r=retry narration | h=menu{/}`,
      tags: true,
      style: { border: { fg: 'red' } }
    });

    this.screen.key(['r'], () => {
      this.context.navigate('room');
    });
    this.screen.key(['h'], () => {
      this.context.navigate('game');
    });
    this.screen.render();
  }

  renderGameOver(response) {
    UIComponents.createBox({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '75%',
      height: 10,
      label: ` ${response.room_name} `,
      content: `\n  ${response.description}\n\n  {bold}{yellow-fg}VICTORY - QUEST COMPLETE{/}\n\n  {gray-fg}Press Enter to return to menu{/}`,
      tags: true,
      style: { border: { fg: 'yellow' } }
    });

    this.screen.key(['enter'], () => this.context.navigate('game'));
    this.screen.render();
  }
}
