import { z } from 'zod';
import { Constructor } from '../types.js';

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

export class ZodValidationPipe {
  transform<T>(
    value: unknown,
    schema: z.ZodType,
    metatype?: Constructor<T>,
  ): T {
    const result = schema.safeParse(value);

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

    const builtInTypes: Function[] = [Object, String, Number, Boolean, Array];
    if (metatype && !builtInTypes.includes(metatype as Function)) {
      const instance = new metatype();
      Object.assign(instance as object, result.data);
      return instance;
    }

    return result.data as T;
  }
}
