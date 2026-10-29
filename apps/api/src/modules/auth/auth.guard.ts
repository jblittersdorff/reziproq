import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@reziproq/shared';
import type { Request } from 'express';
import { IS_PUBLIC } from './public.decorator.js';
import { rolesFromToken } from './roles.js';
import { AUTH_OPTIONS, type AuthOptions, TokenVerifier } from './token-verifier.js';

/** Wer die Anfrage stellt: Nutzer-ID (sub), Rollen und das geprüfte Access Token. */
export interface AuthContext {
  userId: string;
  roles: Role[];
  accessToken: string;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

@Injectable()
export class AuthGuard implements CanActivate {
  // @Inject ausdrücklich, weil Biome reine Typ-Importe sonst zu `import type` macht
  // und Nest die Klassen dann zur Laufzeit nicht kennt.
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TokenVerifier) private readonly verifier: TokenVerifier,
    @Inject(AUTH_OPTIONS) private readonly options: AuthOptions,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw new UnauthorizedException();

    const payload = await this.verifier.verify(token);
    request.auth = {
      userId: payload.sub,
      roles: rolesFromToken(payload, this.options.audience),
      accessToken: token,
    };
    return true;
  }
}
