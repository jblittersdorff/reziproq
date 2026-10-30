import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { generateKeyPair } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DATABASE } from '../../common/database.module.js';
import { startTestApp } from '../../testing/test-app.js';

// Dieser Test braucht die Datenbank mit angewendeten Migrationen, aber keine Verbindung zu Zitadel:
// Discovery, Schlüssel und Userinfo kommen aus einem nachgebauten Zitadel (testing/fake-zitadel.ts).
describe('GET /api/me', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  // Eigene Nutzer-ID je Testlauf, damit parallele Läufe sich nicht stören.
  const userId = `test-${randomUUID()}`;
  const ada = { sub: userId, name: 'Ada Lovelace', given_name: 'Ada', email: 'ada@example.com' };
  const noPermissions = { viewOrganizationSettings: false, viewSuppliers: false };

  const storedUser = async () =>
    (await db.select().from(schema.appUser).where(sql`${schema.appUser.id} = ${userId}`))[0];

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.app.get(DATABASE);
  });

  beforeEach(async () => {
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} = ${userId}`);
    testApp.zitadel.userinfoCalls.length = 0;
    testApp.zitadel.replyUserinfo(() => ({ status: 200, body: ada }));
  });

  afterAll(async () => {
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} = ${userId}`);
    await testApp.close();
  });

  it('antwortet ohne Token mit 401', async () => {
    const res = await testApp.get('/api/me');
    expect(res.status).toBe(401);
    expect(testApp.zitadel.userinfoCalls).toHaveLength(0);
  });

  it('holt Name und E-Mail mit demselben Token vom Userinfo-Endpunkt und speichert sie', async () => {
    const token = await testApp.signToken({ subject: userId });
    const res = await testApp.get('/api/me', token);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      name: 'Ada Lovelace',
      firstName: 'Ada',
      email: 'ada@example.com',
      organization: null,
      permissions: noPermissions,
    });
    expect(testApp.zitadel.userinfoCalls).toEqual([{ authorization: `Bearer ${token}` }]);
    expect(await storedUser()).toMatchObject({
      id: userId,
      name: 'Ada Lovelace',
      givenName: 'Ada',
      email: 'ada@example.com',
    });
  });

  it('nimmt ohne given_name das erste Wort des Namens als Vornamen', async () => {
    testApp.zitadel.replyUserinfo(() => ({
      status: 200,
      body: { sub: userId, name: 'Grace Brewster Hopper', email: 'grace@example.com' },
    }));
    const res = await testApp.get('/api/me', await testApp.signToken({ subject: userId }));
    expect(await res.json()).toMatchObject({ firstName: 'Grace' });
    expect(await storedUser()).toMatchObject({ givenName: null });
  });

  it.each([
    ['admin', true],
    ['nutzer', false],
    ['leser', false],
    ['controlling', false],
  ] as const)(
    'meldet für die Rolle %s die Organisationseinstellungen: %s',
    async (role, allowed) => {
      const token = await testApp.signToken({
        subject: userId,
        claims: { 'urn:zitadel:iam:org:project:test-project:roles': { [role]: { '1': 'test' } } },
      });
      const res = await testApp.get('/api/me', token);
      expect(await res.json()).toMatchObject({
        permissions: { viewOrganizationSettings: allowed },
      });
    },
  );

  it('liefert die Organisation und gibt Käufern mit Rolle die Lieferanten frei', async () => {
    const orgId = randomUUID();
    await db
      .insert(schema.organization)
      .values({ id: orgId, name: `Me-Test-OEM ${userId}`, typ: 'kaeufer' });
    try {
      const token = await testApp.signToken({
        subject: userId,
        claims: { 'urn:zitadel:iam:org:project:test-project:roles': { leser: { '1': 'test' } } },
      });
      await testApp.get('/api/me', token);
      await db
        .update(schema.appUser)
        .set({ organizationId: orgId })
        .where(sql`${schema.appUser.id} = ${userId}`);
      const res = await testApp.get('/api/me', token);
      expect(await res.json()).toMatchObject({
        organization: { id: orgId, name: `Me-Test-OEM ${userId}` },
        permissions: { viewOrganizationSettings: false, viewSuppliers: true },
      });
    } finally {
      await db
        .update(schema.appUser)
        .set({ organizationId: null })
        .where(sql`${schema.appUser.id} = ${userId}`);
      await db.delete(schema.organization).where(sql`${schema.organization.id} = ${orgId}`);
    }
  });

  it('gibt ohne Rollen im Token keine Organisationseinstellungen frei', async () => {
    const res = await testApp.get('/api/me', await testApp.signToken({ subject: userId }));
    expect(await res.json()).toMatchObject({ permissions: noPermissions });
  });

  it('aktualisiert Name und E-Mail beim nächsten Aufruf und behält created_at', async () => {
    const token = await testApp.signToken({ subject: userId });
    await testApp.get('/api/me', token);
    const first = await storedUser();

    testApp.zitadel.replyUserinfo(() => ({
      status: 200,
      body: { ...ada, name: 'Ada King', email: 'ada.king@example.com' },
    }));
    const res = await testApp.get('/api/me', token);

    expect(await res.json()).toMatchObject({ name: 'Ada King', email: 'ada.king@example.com' });
    const second = await storedUser();
    expect(second?.createdAt).toEqual(first?.createdAt);
    expect(second?.updatedAt.getTime()).toBeGreaterThan(first?.updatedAt.getTime() ?? 0);
  });

  it('antwortet mit 401, wenn Zitadel das Token beim Userinfo-Endpunkt ablehnt', async () => {
    testApp.zitadel.replyUserinfo(() => ({ status: 401 }));
    const res = await testApp.get('/api/me', await testApp.signToken({ subject: userId }));
    expect(res.status).toBe(401);
    expect(await storedUser()).toBeUndefined();
  });

  it('antwortet mit 401, wenn Userinfo zu einer anderen Person gehört', async () => {
    testApp.zitadel.replyUserinfo(() => ({ status: 200, body: { ...ada, sub: 'jemand-anders' } }));
    const res = await testApp.get('/api/me', await testApp.signToken({ subject: userId }));
    expect(res.status).toBe(401);
    expect(await storedUser()).toBeUndefined();
  });

  it.each([
    ['Name oder E-Mail fehlen', { status: 200, body: { sub: userId } }],
    ['Zitadel einen Fehler meldet', { status: 500 }],
  ])('antwortet mit 502, wenn %s', async (_case, reply) => {
    testApp.zitadel.replyUserinfo(() => reply);
    const res = await testApp.get('/api/me', await testApp.signToken({ subject: userId }));
    expect(res.status).toBe(502);
    expect(await storedUser()).toBeUndefined();
  });

  it.each([
    ['falschem Issuer', { issuer: 'https://fremd.example' }],
    ['falscher Audience', { audience: 'anderes-projekt' }],
    ['abgelaufenem Token', { expiresAt: Math.floor(Date.now() / 1000) - 60 }],
    ['Token ohne sub', { subject: null }],
  ] as const)('antwortet bei %s mit 401, ohne Zitadel zu fragen', async (_case, options) => {
    const res = await testApp.get('/api/me', await testApp.signToken(options));
    expect(res.status).toBe(401);
    expect(testApp.zitadel.userinfoCalls).toHaveLength(0);
  });

  it('antwortet bei fremder Signatur mit 401', async () => {
    const { privateKey } = await generateKeyPair('RS256');
    const res = await testApp.get('/api/me', await testApp.signToken({ key: privateKey }));
    expect(res.status).toBe(401);
    expect(testApp.zitadel.userinfoCalls).toHaveLength(0);
  });

  it('antwortet bei kaputtem Token oder anderem Schema als Bearer mit 401', async () => {
    expect((await testApp.get('/api/me', 'kein-jwt')).status).toBe(401);
    const res = await testApp.get('/api/me', await testApp.signToken(), 'Basic');
    expect(res.status).toBe(401);
    expect(testApp.zitadel.userinfoCalls).toHaveLength(0);
  });
});

describe('GET /api/me mit Discovery eines fremden Issuers', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;

  beforeAll(async () => {
    testApp = await startTestApp({ discoveryIssuer: 'https://fremd.example' });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('nutzt die Adressen nicht und antwortet mit 502', async () => {
    const res = await testApp.get('/api/me', await testApp.signToken());
    expect(res.status).toBe(502);
    expect(testApp.zitadel.userinfoCalls).toHaveLength(0);
  });
});
