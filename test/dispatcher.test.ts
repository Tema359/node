import 'reflect-metadata';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { Container } from '../src/container.js';
import { requestContext } from '../src/context/request-context.js';
import { Controller } from '../src/decorators/controller.js';
import { Injectable } from '../src/decorators/injectable.js';
import { Get, Post } from '../src/decorators/methods.js';
import { Body, Param, Query } from '../src/decorators/params.js';
import { UseBodySchema } from '../src/decorators/schema.js';
import { Dispatcher, MAX_JSON_BODY_SIZE } from '../src/dispatcher.js';
import { CreateUserDto } from '../src/dto/create-user.dto.js';
import { Interceptor } from '../src/interceptors/logging.interceptor.js';

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
    authorized = true,
  ): Promise<TestResponse> {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const incoming = Readable.from(payload === undefined ? [] : [payload]);
    Object.assign(incoming, {
      method,
      url: path,
      headers: authorized ? { authorization: 'Bearer test-token' } : {},
    });

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
      body: { error: 'Route GET /missing not found' },
    });
  });

  it('logs an unhandled controller error before returning 500', async () => {
    const handlerError = new Error('boom');

    @Controller('/failure')
    class FailingController {
      @Get()
      fail() {
        throw handlerError;
      }
    }

    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(
        await call(new Dispatcher([FailingController]), '/failure'),
      ).toEqual({
        status: 500,
        body: { error: 'Internal Server Error' },
      });
      expect(errorLog).toHaveBeenCalledWith(
        'Unhandled request error:',
        handlerError,
      );
      const response = await call(new Dispatcher([FailingController]), '/failure');
      expect(JSON.stringify(response.body)).not.toMatch(/boom|at .*\.ts:/);
    } finally {
      errorLog.mockRestore();
    }
  });

  it('maps a domain NotFoundError to a meaningful 404 response', async () => {
    const { NotFoundError } = await import(
      '../src/filters/exception.filter.js'
    );

    @Controller('/records')
    class RecordsController {
      @Get('/:id')
      findOne(@Param('id') id: string) {
        throw new NotFoundError(`Record ${id} does not exist`);
      }
    }

    expect(await call(new Dispatcher([RecordsController]), '/records/42')).toEqual({
      status: 404,
      body: { error: 'Record 42 does not exist' },
    });
  });

  it('returns 413 when the JSON body exceeds the size limit', async () => {
    @Controller('/upload')
    class UploadController {
      @Post()
      upload(@Body() body: unknown) {
        return body;
      }
    }

    const response = await call(
      new Dispatcher([UploadController]),
      '/upload',
      'POST',
      { data: 'x'.repeat(MAX_JSON_BODY_SIZE) },
    );

    expect(response).toEqual({
      status: 413,
      body: { error: 'Payload Too Large' },
    });
  });

  it('runs AuthGuard before validation and the controller handler', async () => {
    let handlerCalled = false;

    @Controller('/protected')
    class ProtectedController {
      @Post()
      @UseBodySchema(CreateUserDto.schema)
      create(@Body() _body: CreateUserDto) {
        handlerCalled = true;
        return { ok: true };
      }
    }

    const response = await call(
      new Dispatcher([ProtectedController]),
      '/protected',
      'POST',
      { name: '', email: 'not-an-email' },
      false,
    );

    expect(response).toEqual({
      status: 403,
      body: { error: 'Forbidden' },
    });
    expect(handlerCalled).toBe(false);
  });

  it('makes request-id available deep in the async stack and returns it', async () => {
    @Injectable()
    class RequestAwareService {
      async getRequestId() {
        await Promise.resolve();
        return requestContext.getRequestId();
      }
    }

    @Controller('/context')
    class ContextController {
      constructor(private readonly service: RequestAwareService) {}

      @Get()
      async read() {
        return { requestId: await this.service.getRequestId() };
      }
    }

    const incoming = Readable.from([]);
    Object.assign(incoming, {
      method: 'GET',
      url: '/context',
      headers: {
        authorization: 'Bearer test-token',
        'x-request-id': 'request-from-client',
      },
    });
    const headers = new Map<string, string>();
    let responseBody = '';
    const outgoing = {
      statusCode: 200,
      setHeader(name: string, value: string) {
        headers.set(name.toLowerCase(), value);
      },
      end(chunk?: string) {
        responseBody = chunk ?? '';
      },
    };

    await new Dispatcher([ContextController]).handle(
      incoming as IncomingMessage,
      outgoing as unknown as ServerResponse,
    );

    expect(JSON.parse(responseBody)).toEqual({
      requestId: 'request-from-client',
    });
    expect(headers.get('x-request-id')).toBe('request-from-client');
  });

  it('runs the request lifecycle in the required order', async () => {
    const stages: string[] = [];

    @Controller('/order')
    class OrderController {
      @Post()
      @UseBodySchema(CreateUserDto.schema)
      create(@Body() _dto: CreateUserDto) {
        return { ok: true };
      }
    }

    const dispatcher = new Dispatcher(
      [OrderController],
      new Container(),
      (stage) => stages.push(stage),
    );

    expect(
      await call(dispatcher, '/order', 'POST', {
        name: 'Ada',
        email: 'ada@example.com',
      }),
    ).toEqual({ status: 200, body: { ok: true } });
    expect(stages).toEqual([
      'middleware',
      'guard',
      'interceptor:before',
      'pipe',
      'handler',
      'interceptor:after',
    ]);
  });

  it('includes reading the request body in interceptor duration', async () => {
    @Controller('/timed-body')
    class TimedBodyController {
      @Post()
      create(@Body() body: unknown) {
        return body;
      }
    }

    const request = new Readable({ read() {} });
    Object.assign(request, {
      method: 'POST',
      url: '/timed-body',
      headers: { authorization: 'Bearer test-token' },
    });
    setTimeout(() => {
      request.push('{"ok":true}');
      request.push(null);
    }, 25);

    let payload = '';
    const response = {
      statusCode: 200,
      setHeader() {},
      end(chunk?: string) {
        payload = chunk ?? '';
      },
    };
    const messages: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((message) => {
      messages.push(String(message));
    });

    try {
      await new Dispatcher([TimedBodyController]).handle(
        request as IncomingMessage,
        response as unknown as ServerResponse,
      );

      expect(JSON.parse(payload)).toEqual({ ok: true });
      const duration = Number(
        messages[0].match(/— ([0-9.]+) ms$/)?.[1] ?? 0,
      );
      expect(duration).toBeGreaterThanOrEqual(15);
    } finally {
      log.mockRestore();
    }
  });

  it('composes additional interceptors without changing dispatch', async () => {
    const events: string[] = [];
    const secondInterceptor: Interceptor = {
      async intercept(_request, next) {
        events.push('second:before');
        try {
          return await next();
        } finally {
          events.push('second:after');
        }
      },
    };

    @Controller('/interceptor-chain')
    class ChainController {
      @Get()
      run() {
        events.push('handler');
        return { ok: true };
      }
    }

    const dispatcher = new Dispatcher([ChainController]).registerInterceptor(
      secondInterceptor,
    );

    expect(await call(dispatcher, '/interceptor-chain')).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(events).toEqual(['second:before', 'handler', 'second:after']);
  });
});
