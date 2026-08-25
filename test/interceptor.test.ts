import { IncomingMessage } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { LoggingInterceptor } from '../src/interceptors/logging.interceptor.js';

describe('LoggingInterceptor', () => {
  it('wraps the handler and logs its duration', async () => {
    const timestamps = [10, 22.3];
    const events: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((message) => {
      events.push(String(message));
    });
    const request = {
      method: 'GET',
      url: '/users/42?details=true',
    } as IncomingMessage;

    try {
      const result = await new LoggingInterceptor(
        () => timestamps.shift() ?? 0,
      ).intercept(request, () => {
        events.push('handler');
        return { id: 42 };
      });

      expect(result).toEqual({ id: 42 });
      expect(events).toEqual(['handler', 'GET /users/42 — 12.3 ms']);
      expect(events[1]).toMatch(/[0-9]+(\.[0-9]+)? ?ms/);
    } finally {
      log.mockRestore();
    }
  });
});
