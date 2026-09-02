// 生成本地开发用自签证书（SAN: portal.naominet.live / localhost / 127.0.0.1）。
// 首次使用后需将 crt 导入 Windows 用户信任库：
//   certutil -addstore -user Root ssl\portal.naominet.live.crt
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { generate } from 'selfsigned';

const dir = path.resolve(process.cwd(), 'ssl');
mkdirSync(dir, { recursive: true });

const crtPath = path.join(dir, 'portal.naominet.live.crt');
const keyPath = path.join(dir, 'portal.naominet.live.key');

const pems = await generate([{ name: 'commonName', value: 'portal.naominet.live' }], {
  days: 3650,
  keySize: 2048,
  extensions: [
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'portal.naominet.live' },
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' },
      ],
    },
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
  ],
});

if (!pems?.cert || !pems?.private) {
  console.error('cert generation failed:', Object.keys(pems ?? {}));
  process.exit(1);
}

writeFileSync(crtPath, pems.cert + '\n');
writeFileSync(keyPath, pems.private + '\n');

if (!readFileSync(crtPath, 'utf8').startsWith('-----BEGIN CERTIFICATE-----')) {
  console.error('cert file malformed');
  process.exit(1);
}
console.log(`written: ${crtPath}`);
console.log(`         ${keyPath}`);
