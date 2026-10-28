import React from 'react';
import { serve } from '@shellcraft/ui';
import { AdventureApp, screens } from '../ui/app.js';

export class CommandRouter {
  /**
   * options.llm / options.rules: stand-ins for the LLM narrator and the
   * rules engine (tests); by default every connection gets its own.
   */
  constructor(options = {}) {
    this.screens = screens;
    this.llm = options.llm;
    this.rules = options.rules;
  }

  /**
   * Run the adventure on one SSH shell channel.
   *
   * stream: the channel from the 'shell' accept()
   * session: this player's session (gameState is saved with it)
   * ptyInfo: the 'pty' request info ({ cols, rows, ... }), or null
   * sessionManager: saves the session after each turn
   * sshSession: the ssh2 Session, for 'window-change' (terminal resize)
   *
   * Returns the cleanup function from serve().
   */
  handleConnection(stream, session, ptyInfo, sessionManager = null, sshSession = null) {
    const app = React.createElement(AdventureApp, {
      session,
      saveGame: () => sessionManager?.saveSession(session.id),
      llm: this.llm,
      rules: this.rules
    });
    return serve(stream, ptyInfo, app, { session: sshSession });
  }
}
