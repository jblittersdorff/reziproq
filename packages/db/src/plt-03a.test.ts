import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generatedLayerTables, layerRegister } from './layers.js';
import { seed, seedBuyers, seedSupplierOrg } from './seed.js';
import { type TenantSession, withTenant } from './tenant.js';
import { createTempDatabase, migrateTo } from './testing/temp-database.js';

// Tests zu docs/specs/PLT-03.md, Teil a, direkt in der Datenbank mit den Beispieldaten.
// Die allgemeinen Prüfungen aus PLT-04 laufen für relationship_side und relationship_spend in
// layers.test.ts; hier steht, was nur für die Beziehung selbst gilt.

const testOem = seedBuyers.testOem.id;
const zweitOem = seedBuyers.zweitOem.id;
const testSupplier = seedSupplierOrg.id;

describe('PLT-03a: Beziehungen in der Datenbank', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;
  const lastYear = new Date().getFullYear() - 1;

  const as = <T>(session: Omit<TenantSession, 'userId'>, query: ReturnType<typeof sql>) =>
    withTenant(temp.db, { userId: 'test-nutzer', ...session }, async (tx) => {
      const result = await tx.execute(query);
      return result.rows as T[];
    });

  /** Die Beziehung zwischen Test-Lieferant und einem OEM. */
  const testSupplierRelationship = async (buyer: string) => {
    const result = await temp.db.execute<{ id: string }>(
      sql`select id::text from relationship where buyer_org_id = ${buyer} and supplier_org_id = ${testSupplier}`,
    );
    return result.rows[0]?.id ?? '';
  };

  const setStatus = (id: string, status: string) =>
    temp.db.execute(sql`update relationship set status = ${status} where id = ${id}`);

  beforeAll(async () => {
    temp = await createTempDatabase();
    await migrateTo(temp.db);
    await seed(temp.db, { nodeEnv: 'development' });
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('Der Zweit-OEM sieht beim gemeinsamen Lieferanten weder Spend noch eigene Nummer oder Notizen des Test-OEM. Die Prüfungen aus PLT-04 laufen für alle drei Tabellen.', async () => {
    await temp.db.execute(sql`
      update relationship_side set notes = 'Nur intern beim Test-OEM'
      where org_id = ${testOem}
    `);
    const shared = sql`
      select r.buyer_org_id::text as kaeufer, rs.external_ref as nummer, rs.notes,
        sp.amount_cents::text as cent
      from relationship r
      join organization o on o.id = r.supplier_org_id
      left join relationship_side rs on rs.relationship_id = r.id
      left join relationship_spend sp on sp.relationship_id = r.id and sp.year = ${lastYear}
      where o.name = 'Rheintal Elektronik GmbH (Demo)'
    `;
    expect(await as({ organizationId: zweitOem }, shared)).toEqual([
      { kaeufer: zweitOem, nummer: 'ZW-4711', notes: null, cent: '105000000' },
    ]);
    expect(await as({ organizationId: testOem }, shared)).toEqual([
      { kaeufer: testOem, nummer: 'L-10001', notes: 'Nur intern beim Test-OEM', cent: '482000000' },
    ]);

    // Auch direkt abgefragt: keine Zeile des Test-OEM in einer der drei Tabellen.
    const foreign = await as<{ n: number }>(
      { organizationId: zweitOem },
      sql`select
        (select count(*) from relationship where buyer_org_id = ${testOem})
        + (select count(*) from relationship_side where org_id = ${testOem})
        + (select count(*) from relationship_spend sp
            where not exists (select 1 from relationship r where r.id = sp.relationship_id))
        as n`,
    );
    expect(Number(foreign[0]?.n)).toBe(0);

    // relationship_side und relationship_spend laufen durch das Gerüst aus PLT-04,
    // relationship hat als Anker eigene Policies und die Tests hier.
    expect(generatedLayerTables().map((entry) => entry.table)).toEqual([
      'relationship_side',
      'relationship_spend',
    ]);
    expect(layerRegister.relationship?.kind).toBe('shared');
  });

  it('Ein Nutzer des Test-Lieferanten sieht Beziehungen im Status draft nicht', async () => {
    const relationship = await testSupplierRelationship(testOem);
    const visible = (customer: string | null) =>
      as<{ id: string }>(
        { organizationId: testSupplier, customerOrganizationId: customer },
        sql`select id::text from relationship`,
      );
    const customerNames = (customer: string | null) =>
      as<{ name: string }>(
        { organizationId: testSupplier, customerOrganizationId: customer },
        sql`select name from organization where id <> ${testSupplier} order by name`,
      );

    // Im Entwurf: weder die Beziehung noch der Kunde, auch nicht mit gewähltem Kunden.
    expect(await visible(testOem)).toEqual([]);
    expect(await visible(null)).toEqual([]);
    expect(await customerNames(null)).toEqual([]);

    // Aktiv: Beziehung im Kontext dieses Kunden, Name und Land des Kunden.
    await setStatus(relationship, 'active');
    try {
      expect(await visible(testOem)).toEqual([{ id: relationship }]);
      expect(await visible(zweitOem)).toEqual([]);
      expect(await visible(null)).toEqual([]);
      expect(await customerNames(null)).toEqual([{ name: 'Test-OEM (Demo)' }]);
      // Nie Spend oder Einstellungen des Käufers.
      const buyerData = await as<{ n: number }>(
        { organizationId: testSupplier, customerOrganizationId: testOem },
        sql`select (select count(*) from relationship_spend) + (select count(*) from relationship_side) as n`,
      );
      expect(Number(buyerData[0]?.n)).toBe(0);

      // Beendet: wieder unsichtbar.
      await setStatus(relationship, 'ended');
      expect(await visible(testOem)).toEqual([]);
    } finally {
      await setStatus(relationship, 'draft');
    }
  });

  it('Andere Käufer sehen nicht, dass eine Beziehung besteht', async () => {
    const relationships = await as<{ buyer: string }>(
      { organizationId: zweitOem },
      sql`select distinct buyer_org_id::text as buyer from relationship`,
    );
    expect(relationships).toEqual([{ buyer: zweitOem }]);
    // Der Zweit-OEM sieht nur Lieferanten, mit denen er selbst eine Beziehung hat.
    const organizations = await as<{ n: number }>(
      { organizationId: zweitOem },
      sql`select count(*)::int as n from organization where id <> ${zweitOem}`,
    );
    expect(organizations[0]?.n).toBe(4);
  });

  it('Spend liegt in Cent in der Datenbank', async () => {
    const result = await temp.db.execute<{ type: string; cent: string }>(sql`
      select pg_typeof(amount_cents)::text as type, amount_cents::text as cent
      from relationship_spend sp join relationship r on r.id = sp.relationship_id
      join organization o on o.id = r.supplier_org_id
      where o.name = 'Rheintal Elektronik GmbH (Demo)' and r.buyer_org_id = ${testOem}
        and sp.year = ${lastYear}
    `);
    expect(result.rows).toEqual([{ type: 'bigint', cent: '482000000' }]);
  });
});
