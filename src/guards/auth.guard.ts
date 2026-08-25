import { IncomingMessage } from 'node:http';

export class AuthGuard {
  canActivate(request: IncomingMessage): boolean {
    const authorization = request.headers.authorization;

    return typeof authorization === 'string' && authorization.trim().length > 0;
  }
}
