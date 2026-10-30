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

  const tables = ['organization', 'beziehung', 'beziehung_kaeufer'] as const;

  it.each(tables)('liefert aus %s ohne gesetzte Organisation keine Zeilen', async (table) => {
    const rows = await temp.db.transaction(async (tx) => {
      await tx.execute(sql`set local role reziproq_app`);
      return tx.execute(sql`select * from ${sql.identifier(table)}`);
    });
    expect(rows.rows).toEqual([]);
  });

  it('zeigt jedem Käufer nur seine eigenen Beziehungen', async () => {
    const count = (orgId: string) =>
      withTenant(temp.db, orgId, async (tx) => {
        const result = await tx.execute<{ n: number }>(
          sql`select count(*)::int as n from beziehung join beziehung_kaeufer on beziehung_id = id`,
        );
        return result.rows[0]?.n;
      });
    expect(await count(seedBuyers.beispielOem.id)).toBe(15);
    expect(await count(seedBuyers.zweitOem.id)).toBe(3);
  });

  it('zeigt beim selben Lieferanten jedem Käufer nur seine eigenen Werte', async () => {
    const valuesFor = (orgId: string) =>
      withTenant(temp.db, orgId, async (tx) => {
        const result = await tx.execute<{ warengruppe: string; cent: string }>(sql`
          select bk.warengruppe, bk.jahresspend_cent::text as cent
          from beziehung b
          join beziehung_kaeufer bk on bk.beziehung_id = b.id
          join organization o on o.id = b.lieferant_org_id
          where o.name = 'Rheintal Elektronik GmbH (Demo)'
        `);
        return result.rows;
      });
    expect(await valuesFor(seedBuyers.beispielOem.id)).toEqual([
      { warengruppe: 'Elektronik', cent: '482000000' },
    ]);
    expect(await valuesFor(seedBuyers.zweitOem.id)).toEqual([
      { warengruppe: 'Leiterplatten', cent: '105000000' },
    ]);
  });

  it('zeigt Organisationen nur, wenn sie die eigene oder ein eigener Lieferant sind', async () => {
    const names = await withTenant(temp.db, seedBuyers.zweitOem.id, async (tx) => {
      const result = await tx.execute<{ name: string }>(
        sql`select name from organization order by name`,
      );
      return result.rows.map((row) => row.name);
    });
    expect(names).toHaveLength(4);
    expect(names).toContain('Zweit-OEM (Demo)');
    expect(names).not.toContain('Beispiel-OEM (Demo)');
  });

  it('erlaubt der Rolle reziproq_app keine Änderungen', async () => {
    const error = await withTenant(temp.db, seedBuyers.beispielOem.id, (tx) =>
      tx.execute(sql`update beziehung_kaeufer set jahresspend_cent = 0`),
    ).catch((caught: unknown) => caught);
    // Drizzle verpackt den Fehler von PostgreSQL; die eigentliche Meldung steht in cause.
    expect(String((error as Error).cause)).toMatch(/permission denied/);
  });
});
