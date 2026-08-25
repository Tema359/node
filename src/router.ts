import 'reflect-metadata';
import { getControllerRoutes } from './decorators/controller.js';
import { Constructor, RouteDefinition } from './types.js';

export interface RegisteredRoute extends RouteDefinition {
  controller: Constructor;
  pattern: RegExp;
  paramNames: string[];
}

export interface RouteMatch {
  route: RegisteredRoute;
  params: Record<string, string>;
}

function compilePath(
  path: string,
): Pick<RegisteredRoute, 'pattern' | 'paramNames'> {
  const paramNames: string[] = [];
  const segments = path.split('/').filter(Boolean);
  const routePatternSource = segments
    .map((segment) => {
      if (segment.startsWith(':')) {
        paramNames.push(segment.slice(1));
        return '([^/]+)';
      }

      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');

  return {
    pattern: new RegExp(`^/${routePatternSource}/?$`),
    paramNames,
  };
}

function compareRouteSpecificity(
  left: RegisteredRoute,
  right: RegisteredRoute,
): number {
  const leftSegments = left.path.split('/').filter(Boolean);
  const rightSegments = right.path.split('/').filter(Boolean);
  const sharedLength = Math.min(leftSegments.length, rightSegments.length);

  for (let index = 0; index < sharedLength; index += 1) {
    const leftIsParameter = leftSegments[index].startsWith(':');
    const rightIsParameter = rightSegments[index].startsWith(':');

    if (leftIsParameter !== rightIsParameter) {
      return leftIsParameter ? 1 : -1;
    }
  }

  return leftSegments.length - rightSegments.length;
}

export class Router {
  private readonly routes: RegisteredRoute[] = [];

  constructor(controllers: Constructor[] = []) {
    this.registerControllers(controllers);
  }

  registerController(controller: Constructor): this {
    for (const route of getControllerRoutes(controller)) {
      this.routes.push({
        ...route,
        controller,
        ...compilePath(route.path),
      });
    }

    this.routes.sort(compareRouteSpecificity);

    return this;
  }

  registerControllers(controllers: Constructor[]): this {
    for (const controller of controllers) {
      this.registerController(controller);
    }

    return this;
  }

  find(method: string | undefined, pathname: string): RouteMatch | undefined {
    for (const route of this.routes) {
      if (route.method !== method?.toUpperCase()) {
        continue;
      }

      const match = route.pattern.exec(pathname);
      if (!match) {
        continue;
      }

      const params = Object.fromEntries(
        route.paramNames.map((name, index) => [
          name,
          decodeURIComponent(match[index + 1]),
        ]),
      );

      return { route, params };
    }

    return undefined;
  }

  getRoutes(): readonly RegisteredRoute[] {
    return this.routes;
  }
}
