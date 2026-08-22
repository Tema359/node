export type Constructor<T = unknown> = new (...args: any[]) => T;

export type InjectionToken<T = unknown> = Constructor<T> | string | symbol;

export type Scope = 'singleton' | 'transient';

export interface InjectableOptions {
  scope?: Scope;
}

export type RequestMethod = 'GET' | 'POST';

export interface RouteDefinition {
  method: RequestMethod;
  path: string;
  handlerName: string | symbol;
}

export type RouteParamSource = 'body' | 'param' | 'query';

export interface RouteParamDefinition {
  index: number;
  source: RouteParamSource;
  name?: string;
}

export type Provider<T = unknown> =
  | {
      useClass: Constructor<T>;
    }
  | {
      useValue: T;
    };
