import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { createRemoteJWKSet } from 'jose';
import { env } from '../../config/env.js';
import { AuthGuard } from './auth.guard.js';
import { AUTH_OPTIONS, type AuthOptions, JWKS, TokenVerifier } from './token-verifier.js';

@Module({
  providers: [
    {
      provide: AUTH_OPTIONS,
      useValue: {
        issuer: env.ZITADEL_ISSUER,
        audience: env.ZITADEL_PROJECT_ID,
      } satisfies AuthOptions,
    },
    {
      // Zitadel veröffentlicht seine Schlüssel unter /oauth/v2/keys. Sie werden erst beim ersten
      // Token geladen und zwischengespeichert; ohne Token gibt es keine Verbindung zu Zitadel.
      provide: JWKS,
      useFactory: (options: AuthOptions) =>
        createRemoteJWKSet(new URL(`${options.issuer}/oauth/v2/keys`)),
      inject: [AUTH_OPTIONS],
    },
    TokenVerifier,
    // Gilt für alle Routen; Ausnahmen nur über @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
