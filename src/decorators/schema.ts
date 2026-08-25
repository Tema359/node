import 'reflect-metadata';
import { z } from 'zod';
import { BODY_SCHEMA_METADATA } from '../tokens.js';

export function UseBodySchema(schema: z.ZodType): MethodDecorator {
  return (_target, _propertyKey, descriptor) => {
    if (!descriptor?.value) {
      return;
    }

    Reflect.defineMetadata(BODY_SCHEMA_METADATA, schema, descriptor.value);
  };
}
