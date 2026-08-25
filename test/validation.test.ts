import 'reflect-metadata';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { Container } from '../src/container.js';
import { Controller } from '../src/decorators/controller.js';
import { Post } from '../src/decorators/methods.js';
import { Body } from '../src/decorators/params.js';
import { Dispatcher } from '../src/dispatcher.js';
import { CreateUserDto } from '../src/dto/create-user.dto.js';
import {
  ValidationError,
  ZodValidationPipe,
} from '../src/pipes/zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
  it('returns a DTO instance for valid input', () => {
    const result = new ZodValidationPipe().transform(
      { name: 'Ada', email: 'ada@example.com' },
      CreateUserDto,
    );

    expect(result).toBeInstanceOf(CreateUserDto);
    expect(result).toEqual({ name: 'Ada', email: 'ada@example.com' });
  });

  it('reports fields and reasons for invalid input', () => {
    expect(() =>
      new ZodValidationPipe().transform(
        { name: '', email: 'wrong' },
        CreateUserDto,
      ),
    ).toThrow(ValidationError);

    try {
      new ZodValidationPipe().transform(
        { name: '', email: 'wrong' },
        CreateUserDto,
      );
    } catch (error) {
      expect((error as ValidationError).issues).toEqual([
        { field: 'name', reasons: ['must be at least 2 characters long'] },
        { field: 'email', reasons: ['must be a valid email'] },
      ]);
    }
  });

  it('makes the dispatcher return 400 or pass a DTO instance', async () => {
    @Controller('/users')
    class UsersController {
      @Post()
      create(@Body() dto: CreateUserDto) {
        return { isDto: dto instanceof CreateUserDto, name: dto.name };
      }
    }

    const dispatcher = new Dispatcher([UsersController], new Container());

    async function call(body: unknown) {
      const request = Readable.from([JSON.stringify(body)]);
      Object.assign(request, {
        method: 'POST',
        url: '/users',
        headers: { authorization: 'Bearer test-token' },
      });
      let payload = '';
      const response = {
        statusCode: 200,
        setHeader() {},
        end(chunk?: string) {
          payload = chunk ?? '';
        },
      };

      await dispatcher.handle(
        request as IncomingMessage,
        response as unknown as ServerResponse,
      );

      return { status: response.statusCode, body: JSON.parse(payload) };
    }

    expect(await call({ name: 'Ada', email: 'ada@example.com' })).toEqual({
      status: 200,
      body: { isDto: true, name: 'Ada' },
    });
    expect(await call({ name: '', email: 'wrong' })).toEqual({
      status: 400,
      body: {
        error: 'Validation failed',
        fields: [
          { field: 'name', reasons: ['must be at least 2 characters long'] },
          { field: 'email', reasons: ['must be a valid email'] },
        ],
      },
    });

    const missingName = await call({ email: 'not-an-email' });
    expect(missingName.status).toBe(400);
    expect(JSON.stringify(missingName.body)).toMatch(/email/);
  });
});
