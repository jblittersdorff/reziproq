import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { errors, type JWTPayload, type JWTVerifyGetKey, jwtVerify } from 'jose';

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
  ) {}

  /** Prüft Signatur, Issuer, Audience und Ablaufzeit. Jeder Fehler am Token führt zu 401. */
  async verify(token: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.keys, {
        issuer: this.options.issuer,
        audience: this.options.audience,
        algorithms: ['RS256', 'ES256', 'EdDSA'],
      });
      return payload;
    } catch (error) {
      if (error instanceof errors.JOSEError) throw new UnauthorizedException();
      throw error;
    }
  }
}
