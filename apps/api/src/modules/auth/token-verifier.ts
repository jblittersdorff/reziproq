import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { errors, type JWTPayload, type JWTVerifyGetKey, jwtVerify } from 'jose';
import { DemoTokens, demoSessionsEnabled } from './demo-token.js';

export const JWKS = Symbol('JWKS');
export const AUTH_OPTIONS = Symbol('AUTH_OPTIONS');

export interface AuthOptions {
  issuer: string;
  /** Die Projekt-ID in Zitadel; sie muss in der Audience des Tokens stehen. */
  audience: string;
}

@Injectable()
export class TokenVerifier {
  constructor(
    @Inject(JWKS) private readonly keys: JWTVerifyGetKey,
    @Inject(AUTH_OPTIONS) private readonly options: AuthOptions,
    @Inject(DemoTokens) private readonly demo: DemoTokens,
  ) {}

  /**
   * Prüft Signatur, Issuer, Audience, Ablaufzeit und sub. Jeder Fehler am Token führt zu 401. Ein
   * Demo-Token (E-K0-05) gilt nur, solange Demo-Sitzungen erlaubt sind; es trägt demo = true, und
   * der Wächter lässt es nur für Personen eines Demo-Mandanten zu.
   */
  async verify(token: string): Promise<JWTPayload & { sub: string; demo?: true }> {
    if (this.demo.isDemoToken(token)) {
      if (!demoSessionsEnabled()) throw new UnauthorizedException();
      try {
        return { ...(await this.demo.verify(token)), demo: true };
      } catch {
        throw new UnauthorizedException();
      }
    }
    try {
      const { payload } = await jwtVerify(token, this.keys, {
        issuer: this.options.issuer,
        audience: this.options.audience,
        algorithms: ['RS256', 'ES256', 'EdDSA'],
        requiredClaims: ['sub'],
      });
      if (typeof payload.sub !== 'string' || payload.sub === '') throw new UnauthorizedException();
      return { ...payload, sub: payload.sub };
    } catch (error) {
      if (error instanceof errors.JOSEError) throw new UnauthorizedException();
      throw error;
    }
  }
}
