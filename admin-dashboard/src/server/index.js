import fs from 'fs';
import path from 'path';
import ssh2 from 'ssh2';
import dotenv from 'dotenv';

const { Server } = ssh2;
import { CommandRouter } from './router.js';
import { SessionManager } from './session.js';

dotenv.config();

const PORT = process.env.SSH_PORT || 2222;
const HOST_KEY = fs.readFileSync(process.env.HOST_KEY_PATH || './keys/host_key');

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
    
    let publicKey = null;
    
    client.on('authentication', (ctx) => {
      if (ctx.method === 'publickey') {
        publicKey = ctx.key;
        ctx.accept();
      } else if (ctx.method === 'none') {
        // Allow anonymous access
        ctx.accept();
      } else {
        ctx.reject();
      }
    });

    client.on('ready', () => {
      console.log('Client authenticated');
      
      const session = this.sessionManager.createSession(publicKey);
      
      client.on('session', (accept) => {
        const session_stream = accept();
        let ptyInfo = null;
        
        session_stream.once('pty', (accept, reject, info) => {
          ptyInfo = info;
          accept && accept();
        });
        
        session_stream.once('shell', (accept) => {
          const stream = accept();
          
          try {
            // Initialize UI
            console.log('Initializing UI...');
            this.router.handleConnection(stream, session, ptyInfo);
            console.log('UI initialized successfully');
          } catch (error) {
            console.error('Error initializing UI:', error);
            stream.write('Error loading dashboard. Check server logs.\r\n');
            stream.end();
          }
          
          stream.on('error', (err) => {
            console.error('Stream error:', err);
          });
          
          stream.on('close', () => {
            console.log('Client disconnected');
            this.sessionManager.destroySession(session.id);
          });
        });
      });
    });

    client.on('error', (err) => {
      console.error('Client error:', err);
    });
  }

  start() {
    this.server.on('error', (err) => {
      console.error('Server error:', err);
    });
    
    this.server.listen(PORT, '0.0.0.0', () => {
      console.log(`Terminal server listening on port ${PORT}`);
      console.log(`Connect with: ssh localhost -p ${PORT}`);
    });
  }
}

const server = new TerminalServer();
server.start();
