import React from 'react';
import { serve } from '@shellcraft/ui';
import { ShopApp, screens } from '../ui/app.js';

export class CommandRouter {
  constructor() {
    this.screens = screens;
  }

  /**
   * Run the shop on one SSH shell channel.
   *
   * stream: the channel from the 'shell' accept()
   * session: this connection's shop session (cart, fingerprint, ...)
   * ptyInfo: the 'pty' request info ({ cols, rows, ... }), or null
   * sshSession: the ssh2 Session, for 'window-change' (terminal resize)
   *
   * Returns the cleanup function from serve().
   */
  handleConnection(stream, session, ptyInfo, sshSession = null) {
    return serve(stream, ptyInfo, React.createElement(ShopApp, { session }), { session: sshSession });
  }
}
