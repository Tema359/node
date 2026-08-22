import 'reflect-metadata';
import { INJECT_TOKENS } from '../tokens.js';
import { InjectionToken } from '../types.js';

export function Inject(token: InjectionToken): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    const tokens: Map<number, InjectionToken> =
      Reflect.getOwnMetadata(INJECT_TOKENS, target) ?? new Map();

    tokens.set(parameterIndex, token);

    Reflect.defineMetadata(INJECT_TOKENS, tokens, target);
  };
}
