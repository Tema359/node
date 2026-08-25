import { z } from 'zod';
import { Constructor } from '../types.js';

interface ZodDtoConstructor<T> extends Constructor<T> {
  schema: z.ZodType;
}

export interface ValidationIssue {
  field: string;
  reasons: string[];
}

export class ValidationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super('DTO validation failed');
    this.name = 'ValidationError';
  }
}

function hasZodSchema<T>(
  metatype: Constructor<T>,
): metatype is ZodDtoConstructor<T> {
  return 'schema' in metatype && metatype.schema instanceof z.ZodType;
}

export class ZodValidationPipe {
  transform<T>(value: unknown, metatype: Constructor<T>): T {
    if (!hasZodSchema(metatype)) {
      return value as T;
    }

    const result = metatype.schema.safeParse(value);

    if (!result.success) {
      const reasonsByField = new Map<string, string[]>();

      for (const issue of result.error.issues) {
        const field = issue.path.map(String).join('.') || 'body';
        const reasons = reasonsByField.get(field) ?? [];
        reasons.push(issue.message);
        reasonsByField.set(field, reasons);
      }

      throw new ValidationError(
        [...reasonsByField].map(([field, reasons]) => ({ field, reasons })),
      );
    }

    const instance = new metatype();
    Object.assign(instance as object, result.data);
    return instance;
  }
}
