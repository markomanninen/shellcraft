import fs from 'fs';
import ssh2 from 'ssh2';

const { Server } = ssh2;

const PORT = 2223; // Different port to not conflict
const HOST_KEY = fs.readFileSync('./keys/host_key');

console.log('TEST 1: Basic SSH server with raw text output');
console.log('='.repeat(50));

const server = new Server({
  hostKeys: [HOST_KEY]
}, (client) => {
  console.log('✓ Client connected');

  client.on('authentication', (ctx) => {
    console.log('✓ Authentication attempt:', ctx.method);
    ctx.accept();
  });

  client.on('ready', () => {
    console.log('✓ Client ready');

    client.on('session', (accept) => {
      const session = accept();
      console.log('✓ Session created');

      session.once('pty', (accept) => {
        console.log('✓ PTY requested');
        accept && accept();
      });

      session.once('shell', (accept) => {
        const stream = accept();
        console.log('✓ Shell started');

        // TEST: Just write plain text
        stream.write('Hello from SSH server!\r\n');
        stream.write('This is a test.\r\n');
        stream.write('If you see this, basic SSH streaming works.\r\n');
        stream.write('\r\n');
        stream.write('Type "exit" to disconnect.\r\n');
        stream.write('> ');

        stream.on('data', (data) => {
          const input = data.toString().trim();
          console.log('Received input:', input);
          
          if (input === 'exit') {
            stream.write('\r\nGoodbye!\r\n');
            stream.end();
          } else {
            stream.write(`\r\nYou typed: ${input}\r\n> `);
          }
        });

        stream.on('close', () => {
          console.log('✓ Stream closed');
        });
      });
    });
  });

  client.on('error', (err) => {
    console.error('✗ Client error:', err.message);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✓ Test server listening on port ${PORT}`);
  console.log(`  Connect with: ssh localhost -p ${PORT}`);
  console.log(`  Press Ctrl+C to stop\n`);
});

server.on('error', (err) => {
  console.error('✗ Server error:', err);
});
