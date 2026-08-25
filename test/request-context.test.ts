import 'reflect-metadata';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { Container } from '../src/container.js';
import { Controller } from '../src/decorators/controller.js';
import { Injectable } from '../src/decorators/injectable.js';
import { Get } from '../src/decorators/methods.js';
import { Dispatcher } from '../src/dispatcher.js';
import { RequestIdReaderService } from '../src/services/request-id-reader.service.js';

describe('request context isolation', () => {
  it('keeps ten concurrent request ids isolated two service levels deep', async () => {
    @Injectable()
    class ContextFacade {
      constructor(private readonly reader: RequestIdReaderService) {}

      read() {
        return this.reader.read();
      }
    }

    @Controller('/context')
    class ContextController {
      constructor(private readonly facade: ContextFacade) {}

      @Get()
      async read() {
        return { value: await this.facade.read() };
      }
    }

    const logs: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((message) => {
      logs.push(String(message));
    });
    const dispatcher = new Dispatcher([ContextController], new Container());

    async function call(value: string) {
      const request = Readable.from([]);
      Object.assign(request, {
        method: 'GET',
        url: '/context',
        headers: {
          authorization: 'Bearer test-token',
          'x-request-id': value,
        },
      });
      const headers = new Map<string, string>();
      let payload = '';
      const response = {
        statusCode: 200,
        setHeader(name: string, headerValue: string) {
          headers.set(name.toLowerCase(), headerValue);
        },
        end(chunk?: string) {
          payload = chunk ?? '';
        },
      };

      await dispatcher.handle(
        request as IncomingMessage,
        response as unknown as ServerResponse,
      );

      return {
        sent: value,
        returned: headers.get('x-request-id'),
        body: JSON.parse(payload) as { value: string },
      };
    }

    try {
      const ids = Array.from({ length: 10 }, (_, index) => `request-${index}`);
      const results = await Promise.all(ids.map(call));

      for (const result of results) {
        expect(result.returned).toBe(result.sent);
        expect(result.body.value).toBe(result.sent);
        expect(logs).toContain(`request-id: ${result.sent}`);
      }
    } finally {
      log.mockRestore();
    }
  });
});
