import { requestContext } from '../context/request-context.js';
import { Injectable } from '../decorators/injectable.js';

@Injectable()
export class RequestIdReaderService {
  async read(): Promise<string | undefined> {
    await new Promise<void>((resolve) => setImmediate(resolve));
    const requestId = requestContext.getRequestId();
    console.log(`request-id: ${requestId}`);
    return requestId;
  }
}
