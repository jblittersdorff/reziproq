import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  customersResponseSchema,
  lastFullYear,
  meResponseSchema,
  promptEventSchema,
  supplierSchema,
  supportHeader,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
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
      await db.execute<{ organization_id: string | null; action: string }>(
        sql`select organization_id, action from support_access_log where user_id = ${user} order by occurred_at`,
      )
    ).rows;

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    const { organization, appUser } = schema;
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
    const year = lastFullYear();
    await insertRelationships(db, [
      {
        id: ids.relA,
        buyer: ids.oemA,
        supplier: ids.supplier,
        externalRef: 'A-1',
        spend: [{ year, amountCents: 111_00 }],
      },
      {
        id: ids.relAOnly,
        buyer: ids.oemA,
        supplier: ids.onlyA,
        externalRef: 'A-2',
        spend: [{ year, amountCents: 333_00 }],
      },
      {
        id: ids.relB,
        buyer: ids.oemB,
        supplier: ids.supplier,
        externalRef: 'B-1',
        spend: [{ year, amountCents: 222_00 }],
      },
    ]);
    // Der Betreiber selbst gehört zu keinem Kunden.
    await db.insert(appUser).values([
      // Betreiber sind nur, wer das Flag in der Datenbank hat (UMB-01).
      {
        id: users.operator,
        name: 'Olaf Betrieb',
        email: 'o@reziproq.test',
        organizationId: null,
        isOperator: true,
      },
      {
        id: users.auditor,
        name: 'Paula Protokoll',
        email: 'p@reziproq.test',
        organizationId: null,
        isOperator: true,
      },
      {
        id: users.adminA,
        name: 'Ada Admin',
        email: 'a@example.com',
        organizationId: ids.oemA,
        orgRole: 'admin',
      },
    ]);
  });

  afterAll(async () => {
    const { organization, appUser, supportAccessLog } = schema;
    const orgIds = Object.values(ids).slice(0, 4);
    await db
      .delete(supportAccessLog)
      .where(sql`${supportAccessLog.userId} in ${Object.values(users)}`);
    await db.delete(appUser).where(sql`${appUser.id} in ${Object.values(users)}`);
    await deleteRelationships(db, orgIds);
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
        action: 'GET /api/betreiber/kunden',
      });
    });

    it.each(['admin', 'nutzer', 'leser', 'controlling', 'betreiber'])(
      'ohne is_operator antwortet die API mit 403, auch für Admins und mit Zitadel-Rolle %s',
      async (role) => {
        const res = await testApp.get('/api/betreiber/kunden', await token(users.adminA, role));
        expect(res.status).toBe(403);
        // Auch der Wechsel in einen Kunden geht nicht.
        const inside = await testApp.get(
          '/api/suppliers',
          await token(users.adminA, role),
          'Bearer',
          asCustomer(ids.oemB),
        );
        expect(inside.status).toBe(403);
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
          externalRef: 'B-1',
          spend: { amountCents: 222_00 },
        },
      ]);
      expect(JSON.stringify(suppliers)).not.toContain('A-1');
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
      expect(suppliers.map((s) => [s.name, s.externalRef])).toEqual([
        [`Nur A ${run}`, 'A-2'],
        [`Gemeinsam ${run}`, 'A-1'],
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
      expect(shown.map((s) => s.externalRef)).toEqual(['B-1']);
    });

    it('protokolliert jeden Zugriff im Kunden mit Methode und Pfad', async () => {
      const operator = users.auditor;
      const headers = asCustomer(ids.oemA);
      await testApp.get('/api/suppliers', await token(operator, 'betreiber'), 'Bearer', headers);
      await testApp.get('/api/suppliers', await token(operator, 'betreiber'));
      expect(await auditFor(operator)).toEqual([
        { organization_id: ids.oemA, action: 'GET /api/suppliers' },
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
