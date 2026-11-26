import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTempDatabase, migrateTo } from './testing/temp-database.js';

// ZQ-01 T2-ZQ1 (K2-a.3): Die Migration erzeugt aus jeder geteilten Maßnahme genau eine Zusage und
// aus jeder internen genau eine Aufgabe, jeweils mit derselben ID; keine Maßnahme bleibt ohne Ziel.
// Status, Beleg, Quelle, private Quellen, Versandlog, Kommentare und Fokus-Themen gehen mit.

const buyer = '00000000-0000-7000-8000-00000000d001';
const supplier = '00000000-0000-7000-8000-00000000d002';
const relationship = '00000000-0000-7000-8000-0000000d0ab1';
const meeting = '00000000-0000-7000-8000-0000000d0e01';
const jbp = '00000000-0000-7000-8000-0000000d0f01';
const initiative = '00000000-0000-7000-8000-0000000d0f02';
const gone = '00000000-0000-7000-8000-0000000d0f99';
const hint = '00000000-0000-7000-8000-0000000d0c01';
const gap = '00000000-0000-7000-8000-0000000d0c02';
const id = (n: number) => `00000000-0000-7000-8000-0000000d0a${String(n).padStart(2, '0')}`;

/** Bis einschließlich 0142 (Beleg der Zusagen), also vor der Migration der Maßnahmen */
const beforeMigration = 143;

describe('ZQ-01 T2-ZQ1: Migration der Maßnahmen', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;
  const rows = async <T extends Record<string, unknown>>(query: ReturnType<typeof sql>) =>
    (await temp.db.execute<T>(query)).rows;

  beforeAll(async () => {
    temp = await createTempDatabase();
    await migrateTo(temp.db, beforeMigration);
    await temp.db.execute(sql`
      insert into organization (id, name) values
        (${buyer}, 'Käufer (Demo)'), (${supplier}, 'Lieferant (Demo)')`);
    await temp.db.execute(sql`
      insert into relationship (id, buyer_org_id, supplier_org_id, status)
      values (${relationship}, ${buyer}, ${supplier}, 'active')`);
    await temp.db.execute(sql`
      insert into app_user (id, name, email, organization_id)
      values ('d-1', 'Jan', 'jan@kaeufer.example', ${buyer})`);
    await temp.db.execute(sql`
      insert into meeting (id, relationship_id, owner_org_id, visibility, type, title, starts_at,
        created_by, created_by_name)
      values (${meeting}, ${relationship}, ${buyer}, 'shared', 'quarterly_review', 'QBR',
        '2026-10-01T09:00:00Z', 'd-1', 'Jan')`);
    await temp.db.execute(sql`
      insert into jbp (id, relationship_id, owner_org_id, visibility, created_by, created_by_name)
      values (${jbp}, ${relationship}, ${buyer}, 'shared', 'd-1', 'Jan')`);
    await temp.db.execute(sql`
      insert into initiative (id, relationship_id, owner_org_id, visibility, jbp_id, title, goal,
        benefit_buyer, benefit_supplier, owner_buyer_name, owner_supplier_name, starts_on, ends_on,
        created_by, created_by_name)
      values (${initiative}, ${relationship}, ${buyer}, 'shared', ${jbp}, 'Zweitquelle', 'Ziel',
        'Nutzen', 'Nutzen', 'Jan', 'Kim', '2026-01-01', '2026-12-31', 'd-1', 'Jan')`);

    const action = (
      n: number,
      values: {
        owner: string;
        visibility: 'shared' | 'internal';
        side: 'buyer' | 'supplier';
        status: string;
        source: string;
        sourceId?: string | null;
      },
    ) =>
      temp.db.execute(sql`
        insert into action (id, relationship_id, owner_org_id, visibility, title, description,
          owner_side, owner_user_id, owner_name, due_date, status, source_type, source_id, done_at,
          created_by, created_by_name)
        values (${id(n)}, ${relationship}, ${values.owner}, ${values.visibility}, ${`Maßnahme ${n}`},
          ${`Beschreibung ${n}`}, ${values.side}, 'd-1', 'Jan', '2026-11-30', ${values.status},
          ${values.source}, ${values.sourceId ?? null},
          ${values.status === 'done' ? '2026-11-20T10:00:00Z' : null}, 'd-1', 'Jan')`);
    await action(1, {
      owner: buyer,
      visibility: 'shared',
      side: 'buyer',
      status: 'open',
      source: 'meeting',
      sourceId: meeting,
    });
    await action(2, {
      owner: supplier,
      visibility: 'shared',
      side: 'supplier',
      status: 'done',
      source: 'manual',
    });
    await action(3, {
      owner: buyer,
      visibility: 'shared',
      side: 'buyer',
      status: 'cancelled',
      source: 'feedback_gap',
      sourceId: gap,
    });
    await action(4, {
      owner: buyer,
      visibility: 'shared',
      side: 'supplier',
      status: 'in_progress',
      source: 'initiative',
      sourceId: initiative,
    });
    await action(5, {
      owner: buyer,
      visibility: 'internal',
      side: 'buyer',
      status: 'in_progress',
      source: 'manual',
    });
    await action(6, {
      owner: supplier,
      visibility: 'internal',
      side: 'supplier',
      status: 'open',
      source: 'manual',
    });
    await action(7, {
      owner: buyer,
      visibility: 'shared',
      side: 'buyer',
      status: 'open',
      source: 'initiative',
      sourceId: gone,
    });
    await action(8, {
      owner: buyer,
      visibility: 'shared',
      side: 'buyer',
      status: 'open',
      source: 'manual',
    });

    await temp.db.execute(sql`
      insert into action_private_source (action_id, relationship_id, org_id, source_type, source_id)
      values (${id(5)}, ${relationship}, ${buyer}, 'hint', ${hint}),
             (${id(8)}, ${relationship}, ${buyer}, 'hint', ${hint})`);
    await temp.db.execute(sql`
      insert into action_notification (action_id, relationship_id, org_id, kind, due_date)
      values (${id(1)}, ${relationship}, ${buyer}, 'reminder', '2026-11-30'),
             (${id(5)}, ${relationship}, ${buyer}, 'escalation', '2026-11-30')`);
    await temp.db.execute(sql`
      insert into comment (relationship_id, owner_org_id, visibility, object_type, object_id,
        author_id, author_name, body)
      values (${relationship}, ${buyer}, 'shared', 'action', ${id(1)}, 'd-1', 'Jan', 'Geteilt'),
             (${relationship}, ${buyer}, 'internal', 'action', ${id(5)}, 'd-1', 'Jan', 'Intern')`);
    await temp.db.execute(sql`
      insert into focus_item (org_id, user_id, level, kind, title, object_type, object_id,
        relationship_id, source_type, source_id)
      values (${buyer}, 'd-1', 'focus', 'decision', 'Maßnahme 5', 'action', ${id(5)},
        ${relationship}, 'due', ${id(5)})`);

    await migrateTo(temp.db);
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('jede geteilte Maßnahme wird genau eine Zusage, jede interne genau eine Aufgabe, keine bleibt ohne Ziel', async () => {
    const commitments = await rows<{ id: string }>(sql`select id from commitment order by id`);
    const tasks = await rows<{ id: string }>(sql`select id from task order by id`);
    expect(commitments.map((row) => row.id)).toEqual([1, 2, 3, 4, 7, 8].map(id));
    expect(tasks.map((row) => row.id)).toEqual([5, 6].map(id));
    const left = await rows<{ action: string | null }>(
      sql`select to_regclass('action')::text as action`,
    );
    expect(left).toEqual([{ action: null }]);
  });

  it('Status, Beleg, Seite und Quelle der Zusagen', async () => {
    const result = await rows(sql`
      select id, side, owner_org_id, visibility, status, fulfilled_evidence, done_at is not null as done,
        source_type, source_ref, initiative_id, description
      from commitment order by id`);
    expect(result).toEqual([
      {
        id: id(1),
        side: 'buyer',
        owner_org_id: buyer,
        visibility: 'shared',
        status: 'open',
        fulfilled_evidence: null,
        done: false,
        source_type: 'meeting',
        source_ref: meeting,
        initiative_id: null,
        description: 'Beschreibung 1',
      },
      {
        id: id(2),
        side: 'supplier',
        owner_org_id: supplier,
        visibility: 'shared',
        status: 'kept',
        fulfilled_evidence: { kind: 'legacy' },
        done: true,
        source_type: 'manual',
        source_ref: null,
        initiative_id: null,
        description: 'Beschreibung 2',
      },
      {
        id: id(3),
        side: 'buyer',
        owner_org_id: buyer,
        visibility: 'shared',
        status: 'withdrawn',
        fulfilled_evidence: null,
        done: true,
        source_type: 'feedback',
        source_ref: gap,
        initiative_id: null,
        description: 'Beschreibung 3',
      },
      {
        id: id(4),
        side: 'supplier',
        owner_org_id: buyer,
        visibility: 'shared',
        status: 'open',
        fulfilled_evidence: null,
        done: false,
        source_type: 'initiative',
        source_ref: initiative,
        initiative_id: initiative,
        description: 'Beschreibung 4',
      },
      {
        id: id(7),
        side: 'buyer',
        owner_org_id: buyer,
        visibility: 'shared',
        status: 'open',
        fulfilled_evidence: null,
        done: false,
        source_type: 'initiative',
        source_ref: gone,
        initiative_id: null,
        description: 'Beschreibung 7',
      },
      {
        id: id(8),
        side: 'buyer',
        owner_org_id: buyer,
        visibility: 'shared',
        status: 'open',
        fulfilled_evidence: null,
        done: false,
        source_type: 'manual',
        source_ref: null,
        initiative_id: null,
        description: 'Beschreibung 8',
      },
    ]);
    // Die besitzende Seite gilt als bestätigt, wie bei jeder neuen geteilten Zusage (ZA-01)
    const confirms = await rows<{ confirm_state: string }>(
      sql`select distinct confirm_state from commitment where owner_org_id = ${buyer}`,
    );
    expect(confirms).toEqual([{ confirm_state: 'buyer_confirmed' }]);
  });

  it('Aufgaben mit Status, Raum und Quelle; der Hinweis wird Quelle der Aufgabe', async () => {
    expect(
      await rows(
        sql`select id, org_id, space, status, source_type, source_id from task order by id`,
      ),
    ).toEqual([
      {
        id: id(5),
        org_id: buyer,
        space: 'buyer_private',
        status: 'in_progress',
        source_type: 'hint',
        source_id: hint,
      },
      {
        id: id(6),
        org_id: supplier,
        space: 'supplier_private',
        status: 'open',
        source_type: 'manual',
        source_id: null,
      },
    ]);
  });

  it('private Quellen, Versandlog, Kommentare und Fokus-Themen zeigen auf das neue Objekt', async () => {
    expect(
      await rows(sql`select commitment_id, source_type, source_id from commitment_private_source`),
    ).toEqual([{ commitment_id: id(8), source_type: 'hint', source_id: hint }]);
    expect(
      await rows(sql`select object_type, object_id, kind from reminder_sent order by object_id`),
    ).toEqual([
      { object_type: 'commitment', object_id: id(1), kind: 'reminder' },
      { object_type: 'task', object_id: id(5), kind: 'escalation' },
    ]);
    expect(await rows(sql`select object_type, object_id from comment order by object_id`)).toEqual([
      { object_type: 'commitment', object_id: id(1) },
      { object_type: 'task', object_id: id(5) },
    ]);
    expect(await rows(sql`select object_type, object_id from focus_item`)).toEqual([
      { object_type: 'task', object_id: id(5) },
    ]);
  });
});
