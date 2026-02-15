import blessed from 'blessed';
import { GameScreen } from '../ui/game.js';
import { RoomScreen } from '../ui/room.js';
import { InventoryScreen } from '../ui/inventory.js';
import { HelpScreen } from '../ui/help.js';
import { StatsScreen } from '../ui/stats.js';

export class CommandRouter {
  constructor() {
    this.screens = {
      game: GameScreen,
      room: RoomScreen,
      inventory: InventoryScreen,
      help: HelpScreen,
      stats: StatsScreen
    };
  }

  handleConnection(stream, session, ptyInfo) {
    // CRITICAL: Set stream dimensions BEFORE creating blessed screen
    stream.columns = ptyInfo?.cols || 80;
    stream.rows = ptyInfo?.rows || 24;
    stream.isTTY = true;

    // Create blessed screen
    const screen = blessed.screen({
      smartCSR: false,
      input: stream,
      output: stream,
      terminal: 'xterm-256color',
      fullUnicode: true
    });

    screen.title = 'Terminal Adventure';

    // Global quit handler — saved so we can re-register after cleanup
    const quitHandler = () => {
      // Don't quit when typing in a text input (q would disconnect!)
      if (screen.focused && screen.focused.type === 'textbox') return;
      screen.destroy();
      stream.end();
    };
    screen.key(['C-c', 'q'], quitHandler);

    // Save original method before override
    const originalKey = screen.key.bind(screen);

    // Navigation context
    const context = {
      screen,
      session,
      navigate: (screenName, data) => {
        // Remove ALL 'key *' listeners, then re-register quit handler
        const keyEvents = Object.keys(screen._events || {}).filter(
          e => e.startsWith('key ')
        );
        keyEvents.forEach(event => {
          screen.removeAllListeners(event);
        });
        originalKey(['C-c', 'q'], quitHandler);

        // Destroy all UI elements completely
        while (screen.children.length > 0) {
          screen.children[0].destroy();
        }

        // Force clear screen
        screen.clearRegion(0, screen.width, 0, screen.height);

        // Show new screen
        this.showScreen(screenName, context, data);
        screen.render();
      },
      exit: () => {
        screen.destroy();
        stream.end();
      }
    };

    // Show game screen
    this.showScreen('game', context);

    screen.render();
  }

  showScreen(name, context, data = {}) {
    const ScreenClass = this.screens[name];
    if (ScreenClass) {
      new ScreenClass(context, data);
    }
  }
}
