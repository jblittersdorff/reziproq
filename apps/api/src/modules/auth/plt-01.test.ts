import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryService, MetadataScanner, ModulesContainer } from '@nestjs/core';
import { generateKeyPair } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PLT-01.md: Ohne gültiges Token ist jede Route der API gesperrt.
// Die Routen werden aus den Controllern gelesen, damit neue Routen automatisch mitgeprüft werden.

interface Route {
  method: string;
  path: string;
}

function discoverRoutes(app: Awaited<ReturnType<typeof startTestApp>>['app']): Route[] {
  // Ohne eigenes DiscoveryModule: Die Dienste lesen direkt aus dem Container der laufenden App.
  const discovery = new DiscoveryService(app.get(ModulesContainer));
  const scanner = new MetadataScanner();
  return discovery.getControllers().flatMap(({ instance, metatype }) => {
    if (!instance || !metatype) return [];
    const base = String(Reflect.getMetadata(PATH_METADATA, metatype) ?? '');
    const prototype = Object.getPrototypeOf(instance);
    return scanner.getAllMethodNames(prototype).flatMap((name) => {
      const handler = prototype[name];
      const path = Reflect.getMetadata(PATH_METADATA, handler);
      if (path === undefined) return [];
      const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
      const full = ['api', base, String(path)]
        .flatMap((part) => part.split('/'))
        .filter(Boolean)
        // Platzhalter wie :id mit einer gültigen UUID füllen, damit die Route überhaupt greift.
        .map((part) => (part.startsWith(':') ? '00000000-0000-7000-8000-000000000000' : part))
        .join('/');
      return [{ method, path: `/${full}` }];
    });
  });
}

describe('PLT-01: Zugriff auf die API nur mit gültigem Token', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let routes: Route[];
  let protectedRoutes: Route[];

  let baseUrl = '';
  const call = (route: Route, token?: string) =>
    fetch(`${baseUrl}${route.path}`, {
      method: route.method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(route.method === 'GET' ? {} : { body: '{}' }),
    });

  beforeAll(async () => {
    testApp = await startTestApp();
    baseUrl = await testApp.app.getUrl();
    routes = discoverRoutes(testApp.app);
    protectedRoutes = routes.filter((r) => !(r.method === 'GET' && r.path === '/api/health'));
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('findet alle Routen der API, darunter die bekannten', () => {
    const names = routes.map((r) => `${r.method} ${r.path}`);
    expect(names).toEqual(
      expect.arrayContaining([
        'GET /api/health',
        'GET /api/me',
        'POST /api/me/anmeldung',
        'GET /api/suppliers',
        'POST /api/prompt',
        'GET /api/betreiber/kunden',
      ]),
    );
  });

  it('Jede Route außer GET /health antwortet ohne Token mit 401', async () => {
    const health = await call({ method: 'GET', path: '/api/health' });
    expect(health.status).toBe(200);

    const results = await Promise.all(
      protectedRoutes.map(
        async (route) => `${route.method} ${route.path} → ${(await call(route)).status}`,
      ),
    );
    expect(results).toEqual(protectedRoutes.map((r) => `${r.method} ${r.path} → 401`));
  });

  it('Token mit falschem Issuer, falscher Audience, falscher Signatur oder abgelaufen gibt 401', async () => {
    const { privateKey: foreignKey } = await generateKeyPair('RS256');
    const badTokens = {
      'falscher Issuer': await testApp.signToken({ issuer: 'https://fremd.example' }),
      'falsche Audience': await testApp.signToken({ audience: 'fremdes-projekt' }),
      'falsche Signatur': await testApp.signToken({ key: foreignKey }),
      abgelaufen: await testApp.signToken({ expiresAt: Math.floor(Date.now() / 1000) - 60 }),
    };

    const results = await Promise.all(
      Object.entries(badTokens).flatMap(([kind, token]) =>
        protectedRoutes.map(
          async (route) =>
            `${kind}: ${route.method} ${route.path} → ${(await call(route, token)).status}`,
        ),
      ),
    );
    expect(results).toEqual(
      Object.keys(badTokens).flatMap((kind) =>
        protectedRoutes.map((route) => `${kind}: ${route.method} ${route.path} → 401`),
      ),
    );
    // Kein ungültiges Token darf bis zu Zitadel durchgereicht werden.
    expect(testApp.zitadel.userinfoCalls).toEqual([]);
  });
});
