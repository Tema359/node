import 'reflect-metadata';
import { INJECT_TOKENS, INJECTABLE, SCOPE_METADATA } from './tokens.js';
import { Constructor, InjectionToken, Provider, Scope } from './types.js';

export class Container {
  private readonly singletons = new Map<InjectionToken, unknown>();
  private readonly providers = new Map<InjectionToken, Provider>();

  registerClass<T>(token: InjectionToken<T>, target: Constructor<T>): void {
    this.providers.set(token, { useClass: target });
  }

  registerValue<T>(token: InjectionToken<T>, value: T): void {
    this.providers.set(token, { useValue: value });
  }

  resolve<T>(token: InjectionToken<T>, path: InjectionToken[] = []): T {
    if (path.includes(token)) {
      const chain = [...path, token]
        .map((item) => (typeof item === 'function' ? item.name : String(item)))
        .join(' -> ');

      throw new Error(`Circular dependency detected: ${chain}`);
    }

    if (this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    const provider = this.providers.get(token);

    if (provider && 'useValue' in provider) {
      return provider.useValue as T;
    }

    const target =
      provider && 'useClass' in provider
        ? provider.useClass
        : typeof token === 'function'
          ? token
          : undefined;

    if (!target) {
      throw new Error(
        `Provider for token ${String(token)} is not registered`,
      );
    }

    if (!Reflect.getMetadata(INJECTABLE, target)) {
      throw new Error(`${target.name} not mark as @Injectable()`);
    }

    const paramTypes: Constructor[] =
      Reflect.getMetadata('design:paramtypes', target) ?? [];

    const injectedTokens: Map<number, InjectionToken> =
      Reflect.getOwnMetadata(INJECT_TOKENS, target) ?? new Map();

    const nextPath = [...path, token];

    const dependencies = paramTypes.map((paramType, index) => {
      const dependencyToken = injectedTokens.get(index) ?? paramType;

      return this.resolve(dependencyToken, nextPath);
    });

    const instance = new target(...dependencies);

    const scope: Scope =
      Reflect.getMetadata(SCOPE_METADATA, target) ?? 'singleton';

    if (scope === 'singleton') {
      this.singletons.set(token, instance);
    }

    return instance as T;
  }
}

export const container = new Container();
