import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@reziproq/shared';
import { supportHeader } from '@reziproq/shared';
import type { Request } from 'express';
import { z } from 'zod';
import {
  SupportAccessService,
  type SupportOrganization,
} from '../support/support-access.service.js';
import { can } from './can.js';
import { IS_PUBLIC } from './public.decorator.js';
import { rolesFromToken } from './roles.js';
import { AUTH_OPTIONS, type AuthOptions, TokenVerifier } from './token-verifier.js';

/** Wer die Anfrage stellt: Nutzer-ID (sub), Rollen und das geprüfte Access Token. */
export interface AuthContext {
  userId: string;
  roles: Role[];
  accessToken: string;
  /** Der Kunde, in den ein Betreiber gewechselt ist (PLT-13); sonst nicht gesetzt. */
  supportOrganization?: SupportOrganization;
}

const uuid = z.uuid();

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
    @Inject(SupportAccessService) private readonly support: SupportAccessService,
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
    const auth: AuthContext = {
      userId: payload.sub,
      roles: rolesFromToken(payload, this.options.audience),
      accessToken: token,
    };

    // Betreiber-Ansicht (PLT-13): Nur die Rolle betreiber darf einen Kunden wählen.
    const customerId = request.headers[supportHeader];
    if (customerId !== undefined) {
      if (!can(auth, 'kunden.wechseln')) {
        throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
      }
      if (typeof customerId !== 'string' || !uuid.safeParse(customerId).success) {
        throw new BadRequestException('Ungültige Kunden-ID.');
      }
      auth.supportOrganization = await this.support.enter(
        auth.userId,
        customerId,
        `${request.method} ${request.originalUrl}`,
      );
    }

    request.auth = auth;
    return true;
  }
}
