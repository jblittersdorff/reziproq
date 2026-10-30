import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';
import { env } from '../../config/env.js';
import { SupportAccessService } from '../support/support-access.service.js';
import { AuthGuard } from './auth.guard.js';
import { DISCOVERY_URL, OidcDiscovery } from './oidc-discovery.js';
import { AUTH_OPTIONS, type AuthOptions, JWKS, TokenVerifier } from './token-verifier.js';

@Global()
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
      provide: DISCOVERY_URL,
      useFactory: (options: AuthOptions) => `${options.issuer}/.well-known/openid-configuration`,
      inject: [AUTH_OPTIONS],
    },
    OidcDiscovery,
    {
      // Die Schlüssel stehen unter jwks_uri aus der Discovery. Beides wird erst beim ersten Token
      // geladen und zwischengespeichert; ohne Token gibt es keine Verbindung zu Zitadel.
      provide: JWKS,
      useFactory: (discovery: OidcDiscovery): JWTVerifyGetKey => {
        let keys: JWTVerifyGetKey | undefined;
        return async (header, token) => {
          keys ??= createRemoteJWKSet(new URL((await discovery.get()).jwks_uri));
          return keys(header, token);
        };
      },
      inject: [OidcDiscovery],
    },
    TokenVerifier,
    SupportAccessService,
    // Gilt für alle Routen; Ausnahmen nur über @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [OidcDiscovery, SupportAccessService],
})
export class AuthModule {}
