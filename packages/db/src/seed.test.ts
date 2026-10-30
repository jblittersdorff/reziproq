import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seed, seedBuyers } from './seed.js';
import { createTempDatabase, migrateTo } from './testing/temp-database.js';

// PLT-02: pnpm db:seed legt beide Käufer, 15 Lieferanten und die Beziehungen an.
describe('db:seed', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;

  beforeAll(async () => {
    temp = await createTempDatabase();
    await migrateTo(temp.db);
    await temp.db.execute(
      sql`insert into app_user (id, name, email) values ('nutzer-1', 'Anna Schmidt', 'anna@example.com')`,
    );
  });

  afterAll(async () => {
    await temp.drop();
  });

  const counts = async () => {
    const result = await temp.db.execute<{
      kaeufer: number;
      lieferanten: number;
      beziehungen: number;
      privat: number;
    }>(sql`
      select
        (select count(*)::int from organization where typ = 'kaeufer') as kaeufer,
        (select count(*)::int from organization where typ = 'lieferant') as lieferanten,
        (select count(*)::int from beziehung) as beziehungen,
        (select count(*)::int from beziehung_kaeufer) as privat
    `);
    return result.rows[0];
  };

  it('legt zwei Käufer, 15 Lieferanten und 18 Beziehungen an', async () => {
    await seed(temp.db, { nodeEnv: 'development' });
    expect(await counts()).toEqual({ kaeufer: 2, lieferanten: 15, beziehungen: 18, privat: 18 });
  });

  it('erzeugt beim zweiten Lauf keine Duplikate', async () => {
    await seed(temp.db, { nodeEnv: 'development' });
    await seed(temp.db, { nodeEnv: 'development' });
    expect(await counts()).toEqual({ kaeufer: 2, lieferanten: 15, beziehungen: 18, privat: 18 });
  });

  it('ordnet alle vorhandenen Nutzer dem Beispiel-OEM zu', async () => {
    const result = await temp.db.execute<{ organization_id: string }>(
      sql`select organization_id from app_user`,
    );
    expect(result.rows).toEqual([{ organization_id: seedBuyers.beispielOem.id }]);
  });

  it('kennzeichnet alle Lieferanten als Demo und speichert Spend in Cent', async () => {
    const names = await temp.db.execute<{ name: string }>(
      sql`select name from organization where typ = 'lieferant' and name not like '%(Demo)'`,
    );
    expect(names.rows).toEqual([]);
    const spend = await temp.db.execute<{ cent: string }>(
      sql`select jahresspend_cent::text as cent from beziehung_kaeufer limit 1`,
    );
    expect(spend.rows[0]?.cent).toMatch(/^\d+$/);
  });

  it('bricht bei NODE_ENV=production ab, ohne etwas zu schreiben', async () => {
    await temp.db.execute(sql`delete from beziehung_kaeufer`);
    await expect(seed(temp.db, { nodeEnv: 'production' })).rejects.toThrow(/production/);
    expect((await counts())?.privat).toBe(0);
  });
});
