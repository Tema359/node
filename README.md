## Launch

Run tests

```bash
docker compose run --rm api npm test
```

Build and start the application:

```bash
docker compose up -d
docker compose ps
```

Follow the application logs and stop the containers:

```bash
docker compose logs -f app
docker compose down
```

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

## How the IoC container works

When a class has a decorator, TypeScript can emit its constructor parameter types as `design:paramtypes` metadata. The container reads this metadata with `Reflect.getMetadata('design:paramtypes', Target)` and recursively resolves each constructor dependency. This metadata is generated only when `emitDecoratorMetadata` (together with `experimentalDecorators`) is enabled in `tsconfig.json`; without it, the parameter types do not exist at runtime, so the container cannot discover the dependency graph automatically.

## How a parameter decorator knows where to inject a value

TypeScript passes a `parameterIndex` to every parameter decorator. This index identifies the argument's position in the method signature. For example, in `find(@Param('id') id, @Query('view') view)`, the decorators receive the indexes `0` and `1`. `@Param`, `@Query`, and `@Body` do not read the HTTP request themselves. Instead, they store the argument index, value source, and optional name in the method's metadata. When handling a request, the dispatcher reads this metadata, creates an `args` array, assigns each extracted value to `args[parameterIndex]`, and invokes the controller method with `handler.apply(controller, args)`. This is how each value reaches the parameter carrying the corresponding decorator.

## Certificate generation command

```bash
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout key.pem \
  -out cert.pem \
  -days 365 \
  -subj \
  CN=localhost
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

## Docker image size comparison

```text
REPOSITORY   TAG            SIZE
hw-05        multi-stage    358MB
hw-05        single-stage   381MB
```

The final multi-stage image is **23 MB smaller** because its `runner` stage contains only production dependencies and the compiled `dist` artifact, while development dependencies and source files remain in the `builder` stage.

## Verifying PostgreSQL data persistence

PostgreSQL stores its data in the named `pgdata` volume. The following commands
were used to create a table, stop and remove the containers, start PostgreSQL
again, and verify that the table still exists:

```bash
docker compose up -d --wait db
docker compose exec -T db psql -U app -d app -c \
  'CREATE TABLE IF NOT EXISTS persistence_check (id integer PRIMARY KEY);'
docker compose down
docker compose up -d --wait db
docker compose exec -T db psql -U app -d app -c '\dt persistence_check'
```

The final command must list the `persistence_check` table. Do not add the `-v`
option to `docker compose down`, because `down -v` removes the named volume and
its PostgreSQL data.
