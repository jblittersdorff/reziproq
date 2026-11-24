import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generatedLayerTables } from './layers.js';
import { seedBuyers } from './seed.js';
import { withTenant } from './tenant.js';
import { createTempDatabase } from './testing/temp-database.js';

// Tests zu docs/specs/PLT-05.md, Teil b, direkt in der Datenbank: Team je Beziehung.

const testOem = seedBuyers.testOem.id;
const zweitOem = seedBuyers.zweitOem.id;
// Rheintal Elektronik beim Test-OEM (erste Beziehung der Beispieldaten)
const rheintal = 'de300000-0000-7000-8000-000000000201';

describe('PLT-05b: Team je Beziehung in der Datenbank', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;

  const asTestOem = (statement: ReturnType<typeof sql>) =>
    withTenant(temp.db, { userId: 'demo-test-oem-1', organizationId: testOem }, (tx) =>
      tx.execute(statement),
    ).catch((caught: unknown) => caught as Error);

  beforeAll(async () => {
    temp = await createTempDatabase({ from: 'seeded' });
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('Beispieldaten: fünf Teams mit SRO, Sponsor und Mitgliedern, einmal mit Teamrolle Leser', async () => {
    const teams = await temp.db.execute<{ roles: string[] }>(sql`
      select array_agg(team_role order by team_role) as roles from relationship_member
      group by relationship_id order by relationship_id
    `);
    // Dazu der Test-Lieferant mit Lena als SRO allein, für die offene Einladung (LIF-01a).
    expect(teams.rows).toHaveLength(6);
    expect(teams.rows.filter((row) => row.roles.length >= 3)).toHaveLength(5);
    expect(teams.rows.filter((row) => row.roles.includes('sro'))).toHaveLength(6);
    expect(teams.rows.filter((row) => row.roles.includes('viewer'))).toHaveLength(1);
  });

  it('Der Zweit-OEM sieht das Team des Test-OEM nicht (Prüfungen aus PLT-04)', async () => {
    const seen = await withTenant(
      temp.db,
      { userId: 'demo-zweit-oem-1', organizationId: zweitOem },
      async (tx) => (await tx.execute(sql`select * from relationship_member`)).rows,
    );
    expect(seen).toEqual([]);
    // Das Gerüst aus PLT-04 prüft die Tabelle automatisch mit.
    expect(generatedLayerTables().map((entry) => entry.table)).toContain('relationship_member');
  });

  it('erlaubt höchstens einen SRO, zwei Sponsoren und jede Person einmal', async () => {
    // Zweiter SRO
    const sro = await asTestOem(sql`
      update relationship_member set team_role = 'sro'
      where relationship_id = ${rheintal} and user_id = 'demo-test-oem-3'
    `);
    expect(String((sro as Error).cause)).toMatch(/relationship_member_ein_sro/);

    // Dritter Sponsor
    await asTestOem(sql`
      update relationship_member set team_role = 'sponsor'
      where relationship_id = ${rheintal} and user_id = 'demo-test-oem-3'
    `);
    const third = await asTestOem(sql`
      update relationship_member set team_role = 'sponsor'
      where relationship_id = ${rheintal} and user_id = 'demo-test-oem-1'
    `);
    expect(String((third as Error).cause)).toMatch(/Höchstens zwei Sponsoren/);

    // Dieselbe Person zweimal
    const twice = await asTestOem(sql`
      insert into relationship_member (relationship_id, org_id, user_id, team_role)
      values (${rheintal}, ${testOem}, 'demo-test-oem-2', 'member')
    `);
    expect(String((twice as Error).cause)).toMatch(/relationship_member_je_person/);
  });
});
