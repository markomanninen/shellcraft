import React from 'react';
import { serve } from '@shellcraft/ui';
import { AdminApp, screens } from '../ui/app.js';

export class CommandRouter {
  /**
   * options.system: a SystemModel shared by all connections (tests pass a
   * stub). By default every connection gets its own, since CPU usage is
   * measured between one session's samples.
   */
  constructor({ system } = {}) {
    this.screens = screens;
    this.system = system;
  }

  /**
   * Run the dashboard on one SSH shell channel.
   *
   * stream: the channel from the 'shell' accept()
   * session: this connection's session (id, fingerprint, ...)
   * ptyInfo: the 'pty' request info ({ cols, rows, term, ... }), or null
   * sshSession: the ssh2 Session, for 'window-change' (terminal resize)
   *
   * Returns the cleanup function from serve().
   */
  handleConnection(stream, session, ptyInfo, sshSession = null) {
    const app = React.createElement(AdminApp, { session, system: this.system, terminal: ptyInfo?.term });
    return serve(stream, ptyInfo, app, { session: sshSession });
  }
}
