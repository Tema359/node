import 'reflect-metadata';
import {
  CONTROLLER_PREFIX_METADATA,
  INJECTABLE,
  REQUEST_METHOD_METADATA,
  ROUTE_PATH_METADATA,
  ROUTES_METADATA,
} from '../tokens.js';
import { RequestMethod, RouteDefinition } from '../types.js';

function joinPaths(prefix: string, path: string): string {
  const parts = [prefix, path]
    .flatMap((part) => part.split('/'))
    .filter(Boolean);

  return `/${parts.join('/')}`;
}

export function Controller(prefix: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(INJECTABLE, true, target);
    Reflect.defineMetadata(CONTROLLER_PREFIX_METADATA, prefix, target);

    const routes: RouteDefinition[] = Object.getOwnPropertyNames(
      target.prototype,
    ).flatMap((handlerName) => {
      if (handlerName === 'constructor') {
        return [];
      }

      const handler = target.prototype[handlerName] as Function;
      const method = Reflect.getMetadata(
        REQUEST_METHOD_METADATA,
        handler,
      ) as RequestMethod | undefined;

      if (!method) {
        return [];
      }

      const path = (Reflect.getMetadata(ROUTE_PATH_METADATA, handler) ??
        '') as string;

      return [{ method, path: joinPaths(prefix, path), handlerName }];
    });

    Reflect.defineMetadata(ROUTES_METADATA, routes, target);
  };
}

export function getControllerRoutes(target: Function): RouteDefinition[] {
  return Reflect.getMetadata(ROUTES_METADATA, target) ?? [];
}
