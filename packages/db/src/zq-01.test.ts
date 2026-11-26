import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from './tenant.js';
import { createTempDatabase } from './testing/temp-database.js';

// ZQ-01 (K2-a.1): Datenmodell der Zusagen und Aufgaben gegen eine echte PostgreSQL-Datenbank.
// Zusagen hängen an der Beziehung (E-K0-16), beide Seiten ändern den Status über
// app_zusage_status, die Quote zählt nur gehaltene und verfehlte beidseitig bestätigte Zusagen.
// Aufgaben sieht nur die eigene Organisation; ihr Raum folgt aus der Seite in der Beziehung.

const buyerA = '00000000-0000-7000-8000-00000000c001';
const buyerC = '00000000-0000-7000-8000-00000000c003';
const supplierB = '00000000-0000-7000-8000-00000000c002';
const relationshipAB = '00000000-0000-7000-8000-0000000c0ab1';
const relationshipCB = '00000000-0000-7000-8000-0000000c0cb1';
const jbpId = '00000000-0000-7000-8000-0000000c0a01';

const asBuyer = { userId: 'a-1', organizationId: buyerA };
const asOtherBuyer = { userId: 'c-1', organizationId: buyerC };
const asSupplier = { userId: 'b-1', organizationId: supplierB, customerOrganizationId: buyerA };

describe('ZQ-01 Zusagen und Aufgaben: Datenmodell', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;

  /** Zusage als Zeile der zusagenden Seite, direkt in der Datenbank */
  async function commitment(input: {
    owner: string;
    side: 'buyer' | 'supplier';
    title: string;
    visibility?: 'internal' | 'shared';
    jbp?: string | null;
    status?: string;
    due?: string;
    confirm?: string;
  }) {
    const result = await temp.db.execute<{ id: string }>(sql`
      insert into commitment (relationship_id, owner_org_id, visibility, jbp_id, side, title,
        owner_name, due_on, status, created_by, created_by_name)
      values (${relationshipAB}, ${input.owner}, ${input.visibility ?? 'shared'},
        ${input.jbp ?? null}, ${input.side}, ${input.title}, 'P', ${input.due ?? '2026-11-30'},
        ${input.status ?? 'open'}, 'p-1', 'P')
      returning id`);
    const id = result.rows[0]?.id ?? '';
    if (input.confirm) {
      await temp.db.execute(
        sql`update commitment set confirm_state = ${input.confirm} where id = ${id}`,
      );
    }
    return id;
  }

  beforeAll(async () => {
    temp = await createTempDatabase({ from: 'migrated' });
    await temp.db.execute(sql`
      insert into organization (id, name) values
        (${buyerA}, 'Käufer A (Demo)'), (${buyerC}, 'Käufer C (Demo)'),
        (${supplierB}, 'Lieferant B (Demo)')`);
    await temp.db.execute(sql`
      insert into relationship (id, buyer_org_id, supplier_org_id) values
        (${relationshipAB}, ${buyerA}, ${supplierB}), (${relationshipCB}, ${buyerC}, ${supplierB})`);
    await temp.db.execute(sql`
      insert into jbp (id, relationship_id, owner_org_id, visibility, created_by, created_by_name)
      values (${jbpId}, ${relationshipAB}, ${buyerA}, 'shared', 'a-1', 'A')`);
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('eine Zusage hängt an der Beziehung; ein gelöschter Gemeinsamer Plan lässt seine Zusagen stehen (E-K0-16)', async () => {
    const own = await withTenant(temp.db, asBuyer, async (tx) => {
      const result = await tx.execute<{ id: string; jbp_id: string | null; kind: string }>(sql`
        insert into commitment (relationship_id, owner_org_id, visibility, side, title, owner_name,
          due_on, measure, source_type, created_by, created_by_name)
        values (${relationshipAB}, ${buyerA}, 'shared', 'buyer', 'Zeichnung Rev. C', 'Jan',
          '2026-11-30', 'Zeichnung liegt bei Rheintal', 'mail', 'a-1', 'A')
        returning id, jbp_id, kind`);
      return result.rows[0];
    });
    expect(own).toMatchObject({ jbp_id: null, kind: 'commitment' });
    const inPlan = await commitment({ owner: buyerA, side: 'buyer', title: 'Im Plan', jbp: jbpId });
    await temp.db.execute(sql`delete from jbp where id = ${jbpId}`);
    const left = await temp.db.execute<{ jbp_id: string | null }>(
      sql`select jbp_id from commitment where id = ${inPlan}`,
    );
    expect(left.rows).toEqual([{ jbp_id: null }]);
  });

  it('beide Seiten ändern den Status über app_zusage_status: Beleg bei gehalten, Dritte und interne Zusagen nicht', async () => {
    const supplierPromise = await commitment({
      owner: supplierB,
      side: 'supplier',
      title: '8D-Bericht Charge 4711',
    });
    const evidence = { kind: 'document', title: '8D-Bericht.pdf', by: 'a-1' };
    // Der Käufer bucht die Zusage des Lieferanten mit Beleg als gehalten (ZQ-01 Regel 5)
    await withTenant(temp.db, asBuyer, (tx) =>
      tx.execute(
        sql`select app_zusage_status(${supplierPromise}, 'kept', ${JSON.stringify(evidence)}::jsonb)`,
      ),
    );
    const kept = await temp.db.execute<{
      status: string;
      fulfilled_evidence: unknown;
      done_at: Date | null;
    }>(
      sql`select status, fulfilled_evidence, done_at from commitment where id = ${supplierPromise}`,
    );
    expect(kept.rows[0]).toMatchObject({ status: 'kept', fulfilled_evidence: evidence });
    expect(kept.rows[0]?.done_at).not.toBeNull();

    // Zurück auf offen: Beleg und Zeitpunkt gehen mit
    await withTenant(temp.db, asSupplier, (tx) =>
      tx.execute(sql`select app_zusage_status(${supplierPromise}, 'open', null)`),
    );
    const reopened = await temp.db.execute<{ fulfilled_evidence: unknown; done_at: Date | null }>(
      sql`select fulfilled_evidence, done_at from commitment where id = ${supplierPromise}`,
    );
    expect(reopened.rows).toEqual([{ fulfilled_evidence: null, done_at: null }]);

    // Ein Käufer einer anderen Beziehung desselben Lieferanten kommt nicht heran
    await expect(
      withTenant(temp.db, asOtherBuyer, (tx) =>
        tx.execute(sql`select app_zusage_status(${supplierPromise}, 'missed', null)`),
      ),
    ).rejects.toMatchObject({ cause: { message: 'commitment_not_found' } });
    // Interne Zusagen gehören nur ihrer Seite
    const internal = await commitment({
      owner: buyerA,
      side: 'buyer',
      title: 'Intern',
      visibility: 'internal',
    });
    await expect(
      withTenant(temp.db, asSupplier, (tx) =>
        tx.execute(sql`select app_zusage_status(${internal}, 'missed', null)`),
      ),
    ).rejects.toMatchObject({ cause: { message: 'commitment_not_found' } });
  });

  it('T2-ZQ2: gehalten ohne Beleg lehnt die Datenbank ab, auch ohne Art im Beleg', async () => {
    const id = await commitment({ owner: buyerA, side: 'buyer', title: 'Zeichnung Rev. D' });
    const book = (evidence: string | null) =>
      temp.db.execute(sql`
        update commitment set status = 'kept', fulfilled_evidence = ${evidence}::jsonb
        where id = ${id}`);
    for (const evidence of [null, '"Lieferavis"', '{"note":"ohne Art"}']) {
      await expect(book(evidence)).rejects.toMatchObject({
        cause: { constraint: 'commitment_kept_evidence' },
      });
    }
    await book('{"kind":"document"}');
    const kept = await temp.db.execute<{ status: string }>(
      sql`select status from commitment where id = ${id}`,
    );
    expect(kept.rows).toEqual([{ status: 'kept' }]);
  });

  it('die Quote zählt gehalten und verfehlt; ersetzt, zurückgezogen und einseitig bestätigte nicht', async () => {
    const both = 'both_confirmed';
    const due = '2025-06-30';
    for (const status of ['kept', 'kept', 'missed', 'replaced', 'withdrawn', 'open']) {
      await commitment({
        owner: supplierB,
        side: 'supplier',
        title: `Quote ${status}`,
        status: status === 'kept' ? 'open' : status,
        due,
        confirm: both,
      });
    }
    // Gehalten nur mit Beleg (die Regel prüft K2-a.2); hier direkt gebucht
    await temp.db.execute(sql`
      update commitment set status = 'kept', fulfilled_evidence = '{"kind":"confirmation"}'
      where title = 'Quote kept'`);
    await commitment({
      owner: supplierB,
      side: 'supplier',
      title: 'Nur eine Seite',
      status: 'missed',
      due,
      confirm: 'supplier_confirmed',
    });
    const rate = await temp.db.execute<{ kept: number; due: number }>(sql`
      select kept, due from commitment_rate
      where relationship_id = ${relationshipAB} and side = 'supplier' and year = 2025`);
    expect(rate.rows).toEqual([{ kept: 2, due: 3 }]);
  });

  it('Aufgaben: Raum aus der Seite in der Beziehung, nur die eigene Organisation sieht sie', async () => {
    const insertTask = (session: typeof asBuyer, org: string, title: string) =>
      withTenant(temp.db, session, async (tx) => {
        const result = await tx.execute<{ space: string }>(sql`
          insert into task (relationship_id, org_id, title, owner_name, due_date, created_by,
            created_by_name, space)
          values (${relationshipAB}, ${org}, ${title}, 'P', '2026-12-01', 'p-1', 'P',
            'supplier_private')
          returning space`);
        return result.rows[0]?.space;
      });
    // Auch ein falsch übergebener Raum wird aus der Beziehung gesetzt
    expect(await insertTask(asBuyer, buyerA, 'Kapazitätsplan 2028 abstimmen')).toBe(
      'buyer_private',
    );
    expect(await insertTask(asSupplier, supplierB, 'Schichtplan prüfen')).toBe('supplier_private');

    const titles = (session: typeof asBuyer) =>
      withTenant(temp.db, session, async (tx) =>
        (await tx.execute<{ title: string }>(sql`select title from task order by title`)).rows.map(
          (row) => row.title,
        ),
      );
    expect(await titles(asBuyer)).toEqual(['Kapazitätsplan 2028 abstimmen']);
    expect(await titles(asSupplier)).toEqual(['Schichtplan prüfen']);
    expect(await titles(asOtherBuyer)).toEqual([]);

    // Für eine fremde Organisation legt niemand Aufgaben an
    await expect(insertTask(asBuyer, supplierB, 'Fremd')).rejects.toThrow();
  });
});
