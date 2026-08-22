import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Controller } from '../src/decorators/controller.js';
import { Get, Post } from '../src/decorators/methods.js';
import { Router } from '../src/router.js';

describe('Router', () => {
  it('collects controller routes from metadata', () => {
    @Controller('/users')
    class UsersController {
      @Get()
      findAll() {}

      @Post('/:id')
      update() {}
    }

    const router = new Router([UsersController]);

    expect(
      router.getRoutes().map(({ method, path, handlerName, controller }) => ({
        method,
        path,
        handlerName,
        controller,
      })),
    ).toEqual([
      {
        method: 'GET',
        path: '/users',
        handlerName: 'findAll',
        controller: UsersController,
      },
      {
        method: 'POST',
        path: '/users/:id',
        handlerName: 'update',
        controller: UsersController,
      },
    ]);
  });

  it('matches method and path and extracts route parameters', () => {
    @Controller('/users')
    class UsersController {
      @Get('/:id')
      findOne() {}
    }

    const match = new Router([UsersController]).find('get', '/users/a%20b');

    expect(match?.route.handlerName).toBe('findOne');
    expect(match?.params).toEqual({ id: 'a b' });
  });
});
