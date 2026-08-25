import 'reflect-metadata';
import { VALIDATION_RULES_METADATA } from '../tokens.js';
import { Constructor } from '../types.js';

type ValidationRule = (value: unknown) => string | undefined;

interface PropertyRule {
  property: string;
  validate: ValidationRule;
}

export interface ValidationIssue {
  field: string;
  reasons: string[];
}

function addRule(validate: ValidationRule): PropertyDecorator {
  return (target, propertyKey) => {
    const rules: PropertyRule[] =
      Reflect.getOwnMetadata(VALIDATION_RULES_METADATA, target.constructor) ??
      [];

    Reflect.defineMetadata(
      VALIDATION_RULES_METADATA,
      [...rules, { property: String(propertyKey), validate }],
      target.constructor,
    );
  };
}

export function IsString(): PropertyDecorator {
  return addRule((value) =>
    typeof value === 'string' ? undefined : 'must be a string',
  );
}

export function MinLength(length: number): PropertyDecorator {
  return addRule((value) =>
    typeof value === 'string' && value.length >= length
      ? undefined
      : `must be at least ${length} characters long`,
  );
}

export function IsEmail(): PropertyDecorator {
  return addRule((value) =>
    typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? undefined
      : 'must be a valid email',
  );
}

export class DtoValidationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super('DTO validation failed');
    this.name = 'DtoValidationError';
  }
}

export class ValidationPipe {
  transform<T>(value: unknown, metatype: Constructor<T>): T {
    const input =
      typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : {};
    const rules: PropertyRule[] =
      Reflect.getMetadata(VALIDATION_RULES_METADATA, metatype) ?? [];
    const reasonsByField = new Map<string, string[]>();

    for (const rule of rules) {
      const reason = rule.validate(input[rule.property]);
      if (!reason) {
        continue;
      }

      const reasons = reasonsByField.get(rule.property) ?? [];
      reasons.push(reason);
      reasonsByField.set(rule.property, reasons);
    }

    if (reasonsByField.size > 0) {
      throw new DtoValidationError(
        [...reasonsByField].map(([field, reasons]) => ({ field, reasons })),
      );
    }

    const instance = new metatype();
    Object.assign(instance as object, input);
    return instance;
  }
}
