import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  Controller,
  getControllerRoutes,
} from '../src/decorators/controller.js';
import { Get, Post } from '../src/decorators/methods.js';
import {
  CONTROLLER_PREFIX_METADATA,
  REQUEST_METHOD_METADATA,
  ROUTE_PATH_METADATA,
} from '../src/tokens.js';

describe('@Controller()', () => {
  it('stores the base path in class metadata', () => {
    @Controller('/users')
    class UsersController {}

    expect(
      Reflect.getMetadata(CONTROLLER_PREFIX_METADATA, UsersController),
    ).toBe('/users');
  });

  it('stores HTTP method and path metadata on a handler', () => {
    class UsersController {
      @Get(':id')
      findOne() {}
    }

    expect(
      Reflect.getMetadata(
        REQUEST_METHOD_METADATA,
        UsersController.prototype.findOne,
      ),
    ).toBe('GET');
    expect(
      Reflect.getMetadata(
        ROUTE_PATH_METADATA,
        UsersController.prototype.findOne,
      ),
    ).toBe(':id');
  });

  it('registers GET and POST routes with their full paths', () => {
    @Controller('/users/')
    class UsersController {
      @Get()
      findAll() {}

      @Get('/:id')
      findOne() {}

      @Post('/')
      create() {}

      helper() {}
    }

    expect(getControllerRoutes(UsersController)).toEqual([
      { method: 'GET', path: '/users', handlerName: 'findAll' },
      { method: 'GET', path: '/users/:id', handlerName: 'findOne' },
      { method: 'POST', path: '/users', handlerName: 'create' },
    ]);
  });
});
