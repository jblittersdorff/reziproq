import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seed, seedBuyers } from './seed.js';
import { withTenant } from './tenant.js';
import { createTempDatabase, migrateTo } from './testing/temp-database.js';

// PLT-02: RLS greift auch direkt in der Datenbank, unabhängig von der API.
describe('Row-Level Security', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;

  beforeAll(async () => {
    temp = await createTempDatabase();
    await migrateTo(temp.db);
    await seed(temp.db, { nodeEnv: 'development' });
  });

  afterAll(async () => {
    await temp.drop();
  });

  const tables = [
    'organization',
    'organization_feature',
    'app_user',
    'relationship',
    'relationship_side',
    'relationship_spend',
  ] as const;

  it.each(tables)('liefert aus %s ohne gesetzte Organisation keine Zeilen', async (table) => {
    const rows = await temp.db.transaction(async (tx) => {
      await tx.execute(sql`set local role reziproq_app`);
      return tx.execute(sql`select * from ${sql.identifier(table)}`);
    });
    expect(rows.rows).toEqual([]);
  });

  it('zeigt jedem Käufer nur seine eigenen Beziehungen', async () => {
    const count = (orgId: string) =>
      withTenant(temp.db, { userId: 'test-nutzer', organizationId: orgId }, async (tx) => {
        const result = await tx.execute<{ n: number }>(
          sql`select count(*)::int as n from relationship where status = 'active'`,
        );
        return result.rows[0]?.n;
      });
    expect(await count(seedBuyers.testOem.id)).toBe(15);
    expect(await count(seedBuyers.zweitOem.id)).toBe(3);
  });

  it('zeigt beim selben Lieferanten jedem Käufer nur seine eigenen Werte', async () => {
    const valuesFor = (orgId: string) =>
      withTenant(temp.db, { userId: 'test-nutzer', organizationId: orgId }, async (tx) => {
        const result = await tx.execute<{ nummer: string; cent: string }>(sql`
          select rs.external_ref as nummer, sp.amount_cents::text as cent
          from relationship r
          join relationship_side rs on rs.relationship_id = r.id
          join relationship_spend sp on sp.relationship_id = r.id
            and sp.year = extract(year from now())::int - 1
          join organization o on o.id = r.supplier_org_id
          where o.name = 'Rheintal Elektronik GmbH (Demo)'
        `);
        return result.rows;
      });
    expect(await valuesFor(seedBuyers.testOem.id)).toEqual([
      { nummer: 'L-10001', cent: '482000000' },
    ]);
    expect(await valuesFor(seedBuyers.zweitOem.id)).toEqual([
      { nummer: 'ZW-4711', cent: '105000000' },
    ]);
  });

  it('zeigt Organisationen nur, wenn sie die eigene oder ein eigener Lieferant sind', async () => {
    const names = await withTenant(
      temp.db,
      { userId: 'test-nutzer', organizationId: seedBuyers.zweitOem.id },
      async (tx) => {
        const result = await tx.execute<{ name: string }>(
          sql`select name from organization order by name`,
        );
        return result.rows.map((row) => row.name);
      },
    );
    // Die eigene, drei Lieferanten und der Test-Lieferant (Entwurf, PLT-03).
    expect(names).toHaveLength(5);
    expect(names).toContain('Zweit-OEM (Demo)');
    expect(names).toContain('Test-Lieferant (Demo)');
    expect(names).not.toContain('Beispiel-OEM (Demo)');
  });

  it('erlaubt der Rolle reziproq_app keine Änderungen an Beziehungen (kommt mit PLT-03b)', async () => {
    const error = await withTenant(
      temp.db,
      { userId: 'test-nutzer', organizationId: seedBuyers.testOem.id },
      (tx) => tx.execute(sql`update relationship set status = 'ended'`),
    ).catch((caught: unknown) => caught);
    // Drizzle verpackt den Fehler von PostgreSQL; die eigentliche Meldung steht in cause.
    expect(String((error as Error).cause)).toMatch(/permission denied/);
  });
});
