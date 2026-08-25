import 'reflect-metadata';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Container, container as defaultContainer } from './container.js';
import {
  DtoValidationError,
  ValidationPipe,
} from './pipes/validation.pipe.js';
import { Router } from './router.js';
import { ROUTE_PARAMS_METADATA } from './tokens.js';
import { Constructor, RouteParamDefinition } from './types.js';

type ControllerInstance = Record<PropertyKey, unknown>;

export const MAX_JSON_BODY_SIZE = 100 * 1024;

class PayloadTooLargeError extends Error {
  constructor() {
    super('Request body is too large');
    this.name = 'PayloadTooLargeError';
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentLength = Number(request.headers?.['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_SIZE) {
    throw new PayloadTooLargeError();
  }

  const chunks: Buffer[] = [];
  let receivedBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    receivedBytes += buffer.length;

    if (receivedBytes > MAX_JSON_BODY_SIZE) {
      throw new PayloadTooLargeError();
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  value: unknown,
): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(value));
}

export class Dispatcher {
  private readonly router = new Router();
  private readonly container: Container;
  private readonly validationPipe = new ValidationPipe();

  constructor(controllers?: Constructor[], container?: Container);
  constructor(container?: Container, controllers?: Constructor[]);
  constructor(
    controllersOrContainer: Constructor[] | Container = [],
    containerOrControllers: Container | Constructor[] = defaultContainer,
  ) {
    if (controllersOrContainer instanceof Container) {
      this.container = controllersOrContainer;
      this.registerControllers(
        Array.isArray(containerOrControllers) ? containerOrControllers : [],
      );
      return;
    }

    this.container =
      containerOrControllers instanceof Container
        ? containerOrControllers
        : defaultContainer;
    this.registerControllers(controllersOrContainer);
  }

  registerController(controller: Constructor): this {
    this.router.registerController(controller);
    return this;
  }

  registerControllers(controllers: Constructor[]): this {
    for (const controller of controllers) {
      this.registerController(controller);
    }

    return this;
  }

  readonly handle = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const routeMatch = this.router.find(request.method, url.pathname);

      if (!routeMatch) {
        sendJson(response, 404, { error: 'Not Found' });
        return;
      }

      const { route, params: pathParams } = routeMatch;
      const body = await readJsonBody(request);
      const definitions: RouteParamDefinition[] =
        Reflect.getOwnMetadata(
          ROUTE_PARAMS_METADATA,
          route.controller.prototype,
          route.handlerName,
        ) ?? [];
      const parameterTypes = (Reflect.getMetadata(
        'design:paramtypes',
        route.controller.prototype,
        route.handlerName,
      ) ?? []) as Constructor[];
      const args: unknown[] = [];

      for (const definition of definitions) {
        if (definition.source === 'body') {
          const metatype = parameterTypes[definition.index];
          args[definition.index] = this.shouldValidate(metatype)
            ? this.validationPipe.transform(body, metatype)
            : body;
        } else if (definition.source === 'param') {
          args[definition.index] = pathParams[definition.name ?? ''];
        } else {
          args[definition.index] = url.searchParams.get(
            definition.name ?? '',
          ) ?? undefined;
        }
      }

      const controller = this.container.resolve(
        route.controller,
      ) as ControllerInstance;
      const handler = controller[route.handlerName];

      if (typeof handler !== 'function') {
        throw new Error(`Controller handler ${String(route.handlerName)} is missing`);
      }

      const result = await handler.apply(controller, args);
      sendJson(response, 200, result);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        sendJson(response, 413, { error: 'Payload Too Large' });
        return;
      }

      if (error instanceof DtoValidationError) {
        sendJson(response, 400, {
          error: 'Validation failed',
          fields: error.issues,
        });
        return;
      }

      if (error instanceof SyntaxError) {
        sendJson(response, 400, { error: 'Invalid JSON body' });
        return;
      }

      console.error('Unhandled request error:', error);
      sendJson(response, 500, { error: 'Internal Server Error' });
    }
  };

  private shouldValidate(metatype: Constructor | undefined): metatype is Constructor {
    const builtInTypes: Function[] = [Object, String, Number, Boolean, Array];
    return Boolean(metatype && !builtInTypes.includes(metatype));
  }

}

export function createDispatcher(
  controllers: Constructor[],
  container: Container = defaultContainer,
): Dispatcher['handle'] {
  return new Dispatcher(controllers, container).handle;
}
