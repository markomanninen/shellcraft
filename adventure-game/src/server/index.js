import fs from 'fs';
import path from 'path';
import ssh2 from 'ssh2';
import { runtimeConfig } from '../config/runtime-config.js';

const { Server } = ssh2;
import { CommandRouter } from './router.js';
import { SessionManager } from './session.js';

const PORT = runtimeConfig.server.port;
const HOST = runtimeConfig.server.host;

function resolveHostKeyPath(hostKeyPath) {
  if (path.isAbsolute(hostKeyPath)) {
    return hostKeyPath;
  }
  return path.resolve(process.cwd(), hostKeyPath);
}

const resolvedHostKeyPath = resolveHostKeyPath(runtimeConfig.server.hostKeyPath);
if (!fs.existsSync(resolvedHostKeyPath)) {
  throw new Error(`[startup] Host key not found at "${resolvedHostKeyPath}"`);
}
const HOST_KEY = fs.readFileSync(resolvedHostKeyPath);

class TerminalServer {
  constructor() {
    this.server = new Server({
      hostKeys: [HOST_KEY]
    }, this.handleClient.bind(this));
    
    this.sessionManager = new SessionManager();
    this.router = new CommandRouter();
  }

  handleClient(client) {
    console.log('Client connecting...');

    let username = null;

    client.on('authentication', (ctx) => {
      // Capture username (always available — it's the SSH login name)
      username = ctx.username;
      // Accept any auth method — no password prompt
      ctx.accept();
    });

    client.on('ready', () => {
      const session = this.sessionManager.createSession(username);
      console.log(`Client authenticated as "${session.username}"`);

      client.on('session', (accept) => {
        const session_stream = accept();
        let ptyInfo = null;

        session_stream.once('pty', (accept, reject, info) => {
          ptyInfo = info;
          accept && accept();
        });

        session_stream.once('shell', (accept) => {
          const stream = accept();

          // Initialize UI
          this.router.handleConnection(stream, session, ptyInfo, this.sessionManager);

          stream.on('error', (err) => {
            console.error('Stream error:', err);
          });

          stream.on('close', () => {
            console.log(`Client disconnected (${session.username})`);
          });
        });
      });
    });

    client.on('error', (err) => {
      console.error('Client error:', err);
    });
  }

  start() {
    this.server.listen(PORT, HOST, () => {
      console.log(`Terminal server listening on ${HOST}:${PORT}`);
      console.log(`Connect with: ssh localhost -p ${PORT}`);
    });
  }
}

const server = new TerminalServer();
server.start();
