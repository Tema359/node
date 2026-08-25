import { IncomingMessage } from 'node:http';

export class LoggingInterceptor {
  constructor(private readonly now: () => number = () => performance.now()) {}

  async intercept<T>(
    request: IncomingMessage,
    next: () => T | Promise<T>,
    before?: () => void,
    after?: () => void,
  ): Promise<T> {
    const startedAt = this.now();
    before?.();

    try {
      return await next();
    } finally {
      after?.();
      const duration = this.now() - startedAt;
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      console.log(
        `${request.method ?? 'UNKNOWN'} ${pathname} — ${duration.toFixed(1)} ms`,
      );
    }
  }
}
