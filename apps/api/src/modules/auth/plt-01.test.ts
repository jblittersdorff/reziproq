import { generateKeyPair } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { discoverRoutes, type Route } from '../../testing/routes.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PLT-01.md: Ohne gültiges Token ist jede Route der API gesperrt.
// Die Routen werden aus den Controllern gelesen, damit neue Routen automatisch mitgeprüft werden.

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

    const results: string[] = [];
    for (const [kind, token] of Object.entries(badTokens)) {
      for (const route of protectedRoutes) {
        results.push(
          `${kind}: ${route.method} ${route.path} → ${(await call(route, token)).status}`,
        );
      }
    }
    expect(results).toEqual(
      Object.keys(badTokens).flatMap((kind) =>
        protectedRoutes.map((route) => `${kind}: ${route.method} ${route.path} → 401`),
      ),
    );
    // Kein ungültiges Token darf bis zu Zitadel durchgereicht werden.
    expect(testApp.zitadel.userinfoCalls).toEqual([]);
  });
});
