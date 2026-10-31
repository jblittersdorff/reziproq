import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seed } from './seed.js';
import { createTempDatabase, migrateTo } from './testing/temp-database.js';

// PLT-02: pnpm db:seed legt Test-OEM, Zweit-OEM, Test-Lieferant, 15 Lieferanten und die Beziehungen an.
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
      organisationen: number;
      beziehungen: number;
      privat: number;
      nutzer: number;
    }>(sql`
      select
        (select count(*)::int from organization_feature where feature = 'buyer') as kaeufer,
        (select count(*)::int from organization) as organisationen,
        (select count(*)::int from beziehung) as beziehungen,
        (select count(*)::int from beziehung_kaeufer) as privat,
        (select count(*)::int from app_user where id like 'demo-%') as nutzer
    `);
    return result.rows[0];
  };

  const expected = { kaeufer: 2, organisationen: 18, beziehungen: 18, privat: 18, nutzer: 6 };

  it('PLT-02: legt Test-OEM, Zweit-OEM und Test-Lieferant mit je zwei Nutzern an', async () => {
    await seed(temp.db, { nodeEnv: 'development' });
    expect(await counts()).toEqual(expected);

    const members = await temp.db.execute<{ name: string; nutzer: number; buyer: boolean }>(sql`
      select o.name, count(u.id)::int as nutzer,
        exists (select 1 from organization_feature f where f.organization_id = o.id and f.feature = 'buyer') as buyer
      from organization o join app_user u on u.organization_id = o.id
      group by o.id order by o.name
    `);
    expect(members.rows).toEqual([
      { name: 'Test-Lieferant (Demo)', nutzer: 2, buyer: false },
      { name: 'Test-OEM (Demo)', nutzer: 2, buyer: true },
      { name: 'Zweit-OEM (Demo)', nutzer: 2, buyer: true },
    ]);
  });

  it('PLT-02: ein zweiter Lauf erzeugt keine Duplikate', async () => {
    await seed(temp.db, { nodeEnv: 'development' });
    await seed(temp.db, { nodeEnv: 'development' });
    expect(await counts()).toEqual(expected);
  });

  it('ordnet vorhandene Nutzer nicht mehr zu; das macht der Login über Zitadel', async () => {
    const result = await temp.db.execute<{ organization_id: string | null }>(
      sql`select organization_id from app_user where id = 'nutzer-1'`,
    );
    expect(result.rows).toEqual([{ organization_id: null }]);
  });

  it('kennzeichnet alle Organisationen als Demo und speichert Spend in Cent', async () => {
    const names = await temp.db.execute<{ name: string }>(
      sql`select name from organization where name not like '%(Demo)'`,
    );
    expect(names.rows).toEqual([]);
    const spend = await temp.db.execute<{ cent: string }>(
      sql`select jahresspend_cent::text as cent from beziehung_kaeufer limit 1`,
    );
    expect(spend.rows[0]?.cent).toMatch(/^\d+$/);
  });

  it('PLT-02: bricht bei NODE_ENV=production ab, ohne etwas zu schreiben', async () => {
    await temp.db.execute(sql`delete from beziehung_kaeufer`);
    await expect(seed(temp.db, { nodeEnv: 'production' })).rejects.toThrow(/production/);
    expect((await counts())?.privat).toBe(0);
  });
});
