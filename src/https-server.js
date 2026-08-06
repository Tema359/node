const tls = require('node:tls');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseRequest, handle, serialize } = require('./utils');

const PORT = 3443;

const certDir = path.join(__dirname, '..', '/src');
const certPath = path.join(certDir, 'cert.pem');
const keyPath = path.join(certDir, 'key.pem');

function ensureCertificate() {
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return;
  }

  fs.mkdirSync(certDir, { recursive: true });

  console.log(
    'TLS certificate not found — creating a self-signed certificate...',
  );

  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '365',
    ],
    {
      stdio: 'inherit',
    },
  );
}

ensureCertificate();

const tlsOptions = {
  key: fs.readFileSync(path.join(certDir, 'key.pem')),
  cert: fs.readFileSync(path.join(certDir, 'cert.pem')),
};

tls
  .createServer(tlsOptions, (socket) => {
    let buf = '';
    socket.on('data', (chunk) => {
      buf += chunk.toString('latin1');
      for (;;) {
        const req = parseRequest(buf);
        if (!req) break;
        buf = buf.slice(req.consumed);
        const out = handle(req);
        console.log(`  ${req.method} ${req.path} → ${out.status}`);
        socket.write(serialize(handle(req)));
      }
    });
    socket.on('error', (e) => console.log(`  сокет: ${e.code}`));
  })
  .listen(PORT, () => console.log(`Server is running on port: ${PORT}`));
