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
      aktiveModelle: number;
    }>(sql`
      select
        (select count(*)::int from organization_feature where feature = 'buyer') as kaeufer,
        (select count(*)::int from organization) as organisationen,
        (select count(*)::int from relationship) as beziehungen,
        (select count(*)::int from relationship_spend) as privat,
        (select count(*)::int from app_user where id like 'demo-%') as nutzer,
        (select count(*)::int from segment_model where status = 'active') as "aktiveModelle"
    `);
    return result.rows[0];
  };

  // 15 Lieferanten beim Test-OEM, drei davon auch beim Zweit-OEM, der Test-Lieferant bei beiden;
  // Spend für zwei Jahre je Beziehung außer beim Test-Lieferanten (PLT-03).
  const expected = {
    kaeufer: 2,
    organisationen: 18,
    beziehungen: 20,
    privat: 36,
    nutzer: 8,
    aktiveModelle: 2,
  };

  it('PLT-02: legt Test-OEM, Zweit-OEM und Test-Lieferant mit ihren Nutzern an', async () => {
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
      { name: 'Test-OEM (Demo)', nutzer: 3, buyer: true },
      { name: 'Zweit-OEM (Demo)', nutzer: 3, buyer: true },
    ]);
  });

  it('PLT-02: ein zweiter Lauf erzeugt keine Duplikate', async () => {
    await seed(temp.db, { nodeEnv: 'development' });
    await seed(temp.db, { nodeEnv: 'development' });
    expect(await counts()).toEqual(expected);
  });

  it('SEG-03: legt eine laufende Runde mit zehn Lieferanten an, auch beim zweiten Lauf', async () => {
    await seed(temp.db, { nodeEnv: 'development' });
    await seed(temp.db, { nodeEnv: 'development' });
    const result = await temp.db.execute<{
      runden: number;
      lieferanten: number;
      status: string;
    }>(sql`
      select count(distinct r.id)::int as runden,
        count(distinct a.relationship_id)::int as lieferanten, min(r.status) as status
      from segmentation_round r join rating_assignment a on a.round_id = r.id
    `);
    expect(result.rows[0]).toEqual({ runden: 1, lieferanten: 10, status: 'open' });
  });

  it('SEG-01: legt für jede Käuferorganisation ein aktives Standardmodell an', async () => {
    await seed(temp.db, { nodeEnv: 'development' });
    const models = await temp.db.execute<{
      name: string;
      version: number;
      status: string;
      impact: number;
      quality: number;
      types: number;
    }>(sql`
      select o.name, m.version, m.status,
        count(distinct c.key) filter (where c.axis = 'impact')::int as impact,
        count(distinct c.key) filter (where c.axis = 'quality')::int as quality,
        count(distinct (t.impact_level, t.quality_level))::int as types
      from segment_model m
      join organization o on o.id = m.org_id
      left join segment_criterion c on c.model_id = m.id
      left join segment_type t on t.model_id = m.id
      where m.status = 'active'
      group by o.name, m.id
      order by o.name
    `);
    expect(models.rows).toEqual([
      {
        name: 'Test-OEM (Demo)',
        version: 1,
        status: 'active',
        impact: 6,
        quality: 4,
        types: 9,
      },
      {
        name: 'Zweit-OEM (Demo)',
        version: 1,
        status: 'active',
        impact: 6,
        quality: 4,
        types: 9,
      },
    ]);
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
      sql`select amount_cents::text as cent from relationship_spend limit 1`,
    );
    expect(spend.rows[0]?.cent).toMatch(/^\d+$/);
  });

  it('PLT-03: Beispieldaten mit Land, USt-IdNr. und Spend für zwei Jahre, drei Lieferanten auch beim Zweit-OEM, Test-Lieferant im Entwurf', async () => {
    const lastYear = new Date().getFullYear() - 1;
    const result = await temp.db.execute<{
      kaeufer: string;
      lieferanten: number;
      mit_ust: number;
      zwei_jahre: number;
      eigene_nummer: number;
    }>(sql`
      select b.name as kaeufer,
        count(*)::int as lieferanten,
        count(s.vat_id)::int as mit_ust,
        count(*) filter (where (
          select array_agg(year order by year) from relationship_spend sp where sp.relationship_id = r.id
        ) = array[${lastYear - 1}, ${lastYear}]::int[])::int as zwei_jahre,
        count(rs.external_ref)::int as eigene_nummer
      from relationship r
      join organization b on b.id = r.buyer_org_id
      join organization s on s.id = r.supplier_org_id
      left join relationship_side rs on rs.relationship_id = r.id and rs.org_id = r.buyer_org_id
      where r.status = 'active'
      group by b.name order by b.name
    `);
    expect(result.rows).toEqual([
      {
        kaeufer: 'Test-OEM (Demo)',
        lieferanten: 15,
        mit_ust: 15,
        zwei_jahre: 15,
        eigene_nummer: 15,
      },
      { kaeufer: 'Zweit-OEM (Demo)', lieferanten: 3, mit_ust: 3, zwei_jahre: 3, eigene_nummer: 3 },
    ]);

    // Beim gemeinsamen Lieferanten hat der Zweit-OEM eigene Werte.
    const shared = await temp.db.execute<{ kaeufer: string; cent: string; nummer: string }>(sql`
      select b.name as kaeufer, sp.amount_cents::text as cent, rs.external_ref as nummer
      from relationship r
      join organization b on b.id = r.buyer_org_id
      join organization s on s.id = r.supplier_org_id
      join relationship_spend sp on sp.relationship_id = r.id and sp.year = ${lastYear}
      join relationship_side rs on rs.relationship_id = r.id and rs.org_id = r.buyer_org_id
      where s.name = 'Rheintal Elektronik GmbH (Demo)' order by b.name
    `);
    expect(shared.rows).toEqual([
      { kaeufer: 'Test-OEM (Demo)', cent: '482000000', nummer: 'L-10001' },
      { kaeufer: 'Zweit-OEM (Demo)', cent: '105000000', nummer: 'ZW-4711' },
    ]);

    const drafts = await temp.db.execute<{ kaeufer: string }>(sql`
      select b.name as kaeufer from relationship r
      join organization b on b.id = r.buyer_org_id
      join organization s on s.id = r.supplier_org_id
      where s.name = 'Test-Lieferant (Demo)' and r.status = 'draft' order by b.name
    `);
    expect(drafts.rows.map((row) => row.kaeufer)).toEqual(['Test-OEM (Demo)', 'Zweit-OEM (Demo)']);
  });

  it('PLT-07b: --viele legt 50 zusätzliche Demo-Lieferanten wiederholbar an', async () => {
    const result = await seed(temp.db, { nodeEnv: 'development', many: true });
    expect(result.manySuppliers).toBe(50);
    let counts = await temp.db.execute<{ organizations: number; relationships: number }>(sql`
      select
        (select count(*)::int from organization) as organizations,
        (select count(*)::int from relationship) as relationships
    `);
    expect(counts.rows[0]).toEqual({ organizations: 68, relationships: 70 });

    await seed(temp.db, { nodeEnv: 'development', many: true });
    counts = await temp.db.execute(sql`
      select
        (select count(*)::int from organization) as organizations,
        (select count(*)::int from relationship) as relationships
    `);
    expect(counts.rows[0]).toEqual({ organizations: 68, relationships: 70 });
  });

  it('PLT-02: bricht bei NODE_ENV=production ab, ohne etwas zu schreiben', async () => {
    await temp.db.execute(sql`delete from relationship_spend`);
    await expect(seed(temp.db, { nodeEnv: 'production' })).rejects.toThrow(/production/);
    expect((await counts())?.privat).toBe(0);
  });
});
