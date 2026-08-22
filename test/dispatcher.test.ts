import 'reflect-metadata';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { Container } from '../src/container.js';
import { Controller } from '../src/decorators/controller.js';
import { Injectable } from '../src/decorators/injectable.js';
import { Get, Post } from '../src/decorators/methods.js';
import { Body, Param, Query } from '../src/decorators/params.js';
import { Dispatcher } from '../src/dispatcher.js';

interface TestResponse {
  status: number;
  body: unknown;
}

describe('Dispatcher', () => {
  async function call(
    dispatcher: Dispatcher,
    path: string,
    method = 'GET',
    body?: unknown,
  ): Promise<TestResponse> {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const incoming = Readable.from(payload === undefined ? [] : [payload]);
    Object.assign(incoming, { method, url: path });

    let responseBody = '';
    const outgoing = {
      statusCode: 200,
      setHeader() {},
      end(chunk?: string) {
        responseBody = chunk ?? '';
      },
    };

    await dispatcher.handle(
      incoming as IncomingMessage,
      outgoing as unknown as ServerResponse,
    );

    return {
      status: outgoing.statusCode,
      body: responseBody ? JSON.parse(responseBody) : undefined,
    };
  }

  it('matches a route, builds arguments and resolves the controller via DI', async () => {
    @Injectable()
    class UsersService {
      update(id: string, body: unknown, view: string | undefined) {
        return { id, body, view, fromService: true };
      }
    }

    @Controller('/users')
    class UsersController {
      constructor(readonly users: UsersService) {}

      @Get()
      findAll(@Query('limit') limit: string | undefined) {
        return { limit };
      }

      @Get('/:id')
      findOne(@Param('id') id: string) {
        return { id };
      }

      @Post('/:id')
      update(
        @Param('id') id: string,
        @Body() body: unknown,
        @Query('view') view: string | undefined,
      ) {
        return this.users.update(id, body, view);
      }
    }

    const container = new Container();
    const dispatcher = new Dispatcher([UsersController], container);
    const response = await call(
      dispatcher,
      '/users/a%20b?view=full',
      'POST',
      { name: 'Ada' },
    );

    expect(response).toEqual({
      status: 200,
      body: {
        id: 'a b',
        body: { name: 'Ada' },
        view: 'full',
        fromService: true,
      },
    });
    expect(await call(dispatcher, '/users/42')).toEqual({
      status: 200,
      body: { id: '42' },
    });
    expect(await call(dispatcher, '/users?limit=5')).toEqual({
      status: 200,
      body: { limit: '5' },
    });

    const controller = container.resolve(UsersController);
    expect(controller.users).toBe(container.resolve(UsersService));
    expect(container.resolve(UsersService)).toBe(container.resolve(UsersService));
  });

  it('awaits async handlers and returns 404 for an unknown route', async () => {
    @Controller('/health')
    class HealthController {
      @Get()
      async check() {
        return { ok: true };
      }
    }

    const dispatcher = new Dispatcher(new Container(), [HealthController]);

    expect(await call(dispatcher, '/health')).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(await call(dispatcher, '/missing')).toEqual({
      status: 404,
      body: { error: 'Not Found' },
    });
  });
});
