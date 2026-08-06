const net = require('node:net');
const { parseRequest, serialize, handle } = require('./utils');

const PORT = 3000;

net
  .createServer((socket) => {
    let buf = '';
    socket.on('data', (chunk) => {
      buf += chunk.toString('latin1');
      const req = parseRequest(buf);
      if (!req) return;
      socket.write(serialize(handle(req)));
      socket.end();
    });
  })
  .listen(PORT, () => console.log(`Server is running on port: ${PORT}`));
