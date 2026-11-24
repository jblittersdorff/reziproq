import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { layerRegister } from './layers.js';
import { seed, seedBuyers, seedSupplierOrg } from './seed.js';
import { withTenant } from './tenant.js';
import { createTempDatabase, migrateTo } from './testing/temp-database.js';

// ZA-01 Datenräume, Status, Herkunft (Paket K1-a) gegen eine echte PostgreSQL-Datenbank. Der Raum
// einer Zeile folgt aus der Ebene ihrer Tabelle, der besitzenden Organisation und visibility
// (app_row_space, E-K0-03). Das Gerüst je Tabelle steht in layers.test.ts; hier geht es um alle
// Tabellen mit Beispieldaten und um die Migration.

const buyerA = '00000000-0000-7000-8000-00000000a001';
const supplierB = '00000000-0000-7000-8000-00000000b001';
const relationshipAB = '00000000-0000-7000-8000-0000000ab001';

/** Ausdruck für den Raum einer Zeile, nach der Ebene ihrer Tabelle */
function spaceOf(table: string) {
  const kind = layerRegister[table]?.kind;
  if (!kind) throw new Error(`${table} steht nicht im Register`);
  const owner =
    kind === 'shared' ? 'owner_org_id' : kind === 'org_private' ? 'org_id' : 'null::uuid';
  const visibility = kind === 'shared' ? 'visibility' : 'null::text';
  return sql.raw(`app_row_space('${kind}', relationship_id, ${owner}, ${visibility})`);
}

describe('ZA-01 Datenräume nach der Migration', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;

  beforeAll(async () => {
    temp = await createTempDatabase();
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('T1-ZA5: Die Migration ordnet jede bestehende Zeile genau einem Raum zu, Herkunft und Bestätigung inklusive', async () => {
    // Stand vor K1-a: 0000 bis 0129
    await migrateTo(temp.db, 130);
    const jbpId = '00000000-0000-7000-8000-0000000ab0a1';
    await temp.db.execute(
      sql`insert into organization (id, name) values (${buyerA}, 'Käufer A (Demo)'), (${supplierB}, 'Lieferant B (Demo)')`,
    );
    await temp.db.execute(
      sql`insert into relationship (id, buyer_org_id, supplier_org_id) values (${relationshipAB}, ${buyerA}, ${supplierB})`,
    );
    await temp.db.execute(sql`
      insert into jbp (id, relationship_id, owner_org_id, visibility, created_by, created_by_name)
      values (${jbpId}, ${relationshipAB}, ${buyerA}, 'shared', 'a-1', 'A')
    `);
    const commitment = (owner: string, visibility: string, side: string, title: string) =>
      temp.db.execute(sql`
        insert into commitment (relationship_id, owner_org_id, visibility, jbp_id, side, title, owner_name, due_on, created_by, created_by_name)
        values (${relationshipAB}, ${owner}, ${visibility}, ${jbpId}, ${side}, ${title}, 'P', '2026-11-30', 'p-1', 'P')
      `);
    await commitment(buyerA, 'shared', 'buyer', 'Zeichnung Rev. C');
    await commitment(supplierB, 'shared', 'supplier', 'Musterteile');
    await commitment(buyerA, 'internal', 'buyer', 'Intern');
    await temp.db.execute(sql`
      insert into jbp_version (relationship_id, owner_org_id, visibility, jbp_id, version, content)
      values (${relationshipAB}, ${buyerA}, 'shared', ${jbpId}, 1, '{}')
    `);
    // Ein abgeschlossener Termin sperrt seine Agenda (0040); die Vorbelegung muss trotzdem durchgehen.
    const meetingId = '00000000-0000-7000-8000-0000000ab0d1';
    await temp.db.execute(sql`
      insert into meeting (id, relationship_id, owner_org_id, visibility, type, title, starts_at, created_by, created_by_name)
      values (${meetingId}, ${relationshipAB}, ${buyerA}, 'shared', 'quarterly_review', 'QBR', '2026-10-01T09:00:00Z', 'a-1', 'A')
    `);
    await temp.db.execute(sql`
      insert into meeting_agenda_item (relationship_id, owner_org_id, visibility, meeting_id, title, position)
      values (${relationshipAB}, ${buyerA}, 'shared', ${meetingId}, 'Kapazität 2028', 1)
    `);
    await temp.db.execute(sql`update meeting set status = 'closed' where id = ${meetingId}`);
    await migrateTo(temp.db);

    const commitments = await temp.db.execute<{
      title: string;
      origin: string;
      confirm_state: string;
      space: string;
    }>(sql`
      select title, origin, confirm_state, ${spaceOf('commitment')} as space
      from commitment order by title
    `);
    expect(commitments.rows).toEqual([
      { title: 'Intern', origin: 'human', confirm_state: 'draft', space: 'buyer_private' },
      {
        title: 'Musterteile',
        origin: 'human',
        confirm_state: 'supplier_confirmed',
        space: 'shared',
      },
      {
        title: 'Zeichnung Rev. C',
        origin: 'human',
        confirm_state: 'buyer_confirmed',
        space: 'shared',
      },
    ]);
    const version = await temp.db.execute<{ confirm_state: string }>(
      sql`select confirm_state from jbp_version`,
    );
    expect(version.rows).toEqual([{ confirm_state: 'both_confirmed' }]);
    const agenda = await temp.db.execute<{ confirm_state: string }>(
      sql`select confirm_state from meeting_agenda_item`,
    );
    expect(agenda.rows).toEqual([{ confirm_state: 'buyer_confirmed' }]);
    // Die Sperre gilt danach wieder.
    await expect(
      temp.db.execute(sql`update meeting_agenda_item set title = 'Geändert'`),
    ).rejects.toMatchObject({ cause: { message: 'meeting_closed' } });

    // Jede Zeile jeder Tabelle mit Beziehung hat genau einen Raum.
    const tables = await relationshipTables(temp.db);
    for (const table of tables) {
      const missing = await temp.db.execute<{ n: number }>(sql`
        select count(*)::int as n from ${sql.identifier(table)}
        where relationship_id is not null
          and ${spaceOf(table)} is distinct from 'buyer_private'
          and ${spaceOf(table)} is distinct from 'supplier_private'
          and ${spaceOf(table)} is distinct from 'shared'
      `);
      expect(missing.rows[0]?.n, table).toBe(0);
    }
  });

  it('T1-ZA6: Eine nur einseitig bestätigte Zusage zählt in keiner Quote', async () => {
    await temp.db.execute(sql`
      update commitment set status = 'kept' where title in ('Zeichnung Rev. C', 'Musterteile')
    `);
    const before = await temp.db.execute<{ n: number }>(
      sql`select count(*)::int as n from commitment_rate where relationship_id = ${relationshipAB}`,
    );
    expect(before.rows[0]?.n).toBe(0);
    await temp.db.execute(sql`
      update commitment set confirm_state = 'both_confirmed' where title = 'Musterteile'
    `);
    const after = await temp.db.execute<{ side: string; kept: number; due: number }>(sql`
      select side, kept, due from commitment_rate where relationship_id = ${relationshipAB}
    `);
    expect(after.rows).toEqual([{ side: 'supplier', kept: 1, due: 1 }]);
  });
});

/** Tabellen aus dem Register mit Spalte relationship_id */
async function relationshipTables(db: Awaited<ReturnType<typeof createTempDatabase>>['db']) {
  const result = await db.execute<{ table_name: string }>(sql`
    select c.table_name from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'relationship_id'
    order by c.table_name
  `);
  return result.rows.map((row) => row.table_name).filter((table) => layerRegister[table]);
}

describe('ZA-01 Datenräume mit den Beispieldaten', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;
  let tables: string[] = [];
  const supplierUser = 'demo-test-lieferant-1';
  const buyers = [
    { org: seedBuyers.testOem.id, user: 'demo-test-oem-1' },
    { org: seedBuyers.zweitOem.id, user: 'demo-zweit-oem-1' },
  ];

  beforeAll(async () => {
    temp = await createTempDatabase();
    await migrateTo(temp.db);
    await seed(temp.db, { nodeEnv: 'development' });
    tables = await relationshipTables(temp.db);
  });

  afterAll(async () => {
    await temp.drop();
  });

  const countIn = (
    session: Parameters<typeof withTenant>[1],
    table: string,
    space: 'buyer_private' | 'supplier_private' | 'shared',
  ) =>
    withTenant(temp.db, session, async (tx) => {
      const result = await tx.execute<{ n: number }>(sql`
        select count(*)::int as n from ${sql.identifier(table)} where ${spaceOf(table)} = ${space}
      `);
      return result.rows[0]?.n ?? 0;
    });

  it('prüft jede Tabelle mit Beziehung aus dem Register', () => {
    expect(tables.length).toBeGreaterThan(50);
    expect(tables).toContain('commitment');
    expect(tables).toContain('focus_item');
  });

  it('T1-ZA1: Ein Nutzer des Lieferanten liest kein Objekt mit Raum buyer_private, in keiner Tabelle', async () => {
    for (const buyer of buyers) {
      const session = {
        userId: supplierUser,
        organizationId: seedSupplierOrg.id,
        customerOrganizationId: buyer.org,
      };
      for (const table of tables) {
        expect(await countIn(session, table, 'buyer_private'), table).toBe(0);
      }
    }
  });

  it('T1-ZA2: Keine Abfrage der Käuferseite liefert Zeilen mit Raum supplier_private', async () => {
    let buyerPrivateSeen = 0;
    for (const buyer of buyers) {
      const session = { userId: buyer.user, organizationId: buyer.org };
      for (const table of tables) {
        expect(await countIn(session, table, 'supplier_private'), table).toBe(0);
        buyerPrivateSeen += await countIn(session, table, 'buyer_private');
      }
    }
    // Die Probe greift nur, wenn es käuferprivate Zeilen gibt, die der Käufer sieht.
    expect(buyerPrivateSeen).toBeGreaterThan(0);
  });

  it('ZA-01 Regel 3: Jede geteilte Tabelle einer Beziehung hat den Token-Schutz, außer dem Verlauf', async () => {
    const shared = await temp.db.execute<{ table_name: string }>(sql`
      select c.table_name from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
      where c.table_schema = 'public' and c.column_name in ('relationship_id', 'owner_org_id', 'visibility')
      group by c.table_name having count(*) = 3
    `);
    const guarded = await temp.db.execute<{ table_name: string }>(sql`
      select c.relname as table_name from pg_trigger g join pg_class c on c.oid = g.tgrelid
      where g.tgname = c.relname || '_guard_shared'
    `);
    const expected = shared.rows.map((row) => row.table_name).filter((t) => t !== 'audit_event');
    expect(expected.length).toBeGreaterThan(20);
    expect(guarded.rows.map((row) => row.table_name).sort()).toEqual(expected.sort());
  });

  it('HE-01, MA-01: Fokus-Themen, Stufen und Tokens sieht nur die Person selbst', async () => {
    const org = seedBuyers.testOem.id;
    await temp.db.execute(sql`
      insert into focus_item (org_id, user_id, level, kind, title, object_type, source_type, source_id)
      values (${org}, 'demo-test-oem-1', 'focus', 'decision', 'Wertpotenzial fürs JBP', 'value_opportunity', 'value_opportunity', '00000000-0000-7000-8000-00000000f001')
    `);
    await temp.db.execute(sql`
      insert into worker_setting (org_id, user_id, agent_key, level) values (${org}, 'demo-test-oem-1', 'inbox', 'prepare')
    `);
    await temp.db.execute(sql`
      insert into confirm_token (org_id, user_id, purpose, object_type, object_id, expires_at)
      values (${org}, 'demo-test-oem-1', 'share', 'action', '00000000-0000-7000-8000-00000000f002', now() + interval '15 minutes')
    `);
    const seen = (userId: string, organizationId: string, customer?: string) =>
      withTenant(temp.db, { userId, organizationId, customerOrganizationId: customer ?? null }, async (tx) => {
        const counts = await tx.execute<{ focus: number; levels: number; tokens: number; next: number }>(sql`
          select (select count(*)::int from focus_item) as focus,
                 (select count(*)::int from worker_setting) as levels,
                 (select count(*)::int from confirm_token) as tokens,
                 (select count(*)::int from next_action) as next
        `);
        return counts.rows[0];
      });
    expect(await seen('demo-test-oem-1', org)).toEqual({ focus: 1, levels: 1, tokens: 1, next: 1 });
    expect(await seen('demo-test-oem-2', org)).toEqual({ focus: 0, levels: 0, tokens: 0, next: 0 });
    expect(await seen(supplierUser, seedSupplierOrg.id, org)).toEqual({
      focus: 0,
      levels: 0,
      tokens: 0,
      next: 0,
    });
  });

  it('T1-ZA5: Mit den Beispieldaten hat jede Zeile einer Beziehung genau einen Raum', async () => {
    for (const table of tables) {
      const result = await temp.db.execute<{ n: number }>(sql`
        select count(*)::int as n from ${sql.identifier(table)}
        where relationship_id is not null and ${spaceOf(table)} is null
      `);
      expect(result.rows[0]?.n, table).toBe(0);
    }
  });
});
