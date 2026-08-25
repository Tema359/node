import 'reflect-metadata';
import { REQUEST_METHOD_METADATA, ROUTE_PATH_METADATA } from '../tokens.js';
import { RequestMethod } from '../types.js';

function createRouteDecorator(
  method: RequestMethod,
): (path?: string) => MethodDecorator {
  return (path = '') => (_target, _propertyKey, descriptor) => {
    if (!descriptor?.value) {
      return;
    }

    Reflect.defineMetadata(REQUEST_METHOD_METADATA, method, descriptor.value);
    Reflect.defineMetadata(ROUTE_PATH_METADATA, path, descriptor.value);
  };
}

export const Get = createRouteDecorator('GET');
export const Post = createRouteDecorator('POST');
