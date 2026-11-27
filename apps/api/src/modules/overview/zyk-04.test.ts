import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { cycleStatusSchema, supplierOverviewSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/ZYK-04.md: Stand der Zyklen aller Fokuslieferanten, gerechnet wie ZYK-01 und
// ZYK-02, Sortierung und Filter in der Adresse, „Termin fehlt“ oben, schnell bei 50 Lieferanten.
describe('ZYK-04 Stand der Zyklen', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const buyer = randomUUID();
  const suppliers = Array.from({ length: 50 }, () => randomUUID());
  const rels = suppliers.map(() => randomUUID());
  const unit = randomUUID();
  const users = { lead: `zyk4-lead-${run}`, sroA: `zyk4-a-${run}`, sroB: `zyk4-b-${run}` };
  const iso = (offsetDays: number) =>
    new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

  const call = async (user: string, url: string) => {
    const response = await fetch(`${testApp.baseUrl}/api${url}`, {
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: user })}` },
    });
    return { status: response.status, body: (await response.json()) as unknown };
  };
  const status = async (query = '') =>
    cycleStatusSchema.parse((await call(users.lead, `/portfolio/zyklen${query}`)).body);

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: buyer, name: `ZYK4-OEM ${run}` },
      ...suppliers.map((id, index) => ({
        id,
        name: `ZYK4 Lieferant ${String(index).padStart(2, '0')} ${run}`,
      })),
    ]);
    await db.insert(schema.organizationFeature).values({ organizationId: buyer, feature: 'buyer' });
    const person = (id: string, name: string) => ({
      id,
      name,
      email: `${id}@example.com`,
      organizationId: buyer,
      orgRole: 'member' as const,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.lead, 'Lea Leitung'),
        person(users.sroA, 'Anna Amsel'),
        person(users.sroB, 'Bernd Berg'),
      ]);
    await insertRelationships(
      db,
      rels.map((id, index) => ({ id, buyer, supplier: suppliers[index] as string })),
    );
    await db
      .insert(schema.relationshipSide)
      .values(rels.map((relationshipId) => ({ relationshipId, orgId: buyer, isFocus: true })));
    await db.insert(schema.relationshipMember).values(
      rels.map((relationshipId, index) => ({
        relationshipId,
        orgId: buyer,
        userId: index % 2 === 0 ? users.sroA : users.sroB,
        teamRole: 'sro' as const,
      })),
    );
    await db.insert(schema.businessUnit).values({
      id: unit,
      orgId: buyer,
      name: `Antriebe ${run}`,
      code: `A-${run}`,
    });
    await db
      .insert(schema.relationshipBusinessUnit)
      .values(rels.slice(0, 5).map((relationshipId) => ({ relationshipId, businessUnitId: unit })));
    // Zyklen: 0–1 ohne JBP-Termin, 2–9 mit Termin in 10 Tagen (frühe Schritte verpasst),
    // die übrigen mit Termin in einem Jahr (im Plan). Der letzte hat keinen aktiven Zyklus.
    await db.insert(schema.cycle).values(
      rels.slice(0, 49).map((relationshipId, index) => ({
        relationshipId,
        label: '2026',
        status: 'active' as const,
        jbpDate: index < 2 ? null : index < 10 ? iso(10) : iso(365 + index),
      })),
    );
  });

  afterAll(async () => {
    await db.execute(sql`delete from cycle where relationship_id in ${rels}`);
    await db.execute(sql`delete from relationship_business_unit where relationship_id in ${rels}`);
    await deleteRelationships(db, [buyer, ...suppliers]);
    await db.execute(sql`delete from business_unit where org_id = ${buyer}`);
    await db.execute(sql`delete from app_user where organization_id = ${buyer}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${buyer}`);
    await db.execute(sql`delete from organization where id in ${[buyer, ...suppliers]}`);
    await testApp.close();
  });

  it('Schritt, Fälligkeit und Verzug stimmen mit ZYK-01 und ZYK-02 überein und sind nirgends gespeichert', async () => {
    const result = await status();
    for (const index of [2, 20]) {
      const row = result.rows.find((entry) => entry.relationshipId === rels[index]);
      const overview = supplierOverviewSchema.parse(
        (await call(users.lead, `/suppliers/${rels[index]}/overview`)).body,
      );
      const current = overview.cycle?.steps.find((step) =>
        ['open', 'in_progress', 'overdue'].includes(step.status),
      );
      expect(row?.step).toBe(current?.key);
      expect(row?.dueDate).toBe(current?.dueDate);
      expect(row?.jbpDate).toBe(overview.cycle?.jbpDate);
      const overdue = overview.cycle?.steps.filter((step) => step.status === 'overdue') ?? [];
      expect((row?.daysOverdue ?? 0) > 0).toBe(overdue.length > 0);
    }
    expect(result.metrics).toEqual({ total: 49, onTrack: 41, overdue: 8 });
    // Gerechnet, nicht gespeichert: Ein anderer JBP-Termin ändert Fälligkeit und Verzug sofort.
    await db.execute(
      sql`update cycle set jbp_date = ${iso(400)} where relationship_id = ${rels[2]}`,
    );
    const moved = (await status()).rows.find((entry) => entry.relationshipId === rels[2]);
    expect(moved?.daysOverdue).toBe(0);
    await db.execute(
      sql`update cycle set jbp_date = ${iso(10)} where relationship_id = ${rels[2]}`,
    );
    // Mehrere Abrufe mit 50 Lieferanten; die Zeit misst der eigene Test unten.
  }, 30_000);

  it('Fokuslieferanten ohne Termin stehen oben mit „Termin fehlt“', async () => {
    const result = await status();
    // Ohne Zyklus (Index 49) und ohne JBP-Termin (0, 1) stehen vorne.
    expect(new Set(result.rows.slice(0, 3).map((row) => row.relationshipId))).toEqual(
      new Set([rels[0], rels[1], rels[49]]),
    );
    expect(result.rows.slice(0, 3).every((row) => row.jbpDate === null)).toBe(true);
    // Danach nach Verzug, der größte zuerst.
    const rest = result.rows.slice(3).map((row) => row.daysOverdue);
    expect(rest).toEqual([...rest].sort((a, b) => b - a));
  });

  it('Sortierung und Filter wirken und stehen in der Adresse', async () => {
    const byDate = await status('?sortierung=termin');
    const dates = byDate.rows.slice(3).map((row) => row.jbpDate ?? '');
    expect(dates).toEqual([...dates].sort());
    const bySro = await status(`?sro=${users.sroB}`);
    expect(bySro.rows).toHaveLength(25);
    expect(bySro.rows.every((row) => row.sro === 'Bernd Berg')).toBe(true);
    const byUnit = await status(`?bu=${unit}`);
    expect(byUnit.rows.map((row) => row.relationshipId).sort()).toEqual(rels.slice(0, 5).sort());
    expect(byUnit.options.businessUnits).toEqual([{ id: unit, name: `Antriebe ${run}` }]);
    expect((await call(users.lead, '/portfolio/zyklen?sortierung=quer')).status).toBe(400);
  });

  it('Die Seite zeigt alle 50 Fokuslieferanten', async () => {
    expect((await status()).rows).toHaveLength(50);
  });

  // Die Zeitmessung läuft allein im Schritt test:perf von pnpm check (REZIPROQ_PERF=1), nicht neben
  // allen Testdateien: Unter deren Last brauchte die Abfrage einmal 2,8 s, allein deutlich unter 2 s
  it.skipIf(process.env.REZIPROQ_PERF !== '1')(
    'Die Seite lädt bei 50 Fokuslieferanten in unter zwei Sekunden (Zeitmessung)',
    async () => {
      const started = performance.now();
      const result = await status();
      expect(performance.now() - started).toBeLessThan(2000);
      expect(result.rows).toHaveLength(50);
    },
  );
});
