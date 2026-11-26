import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { currentTime, systemTime, withDemoClock } from './clock.js';
import { withTenant } from './tenant.js';
import { createTempDatabase } from './testing/temp-database.js';

// DM-01, K1-a.2: Uhr je Mandant gegen eine echte PostgreSQL-Datenbank.

const demoOrg = '00000000-0000-7000-8000-00000000d001';
const liveOrg = '00000000-0000-7000-8000-00000000d002';
const demoNow = new Date('2026-11-23T06:30:00Z'); // Mo 23.11., 07:30 in Berlin

/** Funktionen ohne Mandanten-Session, die bewusst die Echtzeit lesen (Migration 0131) */
const realTimeFunctions = [
  'app_einladung_annehmen',
  'app_einladung_lesen',
  'app_nutzer_synchronisieren',
  'app_sprache_setzen',
  'app_system_now',
  'app_umfrage_absenden',
  'app_umfrage_lesen',
];

describe('Uhr je Mandant (DM-01)', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;

  beforeAll(async () => {
    temp = await createTempDatabase({ from: 'migrated' });
    await temp.db.execute(sql`
      insert into organization (id, name, is_demo, demo_now) values
        (${demoOrg}, 'Hollmann (Demo)', true, ${demoNow.toISOString()}::timestamptz)
    `);
    await temp.db.execute(
      sql`insert into organization (id, name) values (${liveOrg}, 'Live (Demo)')`,
    );
    await temp.db.execute(sql`
      insert into app_user (id, name, email, organization_id, org_role)
      values ('uhr-demo', 'Demo', 'demo@example.com', ${demoOrg}, 'member'),
             ('uhr-live', 'Live', 'live@example.com', ${liveOrg}, 'member')
    `);
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('Im Demo-Mandanten liefern currentTime() und app_now() die Demo-Uhr, auch für Standardwerte', async () => {
    const result = await withTenant(
      temp.db,
      { userId: 'uhr-demo', organizationId: demoOrg },
      async (tx) => {
        await tx.execute(sql`
          insert into focus_item (org_id, user_id, level, kind, title, object_type, source_type, source_id)
          values (${demoOrg}, 'uhr-demo', 'focus', 'decision', 'Probe', 'probe', 'probe', '00000000-0000-7000-8000-00000000d0f1')
        `);
        const rows = await tx.execute<{ now: Date; created: Date }>(sql`
          select app_now() as now, (select created_at from focus_item) as created
        `);
        return { code: currentTime(), db: rows.rows[0] };
      },
    );
    expect(result.code.toISOString()).toBe(demoNow.toISOString());
    expect(new Date(result.db?.now as Date).toISOString()).toBe(demoNow.toISOString());
    expect(new Date(result.db?.created as Date).toISOString()).toBe(demoNow.toISOString());
  });

  it('Außerhalb des Demo-Mandanten gilt die Echtzeit; systemTime() ist immer die Echtzeit', async () => {
    const before = systemTime().getTime();
    const result = await withTenant(
      temp.db,
      { userId: 'uhr-live', organizationId: liveOrg },
      async (tx) => {
        const rows = await tx.execute<{ now: Date }>(sql`select app_now() as now`);
        return { code: currentTime(), db: rows.rows[0]?.now };
      },
    );
    const after = systemTime().getTime();
    expect(result.code.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.code.getTime()).toBeLessThanOrEqual(after);
    expect(Math.abs(new Date(result.db as Date).getTime() - before)).toBeLessThan(60_000);
    withDemoClock(demoNow, () => {
      expect(currentTime().toISOString()).toBe(demoNow.toISOString());
      expect(systemTime().getTime()).toBeGreaterThan(demoNow.getTime());
    });
  });

  it('Nur ein Demo-Mandant darf eine eigene Uhr oder einen anderen Modus als live haben', async () => {
    await expect(
      temp.db.execute(sql`update organization set demo_now = now() where id = ${liveOrg}`),
    ).rejects.toMatchObject({ cause: { constraint: 'organization_demo_uhr' } });
    await expect(
      temp.db.execute(sql`update organization set ai_mode = 'replay' where id = ${liveOrg}`),
    ).rejects.toMatchObject({ cause: { constraint: 'organization_demo_modus' } });
    await temp.db.execute(sql`update organization set ai_mode = 'replay' where id = ${demoOrg}`);
  });

  it('Kein Standardwert einer Spalte liest die Systemuhr', async () => {
    const defaults = await temp.db.execute<{ column: string; value: string }>(sql`
      select table_name || '.' || column_name as column, column_default as value
      from information_schema.columns
      where table_schema = 'public'
        and column_default ~* '(^|[^_a-z])(now\\(\\)|current_date|current_timestamp)'
    `);
    expect(defaults.rows).toEqual([]);
    const withClock = await temp.db.execute<{ n: number }>(sql`
      select count(*)::int as n from information_schema.columns
      where table_schema = 'public' and column_default like '%app_now()%'
    `);
    expect(withClock.rows[0]?.n).toBeGreaterThan(100);
  });

  it('Nur die Uhr selbst und die Funktionen ohne Mandanten-Session lesen in der Datenbank die Systemuhr', async () => {
    const functions = await temp.db.execute<{ name: string }>(sql`
      select distinct p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prosrc ~* '(^|[^_a-z])(now\\(\\)|current_date|current_timestamp)'
      order by 1
    `);
    expect(functions.rows.map((row) => row.name)).toEqual(['app_now', ...realTimeFunctions].sort());
  });

  it('Keine Sicht liest die Systemuhr (K1-c: next_action rechnet mit app_now)', async () => {
    const views = await temp.db.execute<{ name: string }>(sql`
      select viewname as name from pg_views
      where schemaname = 'public'
        and definition ~* '(^|[^_a-z])(now\\(\\)|current_date|current_timestamp)'
    `);
    expect(views.rows).toEqual([]);
    const next = await temp.db.execute<{ definition: string }>(
      sql`select definition from pg_views where schemaname = 'public' and viewname = 'next_action'`,
    );
    expect(next.rows[0]?.definition).toContain('app_now()');
  });
});
