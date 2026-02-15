import { generateKeyPairSync } from 'crypto';
import fs from 'fs';
import path from 'path';

const keysDir = path.join(process.cwd(), 'keys');

if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

console.log('Generating SSH host keys...');

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: {
    type: 'pkcs1',
    format: 'pem'
  }
});

fs.writeFileSync(path.join(keysDir, 'host_key'), privateKey);
fs.chmodSync(path.join(keysDir, 'host_key'), 0o600);

console.log('✓ Host key generated at keys/host_key');
