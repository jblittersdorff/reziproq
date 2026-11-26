import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { demoSetup } from './demo-setup.js';
import { seedBuyers, seedSupplierOrg } from './seed.js';
import { createTempDatabase } from './testing/temp-database.js';

// pnpm demo:setup: Beispieldaten gehören danach den echten Konten, erfundene Personen und
// Reste aus Testläufen verschwinden.
describe('demo:setup', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;
  const query = async <T extends Record<string, unknown>>(statement: ReturnType<typeof sql>) =>
    (await temp.db.execute<T>(statement)).rows;

  beforeAll(async () => {
    temp = await createTempDatabase({ from: 'seeded' });
    // Echte Konten, wie sie beim ersten Login über Zitadel entstehen.
    await temp.db.execute(sql`
      insert into app_user (id, name, email, organization_id, org_role) values
        ('397517378608492587', 'OEM 1', 'oem1@example.com', ${seedBuyers.testOem.id}, 'viewer'),
        ('397517298547617835', 'Lieferant 1', 'lieferant1@example.com', ${seedSupplierOrg.id}, 'viewer')
    `);
    await temp.db.execute(sql`
      insert into organization (id, name) values ('01960000-0000-7000-8000-0000000000aa', 'FK-OEM b40e83f3')
    `);
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('bricht im Betrieb ab', async () => {
    await expect(demoSetup(temp.db, 'production')).rejects.toThrow(/lokale Entwicklung/);
  });

  it('macht das Käuferkonto zum Admin mit Controlling und SRO in jeder Beziehung', async () => {
    const result = await demoSetup(temp.db, 'development');
    expect(result.buyer?.name).toBe('OEM 1');
    expect(result.supplier?.name).toBe('Lieferant 1');
    const [buyer] = await query<{ org_role: string; is_controlling: boolean }>(
      sql`select org_role, is_controlling from app_user where id = '397517378608492587'`,
    );
    expect(buyer).toEqual({ org_role: 'admin', is_controlling: true });
    const missing = await query(sql`
      select r.id from relationship r where r.buyer_org_id = ${seedBuyers.testOem.id}
        and not exists (select 1 from relationship_member m where m.relationship_id = r.id
          and m.user_id = '397517378608492587' and m.team_role = 'sro')
    `);
    expect(missing).toEqual([]);
  });

  it('macht das Lieferantenkonto zum Admin und Key Account Manager bei jedem Kunden', async () => {
    const roles = await query<{ team_role: string }>(sql`
      select m.team_role from relationship_member m where m.user_id = '397517298547617835'
    `);
    expect(roles.length).toBe(2);
    expect(roles.every((row) => row.team_role === 'sro')).toBe(true);
  });

  it('erfundene Personen verschwinden; ihre Bewertungen, Freigaben und Einladungen gehören den Konten', async () => {
    expect(await query(sql`select id from app_user where id like 'demo-%'`)).toEqual([]);
    const raters = await query<{ rater_user_id: string }>(
      sql`select distinct rater_user_id from rating_assignment where rater_user_id is not null`,
    );
    expect(raters).toEqual([{ rater_user_id: '397517378608492587' }]);
    const approvals = await query<{ approved_by_name: string }>(
      sql`select distinct approved_by_name from rule_set where approved_by is not null`,
    );
    expect(approvals).toEqual([{ approved_by_name: 'OEM 1' }]);
    const invitations = await query<{ invited_by: string }>(
      sql`select distinct invited_by from invitation`,
    );
    expect(invitations).toEqual([{ invited_by: '397517378608492587' }]);
    // Auch abgeschlossene Termine gehen über, trotz Sperre (QBR-01b).
    const meetings = await query<{ created_by_name: string; status: string }>(
      sql`select created_by_name, status from meeting order by starts_at`,
    );
    // Dazu aus der Demo-Geschichte der Werksbesuch vor drei Tagen (KI-17) und der QBR in sieben Tagen
    expect(meetings).toEqual([
      { created_by_name: 'OEM 1', status: 'closed' },
      { created_by_name: 'OEM 1', status: 'held' },
      { created_by_name: 'OEM 1', status: 'planned' },
      { created_by_name: 'OEM 1', status: 'planned' },
    ]);
    // Zusagen und Aufgaben (früher Maßnahmen) gehören danach den Konten (QBR-03, ZQ-01).
    const owners = await query<{ owner_name: string }>(sql`
      select distinct owner_name from (
        select owner_name, owner_user_id from commitment union all
        select owner_name, owner_user_id from task) w
      where owner_user_id is not null`);
    expect(owners).toEqual([{ owner_name: 'OEM 1' }]);
  });

  it('räumt Reste aus Testläufen weg und lässt die Beispieldaten stehen', async () => {
    expect(await query(sql`select id from organization where name like 'FK-OEM%'`)).toEqual([]);
    const demo = await query<{ n: number }>(
      sql`select count(*)::int as n from organization where name like '%(Demo)%'`,
    );
    expect(demo[0]?.n).toBe(18);
  });

  it('legt die Demo-Geschichte an: Fokus, Plan, bestätigte Monate, Zusagen, Scorecard, QBR, Ziele', async () => {
    const count = async (table: string) =>
      Number(
        (
          await query<{ n: string }>(sql`select count(*)::text as n from ${sql.identifier(table)}`)
        )[0]?.n,
      );
    expect(await count('jbp')).toBe(2);
    expect(await count('initiative')).toBeGreaterThanOrEqual(2);
    // vier aus der Geschichte, eine überfällige Zusage des Lieferanten für die Frühwarnung (KI-16),
    // zwei aus dem Quartalsreview Q3 (früher geteilte Maßnahmen, ZQ-01 K2-a.3)
    expect(await count('commitment')).toBe(7);
    expect(await count('scorecard_kpi')).toBe(2);
    expect(await count('relationship_ebit_target')).toBe(1);
    const qbr = await query<{ id: string }>(sql`
      select id from meeting where type = 'quarterly_review' and starts_at::date = current_date + 7
        and relationship_id in (select id from relationship where supplier_org_id = ${seedSupplierOrg.id}
          and buyer_org_id = ${seedBuyers.testOem.id})`);
    expect(qbr).toHaveLength(1);
    const settings = await query<{ key: string }>(sql`
      select key from org_setting where org_id = ${seedBuyers.testOem.id} order by key`);
    expect(settings.map((row) => row.key)).toEqual(
      expect.arrayContaining(['ai_public_research', 'goal_ebit_year']),
    );
  });

  it('der Spend der Beispieldaten gehört der Haupt-Warengruppe, die Summe bleibt (NAV-10 1.1)', async () => {
    const rows = await query<{ grouped: string; ungrouped: string; primary_match: string }>(sql`
      select count(*) filter (where rs.material_group_id is not null)::text as grouped,
             count(*) filter (where rs.material_group_id is null)::text as ungrouped,
             count(*) filter (where rs.material_group_id = rmg.material_group_id)::text as primary_match
        from relationship_spend rs
        join relationship r on r.id = rs.relationship_id
        left join relationship_material_group rmg
          on rmg.relationship_id = r.id and rmg.is_primary
       where r.buyer_org_id = ${seedBuyers.testOem.id} and rmg.id is not null`);
    expect(Number(rows[0]?.grouped)).toBeGreaterThan(0);
    expect(rows[0]?.ungrouped).toBe('0');
    expect(rows[0]?.primary_match).toBe(rows[0]?.grouped);
  });

  it('ein zweiter Lauf ändert nichts mehr', async () => {
    const again = await demoSetup(temp.db, 'development');
    expect(again).toMatchObject({
      removedPeople: 0,
      removedTestOrganizations: 0,
      story: { created: false },
    });
    expect((await query<{ n: string }>(sql`select count(*)::text as n from jbp`))[0]?.n).toBe('2');
  });
});
