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
import { type Action, type OrgRole, supportHeader } from '@reziproq/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { type AccountOrganization, AccountStore } from '../../common/database.module.js';
import { SupportAccessService } from '../support/support-access.service.js';
import { buyerOnlyActions } from './buyer-only.js';
import { can } from './can.js';
import { IS_PUBLIC } from './public.decorator.js';
import { REQUIRES } from './requires.decorator.js';
import { rolesFromToken, type TokenRole } from './roles.js';
import { AUTH_OPTIONS, type AuthOptions, TokenVerifier } from './token-verifier.js';
import { WITHOUT_ORGANIZATION } from './without-organization.decorator.js';

/**
 * Wer die Anfrage stellt: Nutzer-ID (sub), Rolle aus der Datenbank (PLT-05) und das geprüfte
 * Access Token. Erfüllt Subject, kann also direkt an can() gehen.
 */
export interface AuthContext {
  userId: string;
  accessToken: string;
  /** Rolle in der Organisation; in der Betreiber-Ansicht viewer, ohne Organisation null */
  orgRole: OrgRole | null;
  isControlling: boolean;
  /** Betreiber-Team von Reziproq; nur das Flag is_operator in der Datenbank (UMB-01) */
  isOperator: boolean;
  /** Rollen aus dem Token, nur für die einmalige Übernahme beim Login */
  tokenRoles: TokenRole[];
  /** Der Kunde, in den ein Betreiber gewechselt ist (PLT-13); sonst nicht gesetzt. */
  supportOrganization?: AccountOrganization;
  /**
   * Die Organisation, für die die Anfrage gilt: in der Betreiber-Ansicht der gewählte Kunde,
   * sonst die eigene. null ohne Organisation (PLT-02).
   */
  organization: AccountOrganization | null;
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
    @Inject(AccountStore) private readonly accounts: AccountStore,
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
    const tokenRoles = rolesFromToken(payload, this.options.audience);
    const auth: AuthContext = {
      userId: payload.sub,
      accessToken: token,
      orgRole: null,
      isControlling: false,
      isOperator: await this.accounts.isOperator(payload.sub),
      tokenRoles,
      organization: null,
    };

    // Betreiber-Ansicht (PLT-13, UMB-01): Nur Betreiber dürfen einen Kunden wählen.
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

    if (auth.supportOrganization) {
      // Im Kunden gelten für Betreiber die Rechte eines Lesers (PLT-05).
      auth.organization = auth.supportOrganization;
      auth.orgRole = 'viewer';
    } else {
      const membership = await this.accounts.membershipOf(auth.userId);
      auth.organization = membership?.organization ?? null;
      auth.orgRole = membership?.orgRole ?? null;
      auth.isControlling = membership?.isControlling ?? false;
    }

    // Ohne Organisation nur /me und der Betreiber-Zugang (PLT-02).
    const withoutOrganization = this.reflector.getAllAndOverride<boolean | undefined>(
      WITHOUT_ORGANIZATION,
      [context.getHandler(), context.getClass()],
    );
    if (!auth.organization && !withoutOrganization) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'keine_organisation',
        message: 'Deine Organisation ist noch nicht freigeschaltet.',
      });
    }

    // Jeder Endpunkt nennt seine Aktion; entschieden wird über can() (PLT-05).
    const action = this.reflector.getAllAndOverride<Action | undefined>(REQUIRES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (action && !can(auth, action)) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    // Käuferaktionen nur mit Käuferfunktionen, schon vor jedem Dienst (PLT-02, LIF-02).
    if (action && buyerOnlyActions.includes(action) && !auth.organization?.buyer) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }

    request.auth = auth;
    return true;
  }
}
