import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  customersResponseSchema,
  meResponseSchema,
  promptEventSchema,
  supplierSchema,
  supportHeader,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PLT-13.md: Betreiber-Zugang zu Kunden.
describe('Betreiber-Zugang', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;

  const run = randomUUID().slice(0, 8);
  const ids = {
    oemA: randomUUID(),
    oemB: randomUUID(),
    supplier: randomUUID(),
    onlyA: randomUUID(),
    relA: randomUUID(),
    relAOnly: randomUUID(),
    relB: randomUUID(),
  };
  const users = {
    operator: `betreiber-${run}`,
    auditor: `betreiber-protokoll-${run}`,
    adminA: `admin-a-${run}`,
  };
  const names = { a: `Betreiber-OEM A ${run}`, b: `Betreiber-OEM B ${run}` };

  const token = (user: string, role: string) =>
    testApp.signToken({
      subject: user,
      claims: { 'urn:zitadel:iam:org:project:test-project:roles': { [role]: { '1': 'test' } } },
    });
  const asCustomer = (customerId: string) => ({ [supportHeader]: customerId });
  const suppliersOf = async (res: Response) =>
    z.object({ suppliers: z.array(supplierSchema) }).parse(await res.json()).suppliers;
  const auditFor = async (user: string) =>
    (
      await db.execute<{ organization_id: string | null; aktion: string }>(
        sql`select organization_id, aktion from betreiber_zugriff where nutzer_id = ${user} order by zeitpunkt`,
      )
    ).rows;

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    const { organization, beziehung, beziehungKaeufer, appUser } = schema;
    await db.insert(organization).values([
      { id: ids.oemA, name: names.a, country: 'DE' },
      { id: ids.oemB, name: names.b, country: 'AT' },
      { id: ids.supplier, name: `Gemeinsam ${run}`, country: 'PL' },
      { id: ids.onlyA, name: `Nur A ${run}`, country: 'CZ' },
    ]);
    // Käuferfunktionen über das Feature buyer (PLT-02).
    await db.insert(schema.organizationFeature).values([
      { organizationId: ids.oemA, feature: 'buyer' as const },
      { organizationId: ids.oemB, feature: 'buyer' as const },
    ]);
    await db.insert(beziehung).values([
      { id: ids.relA, kaeuferOrgId: ids.oemA, lieferantOrgId: ids.supplier },
      { id: ids.relAOnly, kaeuferOrgId: ids.oemA, lieferantOrgId: ids.onlyA },
      { id: ids.relB, kaeuferOrgId: ids.oemB, lieferantOrgId: ids.supplier },
    ]);
    await db.insert(beziehungKaeufer).values([
      { beziehungId: ids.relA, warengruppe: 'Guss', jahresspendCent: 111_00, spendJahr: 2025 },
      {
        beziehungId: ids.relAOnly,
        warengruppe: 'Logistik',
        jahresspendCent: 333_00,
        spendJahr: 2025,
      },
      {
        beziehungId: ids.relB,
        warengruppe: 'Schmiedeteile',
        jahresspendCent: 222_00,
        spendJahr: 2025,
      },
    ]);
    // Der Betreiber selbst gehört zu keinem Kunden.
    await db.insert(appUser).values([
      { id: users.operator, name: 'Olaf Betrieb', email: 'o@reziproq.test', organizationId: null },
      { id: users.adminA, name: 'Ada Admin', email: 'a@example.com', organizationId: ids.oemA },
    ]);
  });

  afterAll(async () => {
    const { organization, beziehung, appUser, betreiberZugriff } = schema;
    const orgIds = Object.values(ids).slice(0, 4);
    await db
      .delete(betreiberZugriff)
      .where(sql`${betreiberZugriff.nutzerId} in ${Object.values(users)}`);
    await db.delete(appUser).where(sql`${appUser.id} in ${Object.values(users)}`);
    await db.delete(beziehung).where(sql`${beziehung.kaeuferOrgId} in ${orgIds}`);
    await db.delete(organization).where(sql`${organization.id} in ${orgIds}`);
    await testApp.close();
  });

  describe('Kundenliste', () => {
    it('zeigt Betreibern alle Käufer, keine Lieferanten, und protokolliert den Abruf', async () => {
      const res = await testApp.get(
        '/api/betreiber/kunden',
        await token(users.operator, 'betreiber'),
      );
      expect(res.status).toBe(200);
      const { customers } = customersResponseSchema.parse(await res.json());
      const ours = customers.filter((customer) => customer.name.endsWith(run));
      expect(ours).toEqual([
        { id: ids.oemA, name: names.a, country: 'DE' },
        { id: ids.oemB, name: names.b, country: 'AT' },
      ]);
      expect(customers.map((c) => c.name)).not.toContain(`Gemeinsam ${run}`);
      expect(await auditFor(users.operator)).toContainEqual({
        organization_id: null,
        aktion: 'GET /api/betreiber/kunden',
      });
    });

    it.each(['admin', 'nutzer', 'leser', 'controlling'])(
      'verweigert sie der Rolle %s',
      async (role) => {
        const res = await testApp.get('/api/betreiber/kunden', await token(users.adminA, role));
        expect(res.status).toBe(403);
      },
    );
  });

  describe('In einen Kunden wechseln', () => {
    it('zeigt im Kunden B genau dessen Lieferanten und Werte', async () => {
      const res = await testApp.get(
        '/api/suppliers',
        await token(users.operator, 'betreiber'),
        'Bearer',
        asCustomer(ids.oemB),
      );
      expect(res.status).toBe(200);
      const suppliers = await suppliersOf(res);
      expect(suppliers).toMatchObject([
        {
          name: `Gemeinsam ${run}`,
          category: 'Schmiedeteile',
          annualSpend: { amountCents: 222_00 },
        },
      ]);
      expect(JSON.stringify(suppliers)).not.toContain('Guss');
      expect(JSON.stringify(suppliers)).not.toContain(`Nur A ${run}`);
    });

    it('zeigt im Kunden A dessen Werte, nicht die von B', async () => {
      const suppliers = await suppliersOf(
        await testApp.get(
          '/api/suppliers',
          await token(users.operator, 'betreiber'),
          'Bearer',
          asCustomer(ids.oemA),
        ),
      );
      expect(suppliers.map((s) => [s.name, s.category])).toEqual([
        [`Nur A ${run}`, 'Logistik'],
        [`Gemeinsam ${run}`, 'Guss'],
      ]);
    });

    it('meldet in /me den gewählten Kunden und die Betreiber-Ansicht', async () => {
      testApp.zitadel.replyUserinfo(() => ({
        status: 200,
        body: { sub: users.operator, name: 'Olaf Betrieb', email: 'o@reziproq.test' },
      }));
      const res = await testApp.get(
        '/api/me',
        await token(users.operator, 'betreiber'),
        'Bearer',
        asCustomer(ids.oemB),
      );
      expect(meResponseSchema.parse(await res.json())).toMatchObject({
        organization: { id: ids.oemB, name: names.b },
        supportView: true,
        // Im Kunden sieht der Betreiber, was dessen Mitglieder sehen, auch die Organisation (PLT-02).
        permissions: { viewSuppliers: true, switchCustomer: true, viewOrganizationSettings: true },
      });
    });

    it('antwortet im Prompt-Fenster mit den Daten des gewählten Kunden', async () => {
      const res = await testApp.post(
        '/api/prompt',
        {
          messages: [{ role: 'user', content: 'Zeig mir die Lieferanten mit dem höchsten Spend' }],
        },
        await token(users.operator, 'betreiber'),
        asCustomer(ids.oemB),
      );
      const events = (await res.text())
        .trim()
        .split('\n')
        .map((line) => promptEventSchema.parse(JSON.parse(line)));
      const shown = events.flatMap((event) => (event.type === 'suppliers' ? event.suppliers : []));
      expect(shown.map((s) => s.category)).toEqual(['Schmiedeteile']);
    });

    it('protokolliert jeden Zugriff im Kunden mit Methode und Pfad', async () => {
      const operator = users.auditor;
      const headers = asCustomer(ids.oemA);
      await testApp.get('/api/suppliers', await token(operator, 'betreiber'), 'Bearer', headers);
      await testApp.get('/api/suppliers', await token(operator, 'betreiber'));
      expect(await auditFor(operator)).toEqual([
        { organization_id: ids.oemA, aktion: 'GET /api/suppliers' },
      ]);
    });
  });

  describe('Abgelehnte Wechsel', () => {
    it('verweigert den Header jedem außer Betreibern, auch einem Admin, und protokolliert nichts', async () => {
      const res = await testApp.get(
        '/api/suppliers',
        await token(users.adminA, 'admin'),
        'Bearer',
        asCustomer(ids.oemB),
      );
      expect(res.status).toBe(403);
      expect(await auditFor(users.adminA)).toEqual([]);
    });

    it('antwortet bei einem Lieferanten oder unbekannten Kunden mit 404', async () => {
      for (const customerId of [ids.supplier, randomUUID()]) {
        const res = await testApp.get(
          '/api/suppliers',
          await token(users.operator, 'betreiber'),
          'Bearer',
          asCustomer(customerId),
        );
        expect(res.status).toBe(404);
      }
    });

    it('antwortet bei einer ungültigen Kunden-ID mit 400', async () => {
      const res = await testApp.get(
        '/api/suppliers',
        await token(users.operator, 'betreiber'),
        'Bearer',
        asCustomer('kein-uuid'),
      );
      expect(res.status).toBe(400);
    });

    it('lässt einen Betreiber ohne gewählten Kunden keine fremden Daten sehen', async () => {
      const res = await testApp.get('/api/suppliers', await token(users.operator, 'betreiber'));
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: 'keine_organisation' });
    });
  });
});
