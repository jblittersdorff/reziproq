import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { JWTPayload } from 'jose';
import { IS_PUBLIC } from './public.decorator.js';
import { TokenVerifier } from './token-verifier.js';

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

@Injectable()
export class AuthGuard implements CanActivate {
  // @Inject ausdrücklich, weil Biome reine Typ-Importe sonst zu `import type` macht
  // und Nest die Klassen dann zur Laufzeit nicht kennt.
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TokenVerifier) private readonly verifier: TokenVerifier,
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

    request.user = await this.verifier.verify(token);
    return true;
  }
}
