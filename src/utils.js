const REASON = {
  200: 'OK',
  304: 'Not Modified',
  404: 'Not Found',
};

function parseRequest(buf) {
  const headerEnd = buf.indexOf('\r\n\r\n');
  if (headerEnd === -1) return null;

  const [requestLine, ...headerLines] = buf.slice(0, headerEnd).split('\r\n');

  const [method, path, httpVersion] = requestLine.split(' ');

  const headers = Object.fromEntries(
    headerLines
      .map((line) => {
        const separatorIndex = line.indexOf(':');

        if (separatorIndex === -1) {
          return null;
        }

        return [
          line.slice(0, separatorIndex).toLowerCase(),
          line.slice(separatorIndex + 1).trim(),
        ];
      })
      .filter(Boolean),
  );

  return { method, path, httpVersion, headers, consumed: headerEnd + 4 };
}

function handle(req) {
  if (req.method === 'GET' && req.path === '/') {
    return {
      status: 200,
      type: 'text/plain; charset=utf-8',
      body: 'Hello from raw socket\n',
    };
  }

  if (req.method === 'GET' && req.path === '/headers') {
    return {
      status: 200,
      type: 'text/plain; charset=utf-8',
      body:
        Object.entries(req.headers)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n') + '\n',
    };
  }

  return {
    status: 404,
    type: 'text/plain; charset=utf-8',
    body: 'Not Found\n',
  };
}

function serialize({ status, type, body }, { keepAlive = false } = {}) {
  return (
    `HTTP/1.1 ${status} ${REASON[status]}\r\n` +
    `Content-Type: ${type}\r\n` +
    `Content-Length: ${Buffer.byteLength(body)}\r\n` +
    `Connection: ${keepAlive ? 'keep-alive' : 'close'}\r\n` +
    '\r\n' +
    body
  );
}

module.exports = {
  parseRequest,
  handle,
  serialize,
};
