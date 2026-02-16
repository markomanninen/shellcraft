import blessed from 'blessed';
import { GameScreen } from '../ui/game.js';
import { RoomScreen } from '../ui/room.js';
import { InventoryScreen } from '../ui/inventory.js';
import { HelpScreen } from '../ui/help.js';
import { StatsScreen } from '../ui/stats.js';
import { JournalScreen } from '../ui/journal.js';
import { GAME_CONFIG } from '../config/game-config.js';

export class CommandRouter {
  constructor() {
    this.screens = {
      game: GameScreen,
      room: RoomScreen,
      inventory: InventoryScreen,
      journal: JournalScreen,
      help: HelpScreen,
      stats: StatsScreen
    };
  }

  handleConnection(stream, session, ptyInfo, sessionManager) {
    // CRITICAL: Set stream dimensions BEFORE creating blessed screen
    stream.columns = ptyInfo?.cols || GAME_CONFIG.terminal.cols;
    stream.rows = ptyInfo?.rows || GAME_CONFIG.terminal.rows;
    stream.isTTY = true;

    // Create blessed screen
    const screen = blessed.screen({
      smartCSR: false,
      input: stream,
      output: stream,
      terminal: 'xterm-256color',
      fullUnicode: true
    });

    screen.title = GAME_CONFIG.app.name;

    let transitionInterval = null;
    let transitionTimeout = null;
    let transitionToken = 0;

    const clearTransition = () => {
      if (transitionInterval) {
        clearInterval(transitionInterval);
        transitionInterval = null;
      }
      if (transitionTimeout) {
        clearTimeout(transitionTimeout);
        transitionTimeout = null;
      }
    };

    const clearScreenWidgets = () => {
      while (screen.children.length > 0) {
        screen.children[0].destroy();
      }
      screen.clearRegion(0, screen.width, 0, screen.height);
    };

    const runTransition = (screenName, onDone) => {
      clearTransition();
      clearScreenWidgets();

      const transitionBox = blessed.box({
        parent: screen,
        top: 'center',
        left: 'center',
        width: Math.max(34, Math.min(screen.width - 4, 56)),
        height: 7,
        label: ' Transition ',
        tags: true,
        style: {
          border: { fg: 'cyan' },
          fg: 'white'
        }
      });

      const durationMs = 180;
      const barWidth = Math.max(12, Math.min(26, screen.width - 28));
      const startedAt = Date.now();
      let completed = false;

      const finish = () => {
        if (completed) return;
        completed = true;
        clearTransition();
        if (!transitionBox.detached) {
          transitionBox.destroy();
        }
        onDone();
      };

      const tick = () => {
        const elapsed = Date.now() - startedAt;
        const ratio = Math.min(1, elapsed / durationMs);
        const filled = Math.round(ratio * barWidth);
        const dots = '.'.repeat((Math.floor(elapsed / 60) % 3) + 1);
        transitionBox.setContent(
          `\n{center}{bold}Routing to ${screenName}${dots}{/}\n{center}[${'='.repeat(filled)}${'-'.repeat(barWidth - filled)}]{/}`
        );
        screen.render();

        if (ratio >= 1) {
          finish();
        }
      };

      tick();
      transitionInterval = setInterval(tick, 40);
      transitionTimeout = setTimeout(finish, durationMs + 120);
    };

    // Global quit handler — saved so we can re-register after cleanup
    const quitHandler = () => {
      // Don't quit when typing in a text input (q would disconnect!)
      if (screen.focused && screen.focused.type === 'textbox') return;
      clearTransition();
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
      saveGame: () => sessionManager?.saveSession(session.id),
      navigate: (screenName, data) => {
        transitionToken += 1;
        const token = transitionToken;

        // Remove ALL 'key *' listeners, then re-register quit handler
        const keyEvents = Object.keys(screen._events || {}).filter(
          (e) => e.startsWith('key ')
        );
        keyEvents.forEach((event) => {
          screen.removeAllListeners(event);
        });
        originalKey(['C-c', 'q'], quitHandler);

        runTransition(screenName, () => {
          if (token !== transitionToken) return;
          clearScreenWidgets();
          this.showScreen(screenName, context, data);
          screen.render();
        });
      },
      exit: () => {
        clearTransition();
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
