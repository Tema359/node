import { ServerResponse } from 'node:http';
import { ValidationError } from '../pipes/zod-validation.pipe.js';

export class NotFoundError extends Error {
  constructor(message = 'Route not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class PayloadTooLargeError extends Error {
  constructor() {
    super('Request body is too large');
    this.name = 'PayloadTooLargeError';
  }
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  value: unknown,
): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(value));
}

export class ExceptionFilter {
  catch(error: unknown, response: ServerResponse): void {
    if (error instanceof NotFoundError) {
      sendJson(response, 404, { error: error.message });
      return;
    }

    if (error instanceof ValidationError) {
      sendJson(response, 400, {
        error: 'Validation failed',
        fields: error.issues,
      });
      return;
    }

    if (error instanceof PayloadTooLargeError) {
      sendJson(response, 413, { error: 'Payload Too Large' });
      return;
    }

    console.error('Unhandled request error:', error);
    sendJson(response, 500, { error: 'Internal Server Error' });
  }
}
