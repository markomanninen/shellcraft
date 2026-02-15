import blessed from 'blessed';
import { DashboardScreen } from '../ui/dashboard.js';
import { OverviewScreen } from '../ui/overview.js';
import { ResourcesScreen } from '../ui/resources.js';
import { LogsScreen } from '../ui/logs.js';
import { ProcessesScreen } from '../ui/processes.js';
import { NetworkScreen } from '../ui/network.js';
import { ServicesScreen } from '../ui/services.js';
import { SettingsScreen } from '../ui/settings.js';

export class CommandRouter {
  constructor() {
    this.screens = {
      dashboard: DashboardScreen,
      overview: OverviewScreen,
      resources: ResourcesScreen,
      logs: LogsScreen,
      processes: ProcessesScreen,
      network: NetworkScreen,
      services: ServicesScreen,
      settings: SettingsScreen
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

    screen.title = 'Admin Dashboard';

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

    // Show dashboard screen
    this.showScreen('dashboard', context);

    screen.render();
  }

  showScreen(name, context, data = {}) {
    const ScreenClass = this.screens[name];
    if (ScreenClass) {
      new ScreenClass(context, data);
    }
  }
}
