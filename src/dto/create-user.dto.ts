import { z } from 'zod';

export class CreateUserDto {
  static readonly schema = z.object({
    name: z
      .string({ error: 'must be a string' })
      .min(2, { error: 'must be at least 2 characters long' }),
    email: z
      .string({ error: 'must be a string' })
      .email({ error: 'must be a valid email' }),
  });

  name!: string;

  email!: string;
}
