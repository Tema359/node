import 'reflect-metadata';
import { INJECTABLE, SCOPE_METADATA } from '../tokens.js';
import { InjectableOptions, Scope } from '../types.js';

export function Injectable(options: InjectableOptions = {}): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(INJECTABLE, true, target);

    Reflect.defineMetadata(
      SCOPE_METADATA,
      options.scope ?? 'singleton',
      target,
    );
  };
}

export function getScope(target: Function): Scope {
  return Reflect.getMetadata(SCOPE_METADATA, target) ?? 'singleton';
}
