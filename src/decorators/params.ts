import 'reflect-metadata';
import { ROUTE_PARAMS_METADATA } from '../tokens.js';
import { RouteParamDefinition, RouteParamSource } from '../types.js';

function createParamDecorator(
  source: RouteParamSource,
  name?: string,
): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    if (propertyKey === undefined) {
      return;
    }

    const params: RouteParamDefinition[] =
      Reflect.getOwnMetadata(ROUTE_PARAMS_METADATA, target, propertyKey) ?? [];

    const definition: RouteParamDefinition = {
      index: parameterIndex,
      source,
      ...(name === undefined ? {} : { name }),
    };

    const definitions = [...params, definition].sort(
      (left, right) => left.index - right.index,
    );

    Reflect.defineMetadata(
      ROUTE_PARAMS_METADATA,
      definitions,
      target,
      propertyKey,
    );
  };
}

export function Body(): ParameterDecorator {
  return createParamDecorator('body');
}

export function Param(name: string): ParameterDecorator {
  return createParamDecorator('param', name);
}

export function Query(name: string): ParameterDecorator {
  return createParamDecorator('query', name);
}
