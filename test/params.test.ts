import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Body, Param, Query } from '../src/decorators/params.js';
import { ROUTE_PARAMS_METADATA } from '../src/tokens.js';
import { RouteParamDefinition } from '../src/types.js';

describe('route parameter decorators', () => {
  it('stores where each handler argument must come from', () => {
    class UsersController {
      update(
        @Param('id') _id: string,
        @Body() _body: unknown,
        @Query('preview') _preview: string,
      ) {}
    }

    const metadata = Reflect.getOwnMetadata(
      ROUTE_PARAMS_METADATA,
      UsersController.prototype,
      'update',
    ) as RouteParamDefinition[];

    expect(metadata).toEqual([
      { index: 0, source: 'param', name: 'id' },
      { index: 1, source: 'body' },
      { index: 2, source: 'query', name: 'preview' },
    ]);
  });

  it('does not read request data while decorating the method', () => {
    expect(() => {
      class UsersController {
        find(@Param('id') _id: string) {}
      }

      return UsersController;
    }).not.toThrow();
  });
});
