import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { exportJWK, generateKeyPair, type JWTPayload, SignJWT } from 'jose';
import { AppModule } from '../app.module.js';
import { configureApp } from '../configure-app.js';
import { DISCOVERY_URL } from '../modules/auth/oidc-discovery.js';
import { startFakeZitadel } from './fake-zitadel.js';

// Dieselben Werte setzt vitest.config.ts als Umgebungsvariablen.
export const testIssuer = 'https://zitadel.test';
export const testAudience = 'test-project';

/**
 * Startet die echte App gegen ein nachgebautes Zitadel mit eigenem Schlüsselpaar.
 * Discovery, Schlüssel und Userinfo laufen über denselben Weg wie im Betrieb, nur lokal.
 * `discoveryIssuer` simuliert ein Discovery-Dokument, das zu einem anderen Issuer gehört.
 */
export async function startTestApp({
  discoveryIssuer = testIssuer,
  configure = (builder: TestingModuleBuilder) => builder,
}: {
  discoveryIssuer?: string;
  /** Ersetzt einzelne Bausteine, z. B. das Protokoll oder die Ratenbegrenzung. */
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
} = {}) {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256' };

  const zitadel = await startFakeZitadel({ issuer: discoveryIssuer, jwk });

  const moduleRef = await configure(
    Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DISCOVERY_URL)
      .useValue(zitadel.discoveryUrl),
  ).compile();
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
    /** null erzeugt ein Token ohne sub. */
    subject?: string | null;
  }

  const signToken = ({
    claims = {},
    issuer = testIssuer,
    audience = testAudience,
    expiresAt = '5m',
    key = privateKey,
    subject = 'user-1',
  }: TokenOptions = {}) => {
    const jwt = new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'test-key' });
    if (subject !== null) jwt.setSubject(subject);
    return jwt
      .setIssuer(issuer)
      .setAudience([audience, 'client-id'])
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(key);
  };

  const get = (path: string, token?: string, scheme = 'Bearer') =>
    fetch(`${baseUrl}${path}`, token ? { headers: { authorization: `${scheme} ${token}` } } : {});

  const post = (path: string, body: unknown, token?: string) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  const close = async () => {
    await app.close();
    await zitadel.close();
  };

  return { app, get, post, signToken, zitadel, close };
}
