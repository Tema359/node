import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Container, container as defaultContainer } from './container.js';
import { requestContext } from './context/request-context.js';
import { AuthGuard } from './guards/auth.guard.js';
import {
  ExceptionFilter,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
} from './filters/exception.filter.js';
import {
  Interceptor,
  LoggingInterceptor,
} from './interceptors/logging.interceptor.js';
import { ValidationError, ZodValidationPipe } from './pipes/zod-validation.pipe.js';
import { Router } from './router.js';
import { ROUTE_PARAMS_METADATA } from './tokens.js';
import { Constructor, RouteParamDefinition } from './types.js';

type ControllerInstance = Record<PropertyKey, unknown>;
export type LifecycleStage =
  | 'middleware'
  | 'guard'
  | 'interceptor:before'
  | 'pipe'
  | 'handler'
  | 'interceptor:after';
export type LifecycleObserver = (stage: LifecycleStage) => void;

export const MAX_JSON_BODY_SIZE = 100 * 1024;

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

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ValidationError([
        { field: 'body', reasons: ['Invalid JSON body'] },
      ]);
    }

    throw error;
  }
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

function getRequestId(request: IncomingMessage): string {
  const header = request.headers?.['x-request-id'];
  const value = Array.isArray(header) ? header[0] : header;

  return value?.trim() || randomUUID();
}

export class Dispatcher {
  private readonly router = new Router();
  private readonly container: Container;
  private readonly validationPipe = new ZodValidationPipe();
  private readonly authGuard = new AuthGuard();
  private readonly interceptors: Interceptor[] = [new LoggingInterceptor()];
  private readonly exceptionFilter = new ExceptionFilter();
  private readonly observeLifecycle: LifecycleObserver;

  constructor(
    controllers?: Constructor[],
    container?: Container,
    observeLifecycle?: LifecycleObserver,
  );
  constructor(
    container?: Container,
    controllers?: Constructor[],
    observeLifecycle?: LifecycleObserver,
  );
  constructor(
    controllersOrContainer: Constructor[] | Container = [],
    containerOrControllers: Container | Constructor[] = defaultContainer,
    observeLifecycle: LifecycleObserver = () => {},
  ) {
    this.observeLifecycle = observeLifecycle;

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

  registerInterceptor(interceptor: Interceptor): this {
    this.interceptors.push(interceptor);
    return this;
  }

  readonly handle = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    this.observeLifecycle('middleware');
    const requestId = getRequestId(request);
    response.setHeader('x-request-id', requestId);

    await requestContext.run(requestId, () =>
      this.dispatch(request, response),
    );
  };

  private async dispatch(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const routeMatch = this.router.find(request.method, url.pathname);

      if (!routeMatch) {
        throw new NotFoundError(
          `Route ${request.method ?? 'UNKNOWN'} ${url.pathname} not found`,
        );
      }

      this.observeLifecycle('guard');
      if (!this.authGuard.canActivate(request)) {
        throw new ForbiddenError();
      }

      const { route, params: pathParams } = routeMatch;
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
      const controller = this.container.resolve(
        route.controller,
      ) as ControllerInstance;
      const handler = controller[route.handlerName];

      if (typeof handler !== 'function') {
        throw new Error(`Controller handler ${String(route.handlerName)} is missing`);
      }

      const invokeHandler = async (): Promise<unknown> => {
          const body = await readJsonBody(request);
          const args: unknown[] = [];

          for (const definition of definitions) {
            if (definition.source === 'body') {
              if (route.bodySchema) {
                this.observeLifecycle('pipe');
                args[definition.index] = this.validationPipe.transform(
                  body,
                  route.bodySchema,
                  parameterTypes[definition.index],
                );
              } else {
                args[definition.index] = body;
              }
            } else if (definition.source === 'param') {
              args[definition.index] = pathParams[definition.name ?? ''];
            } else {
              args[definition.index] = url.searchParams.get(
                definition.name ?? '',
              ) ?? undefined;
            }
          }

          this.observeLifecycle('handler');
          return handler.apply(controller, args);
      };
      const interceptorChain = this.interceptors.reduceRight<
        () => Promise<unknown>
      >(
        (next, interceptor) => () => interceptor.intercept(request, next),
        invokeHandler,
      );
      this.observeLifecycle('interceptor:before');

      let result: unknown;
      try {
        result = await interceptorChain();
      } finally {
        this.observeLifecycle('interceptor:after');
      }

      sendJson(response, 200, result);
    } catch (error) {
      this.exceptionFilter.catch(error, response);
    }
  }

}

export function createDispatcher(
  controllers: Constructor[],
  container: Container = defaultContainer,
): Dispatcher['handle'] {
  return new Dispatcher(controllers, container).handle;
}
