import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { permissionsResponseSchema } from '@reziproq/shared';
import { generateKeyPair } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestApp } from '../../testing/test-app.js';

// Dieser Test braucht die Datenbank mit angewendeten Migrationen, aber keine Verbindung zu Zitadel:
// Discovery, Schlüssel und Userinfo kommen aus einem nachgebauten Zitadel (testing/fake-zitadel.ts).
describe('GET /api/me', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  // Eigene Nutzer-ID je Testlauf, damit parallele Läufe sich nicht stören.
  const userId = `test-${randomUUID()}`;
  const ada = { sub: userId, name: 'Ada Lovelace', given_name: 'Ada', email: 'ada@example.com' };
  const noPermissions = {
    viewOrganizationSettings: false,
    viewBuyerAreas: false,
    viewSuppliers: false,
    switchCustomer: false,
    viewCustomers: false,
  };

  const storedUser = async () =>
    (await db.select().from(schema.appUser).where(sql`${schema.appUser.id} = ${userId}`))[0];

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
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
      supportView: false,
      orgRole: null,
      isControlling: false,
      isOperator: false,
      pendingApproval: false,
      // Ohne gespeicherte Sprache Deutsch (PLT-09).
      locale: 'de',
      // WG-01: ohne Organisation die Vorgabe
      categoryLabel: { singular: 'Warengruppe', plural: 'Warengruppen' },
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

  it.each(['admin', 'nutzer', 'leser', 'controlling'] as const)(
    'PLT-02: Ohne Organisation gibt auch die Rolle %s keinen Abschnitt Organisation frei',
    async (role) => {
      const token = await testApp.signToken({
        subject: userId,
        claims: { 'urn:zitadel:iam:org:project:test-project:roles': { [role]: { '1': 'test' } } },
      });
      const res = await testApp.get('/api/me', token);
      expect(await res.json()).toMatchObject({
        organization: null,
        permissions: { viewOrganizationSettings: false, viewBuyerAreas: false },
      });
    },
  );

  describe('PLT-02: Zuordnung zur Organisation über Zitadel', () => {
    const zitadelOrgId = `zitadel-${userId}`;
    const buyerOrg = randomUUID();
    const supplierOrg = randomUUID();
    const withZitadelOrg = (id: string | undefined) =>
      testApp.zitadel.replyUserinfo(() => ({
        status: 200,
        body: { ...ada, 'urn:zitadel:iam:user:resourceowner:id': id },
      }));

    beforeAll(async () => {
      await db.insert(schema.organization).values([
        { id: buyerOrg, name: `Me-Test-OEM ${userId}`, zitadelOrgId },
        { id: supplierOrg, name: `Me-Test-Lieferant ${userId}`, zitadelOrgId: `${zitadelOrgId}-l` },
      ]);
      await db
        .insert(schema.organizationFeature)
        .values({ organizationId: buyerOrg, feature: 'buyer' });
    });

    afterAll(async () => {
      await db.delete(schema.appUser).where(sql`${schema.appUser.id} = ${userId}`);
      await db
        .delete(schema.organization)
        .where(sql`${schema.organization.id} in ${[buyerOrg, supplierOrg]}`);
    });

    const leser = () =>
      testApp.signToken({
        subject: userId,
        claims: { 'urn:zitadel:iam:org:project:test-project:roles': { leser: { '1': 'test' } } },
      });

    it('Beim Login wird organization_id aus der Zitadel-Organisation gesetzt', async () => {
      withZitadelOrg(zitadelOrgId);
      const res = await testApp.post('/api/me/anmeldung', {}, await leser());
      expect(await res.json()).toMatchObject({
        organization: { id: buyerOrg, name: `Me-Test-OEM ${userId}` },
        permissions: { viewOrganizationSettings: true, viewBuyerAreas: true, viewSuppliers: true },
      });
      expect((await storedUser())?.organizationId).toBe(buyerOrg);
    });

    /** Neuer Nutzer mit diesen Rollen im Token; sie werden beim ersten Aufruf übernommen. */
    const freshWith = async (roles: string[]) => {
      await db.delete(schema.appUser).where(sql`${schema.appUser.id} = ${userId}`);
      return testApp.signToken({
        subject: userId,
        claims: {
          'urn:zitadel:iam:org:project:test-project:roles': Object.fromEntries(
            roles.map((role) => [role, { '1': 'test' }]),
          ),
        },
      });
    };
    const actionsOf = async (token: string) =>
      permissionsResponseSchema.parse(
        await (await testApp.get('/api/me/permissions', token)).json(),
      ).actions;

    it('PLT-11: Der Weg zu allen Einstellungen ist nur für Admins frei, Organisation sieht jedes Mitglied', async () => {
      withZitadelOrg(zitadelOrgId);
      for (const roles of [['leser'], ['nutzer'], ['controlling']]) {
        const token = await freshWith(roles);
        const res = await testApp.get('/api/me', token);
        expect(await res.json(), roles.join()).toMatchObject({
          permissions: { viewOrganizationSettings: true },
        });
        expect(await actionsOf(token), roles.join()).not.toContain('einstellungen.verwalten');
      }
      const token = await freshWith(['admin']);
      await testApp.get('/api/me', token);
      expect(await actionsOf(token)).toContain('einstellungen.verwalten');
    });

    it('Neue Nutzer sind viewer', async () => {
      withZitadelOrg(zitadelOrgId);
      const token = await freshWith([]);
      const res = await testApp.post('/api/me/anmeldung', {}, token);
      expect(await res.json()).toMatchObject({ orgRole: 'viewer', isControlling: false });
      expect((await storedUser())?.orgRole).toBe('viewer');
      expect(await actionsOf(token)).not.toContain('lieferanten.bearbeiten');
    });

    it('übernimmt die Zitadel-Rollen einmalig; danach zählt nur die Datenbank', async () => {
      withZitadelOrg(zitadelOrgId);
      const first = await freshWith(['nutzer', 'controlling']);
      expect(await (await testApp.get('/api/me', first)).json()).toMatchObject({
        orgRole: 'member',
        isControlling: true,
      });
      // Gleiche Person, jetzt mit admin im Token: Die Datenbank bleibt maßgeblich.
      const later = await testApp.signToken({
        subject: userId,
        claims: { 'urn:zitadel:iam:org:project:test-project:roles': { admin: { '1': 'test' } } },
      });
      expect(await (await testApp.get('/api/me', later)).json()).toMatchObject({
        orgRole: 'member',
      });
      expect(await actionsOf(later)).not.toContain('rollen.aendern');
    });

    it('Bei unbekannter Organisation bleibt das Feld leer', async () => {
      withZitadelOrg('zitadel-unbekannt');
      const res = await testApp.post('/api/me/anmeldung', {}, await leser());
      expect(await res.json()).toMatchObject({ organization: null, permissions: noPermissions });
      expect((await storedUser())?.organizationId).toBeNull();

      withZitadelOrg(undefined);
      await testApp.get('/api/me', await leser());
      expect((await storedUser())?.organizationId).toBeNull();
    });

    it('Ohne Feature buyer gibt es keine Käuferbereiche, aber die eigene Organisation', async () => {
      withZitadelOrg(`${zitadelOrgId}-l`);
      const res = await testApp.get('/api/me', await leser());
      expect(await res.json()).toMatchObject({
        organization: { id: supplierOrg },
        permissions: {
          viewOrganizationSettings: true,
          viewBuyerAreas: false,
          viewSuppliers: false,
        },
      });
    });
  });

  it('gibt ohne Rollen im Token keine Organisationseinstellungen frei', async () => {
    const res = await testApp.get('/api/me', await testApp.signToken({ subject: userId }));
    expect(await res.json()).toMatchObject({ permissions: noPermissions });
  });

  it('UMB-01: Die Zitadel-Rolle betreiber hat keine Wirkung mehr; nur is_operator zählt', async () => {
    const token = await testApp.signToken({
      subject: userId,
      claims: {
        'urn:zitadel:iam:org:project:test-project:roles': {
          betreiber: { org: 'reziproq' },
          unbekannt: { org: 'reziproq' },
        },
      },
    });
    const res = await testApp.get('/api/me', token);
    expect(await res.json()).toMatchObject({ isOperator: false, orgRole: null });

    // Mit dem Flag in der Datenbank (pnpm operator:set) ist die Person Betreiber.
    await db
      .update(schema.appUser)
      .set({ isOperator: true })
      .where(sql`${schema.appUser.id} = ${userId}`);
    const again = await testApp.get('/api/me', token);
    expect(await again.json()).toMatchObject({
      isOperator: true,
      permissions: { switchCustomer: true },
    });
  });

  it('PLT-01: Beim ersten Login wird app_user angelegt, bei jedem Login last_login_at aktualisiert', async () => {
    const token = await testApp.signToken({ subject: userId });

    const first = await testApp.post('/api/me/anmeldung', {}, token);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com' });
    const created = await storedUser();
    expect(created?.lastLoginAt).toBeInstanceOf(Date);

    // Ein normaler Aufruf von /api/me ist keine Anmeldung.
    await testApp.get('/api/me', token);
    expect((await storedUser())?.lastLoginAt).toEqual(created?.lastLoginAt);

    await testApp.post('/api/me/anmeldung', {}, token);
    const second = await storedUser();
    expect(second?.createdAt).toEqual(created?.createdAt);
    expect(second?.lastLoginAt?.getTime()).toBeGreaterThan(created?.lastLoginAt?.getTime() ?? 0);
  });

  it('legt über /api/me ohne Anmeldung kein last_login_at an', async () => {
    await testApp.get('/api/me', await testApp.signToken({ subject: userId }));
    expect((await storedUser())?.lastLoginAt).toBeNull();
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
