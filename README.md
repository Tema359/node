## Launch

HTTP-server:

```bash
node src/server.js
```

The server is available at `http://localhost:3000`.

HTTPS-server:

```bash
node src/https-server.js
```

The server is available at `https://localhost:3443`. When you run it for the first time, a self-signed certificate and a private key are automatically created in the `/src` directory;

## Certificate generation command

```bash
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout key.pem \
  -out cert.pem \
  -days 365
```

```
key.pem   # Private key
cert.pem  # Self-signed certificate
```

## Verifying the TLS Connection

```bash
openssl s_client -connect localhost:3443 -servername localhost
```

```text
CONNECTED(00000005)
verify error:num=18:self signed certificate
verify return:1
---
No client certificate CA names sent
Server Temp Key: ECDH, X25519, 253 bits
---
SSL handshake has read 1290 bytes and written 367 bytes
---
New, TLSv1/SSLv3, Cipher is AEAD-AES256-GCM-SHA384
Server public key is 2048 bit
Secure Renegotiation IS NOT supported
Compression: NONE
Expansion: NONE
No ALPN negotiated
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : AEAD-AES256-GCM-SHA384
    Session-ID:
    Session-ID-ctx:
    Master-Key:
    Start Time: 1785998454
    Timeout   : 7200 (sec)
    Verify return code: 18 (self signed certificate)
---
verify return code 18 indicates that the security certificate that is signed by the same person or organization that made it, rather than by an independent third party called a Certificate Authority (CA)
```
