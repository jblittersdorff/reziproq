import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  nordwind,
  nordwindPeople,
  nordwindStart,
  nordwindSuppliers,
  seedNordwind,
  supplierPeople,
} from './nordwind.js';
import { createTempDatabase } from './testing/temp-database.js';

// DM-01, E-K0-04, G-10 (K1-b.3): Der Demo-Mandant Nordwind ist ein eigener Mandant mit
// synthetischen Personen und den Zahlen der Bildvorlagen; der Seed läuft beliebig oft.
describe('demo:nordwind', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;
  const query = async <T extends Record<string, unknown>>(statement: ReturnType<typeof sql>) =>
    (await temp.db.execute<T>(statement)).rows;

  beforeAll(async () => {
    temp = await createTempDatabase({ from: 'migrated' });
    await seedNordwind(temp.db, { nodeEnv: 'development' });
    // Ein zweiter Lauf ändert nichts und verdoppelt nichts
    await seedNordwind(temp.db, { nodeEnv: 'development' });
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('bricht im Betrieb ab', async () => {
    await expect(seedNordwind(temp.db, { nodeEnv: 'production' })).rejects.toThrow(/Vorführungen/);
  });

  it('Nordwind ist ein Demo-Mandant mit Uhr Mo 23.11., 07:30 und abgespielten Antworten', async () => {
    const [org] = await query<{ is_demo: boolean; demo_now: Date; ai_mode: string }>(
      sql`select is_demo, demo_now, ai_mode from organization where id = ${nordwind.org.id}`,
    );
    expect(org).toMatchObject({ is_demo: true, ai_mode: 'replay' });
    expect(new Date(org?.demo_now ?? 0).toISOString()).toBe(nordwindStart.toISOString());
    // Alle Organisationen der Geschichte sind Demo-Mandanten: Nordwind, Halder, 16 Lieferanten
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
      where r.buyer_org_id = ${nordwind.org.id}`);
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
      where m.user_id = ${nordwindPeople.janLuka.id} and m.team_role = 'sro'
      order by o.name`);
    expect(sro).toHaveLength(6);
    expect(sro.map((row) => row.name)).toContain('Rheintal Elektronik');
    const [lp] = await query<{ lead: string; suppliers: number }>(sql`
      select g.lead_user_id as lead,
        (select count(*)::int from relationship_material_group rg where rg.material_group_id = g.id)
          as suppliers
      from material_group g where g.org_id = ${nordwind.org.id} and g.code = 'LP'`);
    expect(lp).toMatchObject({ lead: nordwindPeople.saraOst.id, suppliers: 5 });
  });

  it('Rheintal hat fünf Personen und einen zweiten Kunden, Halder Maschinenbau, ohne Querfluss', async () => {
    const rheintal = nordwindSuppliers.find((entry) => entry.key === 'rheintal');
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
    expect(customers.map((row) => row.buyer)).toEqual(['Halder Maschinenbau', 'Nordwind Antriebe']);
  });

  it('JBP Rheintal am Fr 04.12., 10:00 bis 12:00', async () => {
    const [jbp] = await query<{ starts_at: Date; duration_minutes: number; type: string }>(sql`
      select starts_at, duration_minutes, type from meeting
      where owner_org_id = ${nordwind.org.id} and type = 'jbp'`);
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
       where d.org_id = ${nordwind.org.id} and d.status = 'draft'`);
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
    expect(listed.map((row) => row.id)).toContain(nordwindPeople.janLuka.id);
    expect(listed.map((row) => row.id)).toContain(supplierPeople.kimKaiser.id);
  });
});
