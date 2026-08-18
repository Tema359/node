import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Container } from '../src/container.js';
import { Inject } from '../src/decorators/inject.js';
import { Injectable } from '../src/decorators/injectable.js';

describe('Container', () => {
  it('resolves a simple dependency graph from design:paramtypes', () => {
    @Injectable()
    class C {}

    @Injectable()
    class B {
      constructor(readonly dependency: C) {}
    }

    @Injectable()
    class A {
      constructor(readonly dependency: B) {}
    }

    Reflect.defineMetadata('design:paramtypes', [C], B);
    Reflect.defineMetadata('design:paramtypes', [B], A);

    const result = new Container().resolve(A);

    expect(result).toBeInstanceOf(A);
    expect(result.dependency).toBeInstanceOf(B);
    expect(result.dependency.dependency).toBeInstanceOf(C);
  });

  it('returns the same instance for the singleton scope', () => {
    @Injectable()
    class SingletonService {}

    const container = new Container();

    expect(container.resolve(SingletonService)).toBe(
      container.resolve(SingletonService),
    );
  });

  it('returns a new instance for the transient scope', () => {
    @Injectable({ scope: 'transient' })
    class TransientService {}

    const container = new Container();

    expect(container.resolve(TransientService)).not.toBe(
      container.resolve(TransientService),
    );
  });

  it('reports the complete circular dependency chain', () => {
    @Injectable()
    class A {
      constructor(@Inject('B') readonly dependency: unknown) {}
    }

    @Injectable()
    class B {
      constructor(@Inject('A') readonly dependency: unknown) {}
    }

    Reflect.defineMetadata('design:paramtypes', [Object], A);
    Reflect.defineMetadata('design:paramtypes', [Object], B);

    const container = new Container();
    container.registerClass('A', A);
    container.registerClass('B', B);

    let thrown: unknown;

    try {
      container.resolve('A');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(RangeError);
    expect((thrown as Error).message).toMatch(/A -> B -> A/);
  });

  it('resolves an explicitly injected token', () => {
    const CONFIG = Symbol.for('CONFIG');
    const config = { port: 3000 };

    @Injectable()
    class Application {
      constructor(
        @Inject(CONFIG)
        readonly config: { port: number },
      ) {}
    }

    Reflect.defineMetadata('design:paramtypes', [Object], Application);

    const container = new Container();
    container.registerValue(CONFIG, config);

    const application = container.resolve(Application);

    expect(application.config).toBe(config);
  });

  it('rejects a class without @Injectable()', () => {
    class Service {}

    expect(() => new Container().resolve(Service)).toThrow(
      'Service not mark as @Injectable()',
    );
  });

  it('rejects an unregistered token', () => {
    expect(() => new Container().resolve('UNKNOWN')).toThrow(
      'Provider for token UNKNOWN is not registered',
    );
  });

  it('reuses a singleton dependency inside transient instances', () => {
    @Injectable()
    class Logger {}

    @Injectable({ scope: 'transient' })
    class Handler {
      constructor(readonly logger: Logger) {}
    }

    Reflect.defineMetadata('design:paramtypes', [Logger], Handler);

    const container = new Container();
    const first = container.resolve(Handler);
    const second = container.resolve(Handler);

    expect(first).not.toBe(second);
    expect(first.logger).toBe(second.logger);
  });

  it('keeps the transient dependency captured by a singleton', () => {
    @Injectable({ scope: 'transient' })
    class RequestContext {}

    @Injectable()
    class Application {
      constructor(readonly context: RequestContext) {}
    }

    Reflect.defineMetadata('design:paramtypes', [RequestContext], Application);

    const container = new Container();
    const first = container.resolve(Application);
    const second = container.resolve(Application);

    expect(first).toBe(second);
    expect(first.context).toBe(second.context);
  });
});
