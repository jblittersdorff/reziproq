import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hollmann, hollmannPeople, hollmannStart, seedHollmann } from './hollmann.js';
import { withTenant } from './tenant.js';
import { createTempDatabase } from './testing/temp-database.js';

// DM-01 (K1-g.1), T1-DM3: Der Seed hält den Stand „start“ fest; „Zurücksetzen“ lädt ihn für alle
// Organisationen der Demo, auch über gesperrte Termine hinweg. Aufzeichnungen der KI und das
// Protokoll der Regie bleiben, echte Mandanten bleiben unberührt, und nur ein Demo-Mandant darf es.
describe('Demo-Regie: Stand „start“ und Zurücksetzen', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;
  const real = { org: randomUUID(), supplier: randomUUID(), user: `echt-${randomUUID()}` };
  const query = async <T extends Record<string, unknown>>(statement: ReturnType<typeof sql>) =>
    (await temp.db.execute<T>(statement)).rows;
  /** In der Mandanten-Session von Jan-Luka (Rolle reziproq_app), wie die API */
  const asJanLuka = <T extends Record<string, unknown>>(statement: ReturnType<typeof sql>) =>
    withTenant(
      temp.db,
      { userId: hollmannPeople.janLuka.id, organizationId: hollmann.org.id },
      async (tx) => (await tx.execute<T>(statement)).rows,
    );
  const asRealCustomer = <T extends Record<string, unknown>>(statement: ReturnType<typeof sql>) =>
    withTenant(
      temp.db,
      { userId: real.user, organizationId: real.org },
      async (tx) => (await tx.execute<T>(statement)).rows,
    );
  /** Fingerabdruck der Demo: je Tabelle Zahl und Inhalt der Zeilen der Organisationen der Demo */
  const fingerprint = async () =>
    query<{ meetings: string; members: number; users: number; spend: number }>(sql`
      select
        (select md5(string_agg(to_jsonb(m)::text, ',' order by m.id)) from meeting m
          where m.owner_org_id = ${hollmann.org.id}) as meetings,
        (select count(*)::int from relationship_member m join relationship r on r.id = m.relationship_id
          where r.buyer_org_id = ${hollmann.org.id}) as members,
        (select count(*)::int from app_user u join organization o on o.id = u.organization_id
          where o.is_demo) as users,
        (select count(*)::int from relationship_spend s join relationship r on r.id = s.relationship_id
          where r.buyer_org_id = ${hollmann.org.id}) as spend`);

  beforeAll(async () => {
    temp = await createTempDatabase({ from: 'migrated' });
    await seedHollmann(temp.db, { nodeEnv: 'development' });
    // Ein echter Kunde mit Person und Lieferant: Das Zurücksetzen darf ihn nie berühren
    await temp.db.execute(sql`insert into organization (id, name) values
      (${real.org}, 'Echter Kunde'), (${real.supplier}, 'Echter Lieferant')`);
    await temp.db.execute(sql`insert into app_user (id, name, email, organization_id)
      values (${real.user}, 'Echte Person', 'echt@kunde.example', ${real.org})`);
    await temp.db.execute(
      sql`insert into relationship (buyer_org_id, supplier_org_id) values (${real.org}, ${real.supplier})`,
    );
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('der Seed hält „start“ fest: Mo 23.11., 07:30, mit den Tabellen der Demo', async () => {
    const [snapshot] = await query<{ key: string; demo_now: Date; tables: string[] }>(sql`
      select key, demo_now, array(select jsonb_object_keys(data) order by 1) as tables
      from demo_snapshot where org_id = ${hollmann.org.id}`);
    expect(snapshot?.key).toBe('start');
    expect(new Date(snapshot?.demo_now ?? 0).toISOString()).toBe(hollmannStart.toISOString());
    expect(snapshot?.tables).toEqual(
      expect.arrayContaining(['app_user', 'meeting', 'relationship', 'relationship_member']),
    );
    expect(snapshot?.tables).not.toContain('organization');
  });

  it('Zurücksetzen stellt den Stand her, auch nach geschlossenem Termin; Aufzeichnungen und Protokoll bleiben', async () => {
    const before = await fingerprint();
    // Die Vorführung ändert Uhr, Termine und Team, legt Neues an und schließt den JBP
    const [moved] = await asJanLuka<{ count: number }>(
      sql`select app_demo_uhr_setzen('2026-12-04T09:00:00Z') as count`,
    );
    // Alle Organisationen der Demo: Hollmann, Halder, 16 Lieferanten mit Beziehung und 30 importierte
    // im Portfolio (K2-b.2)
    expect(moved?.count).toBe(48);
    await temp.db.execute(sql`update meeting set title = 'Umbenannt', status = 'closed'
      where owner_org_id = ${hollmann.org.id} and type = 'jbp'`);
    await temp.db.execute(sql`delete from relationship_member
      where user_id = ${hollmannPeople.janLuka.id} and team_role = 'sro'
        and relationship_id = (select relationship_id from relationship_member
          where user_id = ${hollmannPeople.janLuka.id} and team_role = 'sro' limit 1)`);
    await temp.db.execute(sql`insert into meeting
      (relationship_id, owner_org_id, visibility, type, title, starts_at, duration_minutes,
       created_by, created_by_name)
      select relationship_id, owner_org_id, visibility, type, 'Neu in der Vorführung', starts_at,
        duration_minutes, created_by, created_by_name
      from meeting where owner_org_id = ${hollmann.org.id} and type = 'jbp'`);
    await temp.db.execute(sql`insert into model_call_recording (org_id, feature, input_hash, response, model_id)
      values (${hollmann.org.id}, 'prompt', 'hash-1', '{"parts":[]}', 'modell')`);
    await asJanLuka(sql`insert into demo_event (org_id, kind, actor_user_id)
      values (${hollmann.org.id}, 'zeit.datum', ${hollmannPeople.janLuka.id})`);
    expect(await fingerprint()).not.toEqual(before);

    const [reset] = await asJanLuka<{ demo_now: Date }>(
      sql`select app_demo_stand_laden('start') as demo_now`,
    );
    expect(new Date(reset?.demo_now ?? 0).toISOString()).toBe(hollmannStart.toISOString());
    expect(await fingerprint()).toEqual(before);
    const clocks = await query<{ demo_now: Date }>(
      sql`select distinct demo_now from organization where is_demo`,
    );
    expect(clocks.map((row) => new Date(row.demo_now).toISOString())).toEqual([
      hollmannStart.toISOString(),
    ]);
    const kept = await query<{ recordings: number; events: number }>(sql`select
      (select count(*)::int from model_call_recording where org_id = ${hollmann.org.id}) as recordings,
      (select count(*)::int from demo_event where org_id = ${hollmann.org.id}) as events`);
    expect(kept).toEqual([{ recordings: 1, events: 1 }]);
    // Der echte Kunde ist unberührt
    const untouched = await query<{ users: number; relationships: number }>(sql`select
      (select count(*)::int from app_user where organization_id = ${real.org}) as users,
      (select count(*)::int from relationship where buyer_org_id = ${real.org}) as relationships`);
    expect(untouched).toEqual([{ users: 1, relationships: 1 }]);
  });

  it('nur ein Demo-Mandant setzt zurück oder stellt die Uhr; ein echter Kunde nicht', async () => {
    await expect(asRealCustomer(sql`select app_demo_stand_laden('start')`)).rejects.toMatchObject({
      cause: { code: '42501' },
    });
    expect(
      await asRealCustomer<{ count: number }>(
        sql`select app_demo_uhr_setzen('2026-12-04T09:00:00Z') as count`,
      ),
    ).toEqual([{ count: 0 }]);
    expect(
      await asRealCustomer<{ count: number }>(
        sql`select count(*)::int as count from app_demo_orgs()`,
      ),
    ).toEqual([{ count: 0 }]);
  });

  it('hängt die Demo an einem echten Mandanten, bricht das Zurücksetzen ab, statt ihn zu löschen', async () => {
    const [link] = await query<{
      id: string;
    }>(sql`insert into relationship (buyer_org_id, supplier_org_id)
      values (${hollmann.org.id}, ${real.supplier}) returning id`);
    try {
      await expect(asJanLuka(sql`select app_demo_stand_laden('start')`)).rejects.toMatchObject({
        cause: { message: expect.stringMatching(/außerhalb der Demo/) },
      });
      const [still] = await query<{ count: number }>(
        sql`select count(*)::int as count from relationship where supplier_org_id = ${real.supplier}`,
      );
      expect(still?.count).toBe(2);
    } finally {
      await temp.db.execute(sql`delete from relationship where id = ${link?.id ?? ''}`);
    }
  });

  it('ein neuer Seed räumt auf, was die Vorführung angelegt hat', async () => {
    await temp.db.execute(sql`insert into meeting
      (relationship_id, owner_org_id, visibility, type, title, starts_at, duration_minutes,
       created_by, created_by_name)
      select relationship_id, owner_org_id, visibility, type, 'Noch neu', starts_at,
        duration_minutes, created_by, created_by_name
      from meeting where owner_org_id = ${hollmann.org.id} and type = 'jbp'`);
    await seedHollmann(temp.db, { nodeEnv: 'development' });
    const [left] = await query<{ count: number }>(
      sql`select count(*)::int as count from meeting where title = 'Noch neu'`,
    );
    expect(left?.count).toBe(0);
  });
});
