import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload, SignJWT } from 'jose';
import { AppModule } from '../app.module.js';
import { configureApp } from '../configure-app.js';
import { JWKS } from '../modules/auth/token-verifier.js';

// Dieselben Werte setzt vitest.config.ts als Umgebungsvariablen.
export const testIssuer = 'https://zitadel.test';
export const testAudience = 'test-project';

/**
 * Startet die echte App mit einem eigenen Schlüsselpaar anstelle der Zitadel-Schlüssel.
 * So lassen sich gültige und ungültige Tokens ohne Verbindung zu Zitadel prüfen.
 */
export async function startTestApp() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256' };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(JWKS)
    .useValue(createLocalJWKSet({ keys: [jwk] }))
    .compile();
  const app: INestApplication = moduleRef.createNestApplication();
  configureApp(app);
  await app.listen(0);
  const baseUrl = await app.getUrl();

  interface TokenOptions {
    claims?: JWTPayload;
    issuer?: string;
    audience?: string;
    expiresAt?: number | string;
    key?: CryptoKey;
  }

  const signToken = ({
    claims = {},
    issuer = testIssuer,
    audience = testAudience,
    expiresAt = '5m',
    key = privateKey,
  }: TokenOptions = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject('user-1')
      .setIssuer(issuer)
      .setAudience([audience, 'client-id'])
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(key);

  const get = (path: string, token?: string, scheme = 'Bearer') =>
    fetch(`${baseUrl}${path}`, token ? { headers: { authorization: `${scheme} ${token}` } } : {});

  return { app, get, signToken };
}
