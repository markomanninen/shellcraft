import { UIComponents } from './components.js';
import { GameModel } from '../models/game.js';
import { LLMGameEngine } from '../llm/game-engine.js';

export class RoomScreen {
  constructor(context) {
    this.context = context;
    this.screen = context.screen;
    this.gameModel = new GameModel();
    this.llmEngine = new LLMGameEngine();
    this.alive = true;
    this.loadingInterval = null;
    this.render();
  }

  render() {
    const gameState = this.context.session.gameState;

    // If we have a pre-fetched LLM response, render it directly
    if (gameState.pendingResponse) {
      const resp = gameState.pendingResponse;
      delete gameState.pendingResponse;
      this.renderRoom(
        resp.room_name,
        resp.description,
        resp.items_here.length > 0
          ? `Visible: ${resp.items_here.join(', ')}`
          : 'No items visible',
        resp.actions,
        gameState,
        null,
        resp.message
      );
    } else if (gameState.llmEnabled) {
      this.renderLoading();
      this.fetchLLMResponse(gameState);
    } else {
      const room = this.gameModel.getRoom(gameState.currentRoom);
      this.renderRoom(
        room.name,
        room.description,
        `Items here: ${room.items.length > 0 ? room.items.join(', ') : 'none'}`,
        this.getStaticActions(room),
        gameState,
        room,
        null
      );
    }
  }

  renderLoading() {
    UIComponents.createBox({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: 7,
      content: '\n\n{center}{yellow-fg}The game master is thinking...{/}\n{center}{gray-fg}Please wait{/}',
      tags: true,
      style: { border: { fg: 'yellow' } }
    });

    let dots = 0;
    this.loadingInterval = setInterval(() => {
      dots = (dots + 1) % 4;
      const dotStr = '.'.repeat(dots);
      if (this.alive && this.screen.children.length > 0) {
        this.screen.children[0].setContent(
          `\n\n{center}{yellow-fg}The game master is thinking${dotStr}{/}\n{center}{gray-fg}Please wait{/}`
        );
        this.screen.render();
      }
    }, 500);

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
      this.alive = false;
      if (this.loadingInterval) {
        clearInterval(this.loadingInterval);
        this.loadingInterval = null;
      }
      this.context.navigate('game');
    });

    this.screen.render();
  }

  async fetchLLMResponse(gameState) {
    try {
      let result;
      if (gameState.isFirstTurn) {
        result = await this.llmEngine.startGame();
        gameState.isFirstTurn = false;
      } else {
        result = await this.llmEngine.processAction(
          gameState.pendingAction,
          gameState.messageHistory,
          gameState.inventory
        );
        delete gameState.pendingAction;
      }

      if (!this.alive) return;

      gameState.messageHistory = result.messages;

      const update = result.response.inventory_update;
      if (update.add) {
        update.add.forEach(item => {
          if (!gameState.inventory.includes(item)) {
            gameState.inventory.push(item);
          }
        });
      }
      if (update.remove) {
        gameState.inventory = gameState.inventory.filter(
          item => !update.remove.includes(item)
        );
      }

      gameState.moves++;

      if (this.loadingInterval) {
        clearInterval(this.loadingInterval);
        this.loadingInterval = null;
      }

      if (!this.alive) return;

      if (result.response.game_over) {
        gameState.pendingResponse = result.response;
        gameState.pendingResponse._gameOver = true;
        this.context.navigate('room');
        return;
      }

      // Store response and re-navigate through the router for clean screen state
      gameState.pendingResponse = result.response;
      this.context.navigate('room');

    } catch (error) {
      if (!this.alive) return;
      if (this.loadingInterval) {
        clearInterval(this.loadingInterval);
        this.loadingInterval = null;
      }
      gameState.pendingError = error;
      this.context.navigate('room');
    }
  }

  renderRoom(roomName, description, itemsText, actionItems, gameState, staticRoom, message) {
    // Check for game over
    if (gameState.pendingResponse && gameState.pendingResponse._gameOver) {
      const resp = gameState.pendingResponse;
      delete gameState.pendingResponse;
      this.renderGameOver(resp);
      return;
    }

    // Check for error
    if (gameState.pendingError) {
      const error = gameState.pendingError;
      delete gameState.pendingError;
      this.renderError(error, gameState);
      return;
    }

    // Room description
    UIComponents.createBox({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 7,
      label: ` ${roomName} `,
      content: `\n  ${description}\n\n  ${itemsText}`,
      tags: true,
      style: { border: { fg: 'yellow' } }
    });

    // Message box (LLM feedback about last action)
    let messageOffset = 0;
    if (message) {
      const msgLines = Math.ceil(message.length / 74) + 2;
      UIComponents.createBox({
        parent: this.screen,
        top: 8,
        left: 0,
        width: '100%',
        height: msgLines,
        content: `  {green-fg}${message}{/}`,
        tags: true,
        style: { border: { fg: 'green' } }
      });
      messageOffset = msgLines + 1;
    }

    // Inventory
    const invText = gameState.inventory.length > 0
      ? gameState.inventory.join(', ')
      : 'Empty';

    UIComponents.createBox({
      parent: this.screen,
      top: 8 + messageOffset,
      left: 0,
      width: '100%',
      height: 3,
      label: ' Inventory ',
      content: `  ${invText}`,
      tags: true,
      style: { border: { fg: 'green' } }
    });

    // Actions menu
    const extraActions = staticRoom ? [] : ['Ask the Game Master...'];
    const allActions = [...actionItems, ...extraActions, 'Back to menu'];
    const actions = UIComponents.createList({
      parent: this.screen,
      top: 12 + messageOffset,
      left: 0,
      width: '100%',
      height: allActions.length + 2,
      label: ' Actions ',
      items: allActions,
      keys: false,
      vi: false,
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

      if (action === 'Back to menu') {
        this.context.navigate('game');
      } else if (action === 'Ask the Game Master...') {
        this.showTextInput(actions, gameState);
      } else if (staticRoom) {
        this.handleStaticAction(action, staticRoom, gameState);
      } else {
        gameState.pendingAction = action;
        this.context.navigate('room');
      }
    };

    actions.on('select', (_item, index) => handleSelect(index));

    // Footer
    const isEditing = () => this.screen.focused?.type === 'textbox';
    UIComponents.createBox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: `{center}Moves: ${gameState.moves} | Items: ${gameState.inventory.length}{/}\n{center}{gray-fg}h=menu | i=inventory | q=quit{/}`,
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

    // Explicit arrow/enter key routing (blessed focus workaround)
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

    // Deferred activation + focus
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
      label: ' Ask the Game Master (Esc=cancel) ',
      style: { border: { fg: 'yellow' } }
    });

    inputBox.on('submit', (value) => {
      inputBox.destroy();
      const text = value?.trim();
      if (text) {
        gameState.pendingAction = text;
        this.context.navigate('room');
      } else {
        actionsList.focus();
        this.screen.render();
      }
    });

    inputBox.on('cancel', () => {
      inputBox.destroy();
      actionsList.focus();
      this.screen.render();
    });

    inputBox.focus();
    this.screen.render();
  }

  renderError(error, gameState) {
    UIComponents.createBox({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: 9,
      label: ' Connection Error ',
      content: `\n  {red-fg}Could not reach the game master.{/}\n\n  ${(error.message || 'Unknown error').substring(0, 60)}\n\n  {gray-fg}r=retry | f=offline mode | h=menu{/}`,
      tags: true,
      style: { border: { fg: 'red' } }
    });

    this.screen.key(['r'], () => {
      this.context.navigate('room');
    });
    this.screen.key(['f'], () => {
      gameState.llmEnabled = false;
      gameState.currentRoom = 'start';
      this.context.navigate('room');
    });
    this.screen.key(['h'], () => this.context.navigate('game'));

    this.screen.render();
  }

  renderGameOver(response) {
    UIComponents.createBox({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: 9,
      label: ` ${response.room_name} `,
      content: `\n  ${response.description}\n\n  {bold}{yellow-fg}GAME OVER - VICTORY!{/}\n\n  {gray-fg}Press Enter to return to menu{/}`,
      tags: true,
      style: { border: { fg: 'yellow' } }
    });

    this.screen.key(['enter'], () => this.context.navigate('game'));
    this.screen.render();
  }

  // --- Static fallback (original behavior) ---

  getStaticActions(room) {
    const actions = [];
    Object.keys(room.exits).forEach(dir => actions.push(`Go ${dir}`));
    room.items.forEach(item => actions.push(`Take ${item}`));
    actions.push('Look around');
    return actions;
  }

  handleStaticAction(action, room, gameState) {
    if (action.startsWith('Go ')) {
      const direction = action.split(' ')[1];
      const nextRoomId = room.exits[direction];
      if (nextRoomId) {
        gameState.currentRoom = nextRoomId;
        gameState.visitedRooms.add(nextRoomId);
        gameState.moves++;
        this.context.navigate('room');
      }
    } else if (action.startsWith('Take ')) {
      const item = action.split(' ')[1];
      const index = room.items.indexOf(item);
      if (index > -1) {
        room.items.splice(index, 1);
        gameState.inventory.push(item);
        UIComponents.showMessage(this.screen, `Picked up: ${item}`, 'success');
        setTimeout(() => this.context.navigate('room'), 1500);
      }
    } else if (action.includes('Look around')) {
      UIComponents.showMessage(this.screen, 'You examine your surroundings carefully...', 'info');
    }
  }
}
