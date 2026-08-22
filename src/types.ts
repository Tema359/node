export type Constructor<T = unknown> = new (...args: any[]) => T;

export type InjectionToken<T = unknown> = Constructor<T> | string | symbol;

export type Scope = 'singleton' | 'transient';

export interface InjectableOptions {
  scope?: Scope;
}

export type Provider<T = unknown> =
  | {
      useClass: Constructor<T>;
    }
  | {
      useValue: T;
    };
