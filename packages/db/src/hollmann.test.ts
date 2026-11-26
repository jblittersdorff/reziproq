import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  hollmann,
  hollmannPeople,
  hollmannStart,
  hollmannSuppliers,
  seedHollmann,
  supplierPeople,
} from './hollmann.js';
import { createTempDatabase } from './testing/temp-database.js';

// DM-01, E-K0-04, G-10 (K1-b.3): Der Demo-Mandant Hollmann ist ein eigener Mandant mit
// synthetischen Personen und den Zahlen der Bildvorlagen; der Seed läuft beliebig oft.
describe('demo:hollmann', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;
  const query = async <T extends Record<string, unknown>>(statement: ReturnType<typeof sql>) =>
    (await temp.db.execute<T>(statement)).rows;

  beforeAll(async () => {
    temp = await createTempDatabase({ from: 'migrated' });
    await seedHollmann(temp.db, { nodeEnv: 'development' });
    // Ein zweiter Lauf ändert nichts und verdoppelt nichts
    await seedHollmann(temp.db, { nodeEnv: 'development' });
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('bricht im Betrieb ab', async () => {
    await expect(seedHollmann(temp.db, { nodeEnv: 'production' })).rejects.toThrow(/Vorführungen/);
  });

  it('Hollmann ist ein Demo-Mandant mit Uhr Mo 23.11., 07:30 und abgespielten Antworten', async () => {
    const [org] = await query<{ is_demo: boolean; demo_now: Date; ai_mode: string }>(
      sql`select is_demo, demo_now, ai_mode from organization where id = ${hollmann.org.id}`,
    );
    expect(org).toMatchObject({ is_demo: true, ai_mode: 'replay' });
    expect(new Date(org?.demo_now ?? 0).toISOString()).toBe(hollmannStart.toISOString());
    // Alle Organisationen der Geschichte sind Demo-Mandanten: Hollmann, Halder, 16 Lieferanten
    const [demo] = await query<{ count: number }>(
      sql`select count(*)::int as count from organization where is_demo`,
    );
    expect(Number(demo?.count)).toBe(18);
  });

  it('16 Beziehungen mit 30,1 Mio. € Spend 2026, Rheintal 4,2 Mio. € (Vorlage Beziehungen)', async () => {
    const rows = await query<{ name: string; amount: number }>(sql`
      select o.name, s.amount_cents::bigint as amount
      from relationship r
      join organization o on o.id = r.supplier_org_id
      join relationship_spend s on s.relationship_id = r.id and s.year = 2026
      where r.buyer_org_id = ${hollmann.org.id}`);
    expect(rows).toHaveLength(16);
    expect(rows.reduce((total, row) => total + Number(row.amount), 0)).toBe(3_010_000_000);
    expect(Number(rows.find((row) => row.name === 'Rheintal Elektronik')?.amount)).toBe(
      420_000_000,
    );
    expect(Number(rows.find((row) => row.name === 'Pearl River Components')?.amount)).toBe(
      564_000_000,
    );
  });

  it('Jan-Luka ist SRO von sechs Beziehungen, darunter Rheintal; Sara Ost führt Leiterplatten', async () => {
    const sro = await query<{ name: string }>(sql`
      select o.name from relationship_member m
      join relationship r on r.id = m.relationship_id
      join organization o on o.id = r.supplier_org_id
      where m.user_id = ${hollmannPeople.janLuka.id} and m.team_role = 'sro'
      order by o.name`);
    expect(sro).toHaveLength(6);
    expect(sro.map((row) => row.name)).toContain('Rheintal Elektronik');
    const [lp] = await query<{ lead: string; suppliers: number }>(sql`
      select g.lead_user_id as lead,
        (select count(*)::int from relationship_material_group rg where rg.material_group_id = g.id)
          as suppliers
      from material_group g where g.org_id = ${hollmann.org.id} and g.code = 'LP'`);
    expect(lp).toMatchObject({ lead: hollmannPeople.saraOst.id, suppliers: 5 });
  });

  it('Rheintal hat fünf Personen und einen zweiten Kunden, Halder Maschinenbau, ohne Querfluss', async () => {
    const rheintal = hollmannSuppliers.find((entry) => entry.key === 'rheintal');
    const people = await query<{ id: string }>(
      sql`select id from app_user where organization_id = ${rheintal?.id ?? ''} order by id`,
    );
    expect(people.map((row) => row.id)).toEqual(
      [
        supplierPeople.kimKaiser.id,
        supplierPeople.leaBrandt.id,
        supplierPeople.miaKuhn.id,
        supplierPeople.nilsOtt.id,
        supplierPeople.tomWeber.id,
      ].sort(),
    );
    const customers = await query<{ buyer: string }>(sql`
      select b.name as buyer from relationship r join organization b on b.id = r.buyer_org_id
      where r.supplier_org_id = ${rheintal?.id ?? ''} order by b.name`);
    expect(customers.map((row) => row.buyer)).toEqual(['Halder Maschinenbau', 'Hollmann Antriebe']);
  });

  it('JBP Rheintal am Fr 04.12., 10:00 bis 12:00', async () => {
    const [jbp] = await query<{ starts_at: Date; duration_minutes: number; type: string }>(sql`
      select starts_at, duration_minutes, type from meeting
      where owner_org_id = ${hollmann.org.id} and type = 'jbp'`);
    expect(new Date(jbp?.starts_at ?? 0).toISOString()).toBe('2026-12-04T09:00:00.000Z');
    expect(jbp?.duration_minutes).toBe(120);
  });

  it('KI-03: jeder Entwurf im Seed hat zu jeder Aussage eine Quelle, wie createBuyerDraft es verlangt', async () => {
    const drafts = await query<{ id: string; claims: number; missing: number }>(sql`
      select d.id, jsonb_array_length(d.claims)::int as claims,
             (select count(*)::int from jsonb_array_elements(d.claims) c
               where not exists (select 1 from ai_source s
                                  where s.draft_id = d.id and s.claim_key = c ->> 'key')) as missing
        from ai_draft d
       where d.org_id = ${hollmann.org.id} and d.status = 'draft'`);
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.filter((draft) => draft.claims === 0 || draft.missing > 0)).toEqual([]);
  });

  it('G-10: nur synthetische Personen; die Demo-Sitzung findet sie, andere Mandanten nicht', async () => {
    const emails = await query<{ email: string }>(sql`
      select u.email from app_user u join organization o on o.id = u.organization_id
      where o.is_demo`);
    expect(emails.length).toBeGreaterThanOrEqual(15);
    expect(emails.every((row) => row.email.endsWith('.example'))).toBe(true);
    const listed = await query<{ id: string }>(sql`select id from app_demo_personen()`);
    expect(listed.map((row) => row.id)).toContain(hollmannPeople.janLuka.id);
    expect(listed.map((row) => row.id)).toContain(supplierPeople.kimKaiser.id);
  });

  // ZQ-01, DM-01 K2 (K2-a.5): Zusagen 2026 zwischen Hollmann und Rheintal wie in L-Ueberblick
  const rheintal = hollmannSuppliers.find((entry) => entry.key === 'rheintal');
  const rates = async () => {
    const rows = await query<{ side: string; kept: number; due: number }>(sql`
      select side, kept, due from commitment_rate
      where relationship_id = ${rheintal?.relationshipId} and year = 2026 order by side`);
    return Object.fromEntries(
      rows.map((row) => [
        row.side,
        `${row.kept}/${row.due} ${Math.round((100 * row.kept) / row.due)} %`,
      ]),
    );
  };

  it('Zusagequote 2026: Hollmann 9 von 10 (90 %), Rheintal 7 von 9 (78 %)', async () => {
    expect(await rates()).toEqual({ buyer: '9/10 90 %', supplier: '7/9 78 %' });
    // 16 gehaltene Zusagen; zuletzt gehalten hat Hollmann die Abrufmengen
    const [last] = await query<{ title: string; side: string }>(sql`
      select title, side from commitment
      where relationship_id = ${rheintal?.relationshipId} and status = 'kept'
      order by done_at desc limit 1`);
    expect(last).toEqual({ title: 'Abrufmengen 6 Monate im Voraus', side: 'buyer' });
    const [kept] = await query<{ n: number }>(sql`
      select count(*)::int as n from commitment
      where relationship_id = ${rheintal?.relationshipId} and status = 'kept'`);
    expect(kept?.n).toBe(16);
  });

  it('sechs offene Zusagen wie in der Akte; die Musterteile hat Rheintal noch nicht bestätigt', async () => {
    const open = await query<{
      title: string;
      side: string;
      owner_name: string;
      due_on: string;
      confirm_state: string;
    }>(sql`
      select title, side, owner_name, due_on::text, confirm_state from commitment
      where relationship_id = ${rheintal?.relationshipId} and status = 'open'
      order by due_on, title`);
    expect(open).toEqual([
      {
        title: '8D-Bericht Charge 4711',
        side: 'supplier',
        owner_name: 'Nils Ott',
        due_on: '2026-11-05',
        confirm_state: 'both_confirmed',
      },
      {
        title: 'Beitrag Machbarkeit Lieferzeit',
        side: 'supplier',
        owner_name: 'Tom Weber',
        due_on: '2026-11-27',
        confirm_state: 'both_confirmed',
      },
      {
        title: 'Musterteile Starrflex liefern',
        side: 'supplier',
        owner_name: 'Kim Kaiser',
        due_on: '2026-12-15',
        confirm_state: 'buyer_confirmed',
      },
      {
        title: 'Prognose monatlich teilen',
        side: 'buyer',
        owner_name: 'Ida Roth',
        due_on: '2026-12-15',
        confirm_state: 'both_confirmed',
      },
      {
        title: 'Prognose 2028 teilen',
        side: 'buyer',
        owner_name: 'Ida Roth',
        due_on: '2027-01-31',
        confirm_state: 'both_confirmed',
      },
      {
        title: 'Abnahmeplan SMT-Linie',
        side: 'supplier',
        owner_name: 'Kim Kaiser',
        due_on: '2027-02-28',
        confirm_state: 'both_confirmed',
      },
    ]);
    // Herkunft: Feedback-Lücke und Gemeinsamer Plan 2026
    const origins = await query<{
      title: string;
      source_type: string | null;
      in_plan: boolean;
    }>(sql`
      select title, source_type, jbp_id is not null as in_plan from commitment
      where relationship_id = ${rheintal?.relationshipId}
        and title in ('Prognose monatlich teilen', 'Abnahmeplan SMT-Linie') order by title`);
    expect(origins).toEqual([
      { title: 'Abnahmeplan SMT-Linie', source_type: null, in_plan: true },
      { title: 'Prognose monatlich teilen', source_type: 'feedback', in_plan: false },
    ]);
  });

  it('T2-05: Eine verfehlte Zusage von Rheintal senkt die Quote von 78 auf 70 % (7 von 10); eine nur einseitig bestätigte zählt nicht', async () => {
    const mark = (title: string, status: 'missed' | 'open') =>
      temp.db.execute(sql`
        update commitment set status = ${status}, done_at = ${status === 'missed' ? hollmannStart : null}
        where relationship_id = ${rheintal?.relationshipId} and title = ${title}`);
    try {
      await mark('8D-Bericht Charge 4711', 'missed');
      expect((await rates()).supplier).toBe('7/10 70 %');
      // Nur von Hollmann bestätigt: zählt nicht, auch wenn sie verfehlt ist
      await mark('Musterteile Starrflex liefern', 'missed');
      expect((await rates()).supplier).toBe('7/10 70 %');
    } finally {
      await mark('8D-Bericht Charge 4711', 'open');
      await mark('Musterteile Starrflex liefern', 'open');
    }
    expect(await rates()).toEqual({ buyer: '9/10 90 %', supplier: '7/9 78 %' });
  });
});
