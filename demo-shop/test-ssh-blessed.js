import fs from 'fs';
import ssh2 from 'ssh2';
import blessed from 'blessed';

const { Server } = ssh2;

const PORT = 2223;
const HOST_KEY = fs.readFileSync('./keys/host_key');

console.log('TEST 2: SSH server with blessed screen');
console.log('='.repeat(50));

const server = new Server({
  hostKeys: [HOST_KEY]
}, (client) => {
  console.log('✓ Client connected');

  client.on('authentication', (ctx) => {
    console.log('✓ Authentication:', ctx.method);
    ctx.accept();
  });

  client.on('ready', () => {
    console.log('✓ Client authenticated');

    client.on('session', (accept) => {
      const session = accept();
      let ptyInfo = null;

      session.once('pty', (accept, reject, info) => {
        console.log('✓ PTY requested');
        console.log(`  Terminal size: ${info.cols}x${info.rows}`);
        ptyInfo = info;
        accept && accept();
      });

      session.once('shell', (accept) => {
        const stream = accept();
        console.log('✓ Shell started');

        try {
          // Clear screen first
          stream.write('\x1b[2J\x1b[H');
          console.log('✓ Sent clear screen');

          // CRITICAL: Set terminal dimensions on the stream BEFORE creating blessed
          stream.columns = ptyInfo?.cols || 80;
          stream.rows = ptyInfo?.rows || 24;
          stream.isTTY = true;
          console.log(`Set stream dimensions: ${stream.columns}x${stream.rows}`);

          // Create blessed screen
          console.log('Creating blessed screen...');
          
          // Wrap the stream to intercept writes
          const originalWrite = stream.write.bind(stream);
          let writeCount = 0;
          stream.write = function(data, ...args) {
            writeCount++;
            const preview = data ? data.toString().slice(0, 100).replace(/\x1b/g, '\\x1b') : 'undefined';
            console.log(`Stream write #${writeCount}, length: ${data?.length || 0}`);
            console.log(`  Content preview: ${preview}`);
            return originalWrite(data, ...args);
          };
          
          const screen = blessed.screen({
            smartCSR: false,  // CRITICAL: Disable smart rendering - force full redraws
            input: stream,
            output: stream,
            terminal: 'xterm-256color',
            fullUnicode: true,
            autoPadding: true,
            warnings: true,
            sendFocus: true,
            useBCE: true,
            rows: ptyInfo?.rows || 24,  // CRITICAL: Set terminal size
            cols: ptyInfo?.cols || 80
          });
          console.log('✓ Blessed screen created');
          console.log(`  Screen size: ${screen.width}x${screen.height}`);
          
          // Force initial render
          console.log('✓ Forced initial render');

          // Create a simple box
          const box = blessed.box({
            parent: screen,
            top: 'center',
            left: 'center',
            width: '50%',
            height: '50%',
            content: '{center}{bold}Hello from Blessed!{/bold}\n\nPress q to quit{/center}',
            tags: true,
            border: {
              type: 'line'
            },
            style: {
              border: {
                fg: 'cyan'
              }
            }
          });
          console.log('✓ Box created');

          screen.key(['q', 'C-c'], () => {
            console.log('✓ Quit key pressed');
            screen.destroy();
            stream.end();
          });

          console.log('Rendering screen...');
          screen.render();
          console.log('✓ Screen rendered');
          
          // Force stream flush
          if (stream.flush) stream.flush();
          console.log('✓ Stream flushed (if supported)');

          box.focus();
          console.log('✓ Box focused');
          
          // Render again to ensure focus is visible
          screen.render();
          console.log('✓ Rendered again after focus');

        } catch (error) {
          console.error('✗ Error:', error);
          stream.write(`Error: ${error.message}\r\n`);
          stream.end();
        }

        stream.on('close', () => {
          console.log('✓ Stream closed');
        });

        stream.on('error', (err) => {
          console.error('✗ Stream error:', err);
        });
      });
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✓ Test server listening on port ${PORT}`);
  console.log(`  Connect with: ssh localhost -p ${PORT}`);
  console.log(`  Press Ctrl+C to stop\n`);
});
