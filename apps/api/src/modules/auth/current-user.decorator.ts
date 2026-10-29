import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthContext, AuthenticatedRequest } from './auth.guard.js';

/** Nutzer-ID und Access Token der aktuellen Anfrage; nur auf Routen ohne @Public(). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const { auth } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!auth) throw new Error('CurrentUser ist nur auf Routen mit Login verfügbar.');
    return auth;
  },
);
