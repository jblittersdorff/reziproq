import { generateKeyPair } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp } from '../../testing/test-app.js';

describe('GET /api/me', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  const claims = { name: 'Ada Lovelace', email: 'ada@example.com' };

  beforeAll(async () => {
    testApp = await startTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('antwortet ohne Token mit 401', async () => {
    const res = await testApp.get('/api/me');
    expect(res.status).toBe(401);
  });

  it('liefert Name und E-Mail aus einem gültigen Token', async () => {
    const res = await testApp.get('/api/me', await testApp.signToken({ claims }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(claims);
  });

  it('antwortet mit 401, wenn Name oder E-Mail im Token fehlen', async () => {
    const res = await testApp.get('/api/me', await testApp.signToken());
    expect(res.status).toBe(401);
  });

  it.each([
    ['falschem Issuer', { issuer: 'https://fremd.example' }],
    ['falscher Audience', { audience: 'anderes-projekt' }],
    ['abgelaufenem Token', { expiresAt: Math.floor(Date.now() / 1000) - 60 }],
  ] as const)('antwortet bei %s mit 401', async (_case, options) => {
    const res = await testApp.get('/api/me', await testApp.signToken({ claims, ...options }));
    expect(res.status).toBe(401);
  });

  it('antwortet bei fremder Signatur mit 401', async () => {
    const { privateKey } = await generateKeyPair('RS256');
    const res = await testApp.get('/api/me', await testApp.signToken({ claims, key: privateKey }));
    expect(res.status).toBe(401);
  });

  it('antwortet bei kaputtem Token oder anderem Schema als Bearer mit 401', async () => {
    expect((await testApp.get('/api/me', 'kein-jwt')).status).toBe(401);
    const token = await testApp.signToken({ claims });
    const res = await testApp.get('/api/me', token, 'Basic');
    expect(res.status).toBe(401);
  });
});
