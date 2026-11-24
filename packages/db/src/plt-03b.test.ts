import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedBuyers, seedSupplierOrg } from './seed.js';
import { type TenantSession, withTenant } from './tenant.js';
import { createTempDatabase } from './testing/temp-database.js';

// Tests zu docs/specs/PLT-03.md, Teil b, direkt in der Datenbank: Lieferanten finden oder anlegen,
// ohne fremde Organisationen preiszugeben.

const testOem = seedBuyers.testOem.id;
const zweitOem = seedBuyers.zweitOem.id;

describe('PLT-03b: Lieferanten anlegen in der Datenbank', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;

  const as = <T>(session: Omit<TenantSession, 'userId'>, query: ReturnType<typeof sql>) =>
    withTenant(temp.db, { userId: 'test-nutzer', ...session }, async (tx) => {
      const result = await tx.execute(query);
      return result.rows as T[];
    });

  beforeAll(async () => {
    temp = await createTempDatabase({ from: 'seeded' });
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('Zwei Käufer legen einen Lieferanten mit derselben USt-IdNr. an. Danach gibt es eine Organisation und zwei Beziehungen.', async () => {
    const first = await as<{ id: string; existed: boolean }>(
      { organizationId: testOem },
      sql`select id::text, existed from app_lieferant_finden_oder_anlegen('Neu (Demo)', 'DE', 'DE111222333', null)`,
    );
    const second = await as<{ id: string; existed: boolean }>(
      { organizationId: zweitOem },
      sql`select id::text, existed from app_lieferant_finden_oder_anlegen('Anders (Demo)', 'PL', 'DE111222333', null)`,
    );
    expect(first[0]?.existed).toBe(false);
    expect(second).toEqual([{ id: first[0]?.id, existed: true }]);
    // Die Funktion gibt nur ID und „existierte“ zurück, nie Name oder Land.
    expect(Object.keys(second[0] ?? {}).sort()).toEqual(['existed', 'id']);

    for (const [buyer, rows] of [
      [testOem, first],
      [zweitOem, second],
    ] as const) {
      await as(
        { organizationId: buyer },
        sql`
        insert into relationship (buyer_org_id, supplier_org_id, status)
        values (${buyer}, ${rows[0]?.id}, 'draft')
      `,
      );
    }
    const count = await temp.db.execute<{ orgs: number; relationships: number }>(sql`
      select (select count(*)::int from organization where vat_id = 'DE111222333') as orgs,
        (select count(*)::int from relationship r join organization o on o.id = r.supplier_org_id
          where o.vat_id = 'DE111222333') as relationships
    `);
    expect(count.rows[0]).toEqual({ orgs: 1, relationships: 2 });
  });

  it('Ohne USt-IdNr. und D-U-N-S entsteht eine neue Organisation', async () => {
    const make = () =>
      as<{ id: string; existed: boolean }>(
        { organizationId: testOem },
        sql`select id::text, existed from app_lieferant_finden_oder_anlegen('Gleicher Name (Demo)', 'IT', null, null)`,
      );
    const [a] = await make();
    const [b] = await make();
    expect(a?.existed).toBe(false);
    expect(b?.existed).toBe(false);
    expect(a?.id).not.toBe(b?.id);
  });

  it('meldet bekannte Nummern nur als ja oder nein, und nur Käufern', async () => {
    await temp.db.execute(
      sql`update organization set vat_id = 'PL999888777' where id = ${seedSupplierOrg.id}`,
    );
    const known = await as<{ known: boolean }>(
      { organizationId: zweitOem },
      sql`select app_lieferant_bekannt('PL999888777', null) as known`,
    );
    expect(known).toEqual([{ known: true }]);
    const unknown = await as<{ known: boolean }>(
      { organizationId: zweitOem },
      sql`select app_lieferant_bekannt('PL000000000', '123456789') as known`,
    );
    expect(unknown).toEqual([{ known: false }]);

    // Ein Lieferant ohne Käuferfunktionen darf weder suchen noch anlegen.
    for (const query of [
      sql`select app_lieferant_bekannt('PL999888777', null)`,
      sql`select * from app_lieferant_finden_oder_anlegen('X', 'DE', null, null)`,
    ]) {
      const error = await as({ organizationId: seedSupplierOrg.id }, query).catch(
        (caught: unknown) => caught,
      );
      expect(String((error as Error).cause)).toMatch(/Nur Käufer/);
    }
  });

  it('verweigert die eigene Organisation als Lieferanten', async () => {
    await temp.db.execute(
      sql`update organization set vat_id = 'DE000000001' where id = ${testOem}`,
    );
    const error = await as(
      { organizationId: testOem },
      sql`select * from app_lieferant_finden_oder_anlegen('Ich', 'DE', 'DE000000001', null)`,
    ).catch((caught: unknown) => caught);
    expect(String((error as Error).cause)).toMatch(/eigene Organisation/);
  });

  it('Neue Beziehungen beginnen als Entwurf; nur der Käufer legt sie an', async () => {
    // Die ID als Eigentümer holen: Fremde Lieferanten sieht der Zweit-OEM unter RLS gar nicht.
    const supplier = (
      await temp.db.execute<{ id: string }>(
        sql`select id::text from organization where name = 'Danubia Spedition Kft. (Demo)'`,
      )
    ).rows[0]?.id;
    const insert = (buyer: string, asOrg: string, status: string) =>
      as(
        { organizationId: asOrg },
        sql`
        insert into relationship (buyer_org_id, supplier_org_id, status)
        values (${buyer}, ${supplier}, ${status})
      `,
      ).catch((caught: unknown) => caught);
    expect(String(((await insert(zweitOem, zweitOem, 'active')) as Error).cause)).toMatch(
      /row-level security/,
    );
    expect(String(((await insert(zweitOem, testOem, 'draft')) as Error).cause)).toMatch(
      /row-level security/,
    );
    expect(await insert(zweitOem, zweitOem, 'draft')).toEqual([]);
  });
});
