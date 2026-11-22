import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { overviewInsightSchema, supplierRingsSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/AW-01.md in der API: Ringpaar der Übersicht und des Lieferanten aus
// bestehenden Daten. Gesichert nur vom Controlling bestätigt, kein äußerer Ring ohne Ziel, der
// innere Ring beim Lieferanten zählt nur fällige Zusagen, keine Summe über Wirkungsarten.
describe('AW-01 Beleg aus bestehenden Daten', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), other: randomUUID(), a: randomUUID(), b: randomUUID() };
  const rel = { a: randomUUID(), b: randomUUID() };
  const jbp = { a: randomUUID(), b: randomUUID() };
  const initiative = randomUUID();
  const group = randomUUID();
  const year = 2026;
  const users = {
    admin: `aw01-adm-${run}`,
    sro: `aw01-sro-${run}`,
    lead: `aw01-lead-${run}`,
    member: `aw01-mem-${run}`,
    other: `aw01-other-${run}`,
    supplier: `aw01-sup-${run}`,
  };

  const call = async (user: string, method: string, url: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api${url}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };
  const overview = async (user = users.admin) =>
    overviewInsightSchema.parse((await call(user, 'GET', `/uebersicht?jahr=${year}`)).body);
  const rings = async (user = users.admin) =>
    supplierRingsSchema.parse(
      (await call(user, 'GET', `/suppliers/${rel.a}/ergebnisse/ringe?jahr=${year}`)).body,
    );

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `AW01-OEM ${run}` },
      { id: orgs.other, name: `AW01-Andere ${run}` },
      { id: orgs.a, name: `AW01-A ${run}` },
      { id: orgs.b, name: `AW01-B ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' },
      { organizationId: orgs.other, feature: 'buyer' },
    ]);
    const person = (id: string, organizationId: string, orgRole: 'admin' | 'member') => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.admin, orgs.oem, 'admin'),
        person(users.sro, orgs.oem, 'member'),
        person(users.lead, orgs.oem, 'member'),
        person(users.member, orgs.oem, 'member'),
        person(users.other, orgs.other, 'admin'),
        person(users.supplier, orgs.a, 'admin'),
      ]);
    await insertRelationships(db, [
      { id: rel.a, buyer: orgs.oem, supplier: orgs.a },
      { id: rel.b, buyer: orgs.oem, supplier: orgs.b },
    ]);
    await db.insert(schema.relationshipSide).values([
      { relationshipId: rel.a, orgId: orgs.oem, isFocus: true, focusReason: 'Test' },
      { relationshipId: rel.b, orgId: orgs.oem, isFocus: true, focusReason: 'Test' },
    ]);
    await db.insert(schema.relationshipMember).values({
      relationshipId: rel.a,
      orgId: orgs.oem,
      userId: users.sro,
      teamRole: 'sro',
    });
    await db.insert(schema.materialGroup).values({
      id: group,
      orgId: orgs.oem,
      name: 'Leiterplatten',
      code: `LP-${run}`,
      leadUserId: users.lead,
    });
    await db
      .insert(schema.relationshipMaterialGroup)
      .values({ relationshipId: rel.a, materialGroupId: group, isPrimary: true });
    const jbpRow = (id: string, relationshipId: string, status: 'approved' | 'draft') => ({
      id,
      relationshipId,
      ownerOrgId: orgs.oem,
      status,
      createdBy: users.admin,
      createdByName: 'Ada Admin',
    });
    await db
      .insert(schema.jbp)
      .values([jbpRow(jbp.a, rel.a, 'approved'), jbpRow(jbp.b, rel.b, 'draft')]);
    await db.insert(schema.initiative).values({
      id: initiative,
      relationshipId: rel.a,
      ownerOrgId: orgs.oem,
      jbpId: jbp.a,
      title: 'Kupferklausel',
      goal: 'Preis',
      benefitBuyer: 'A',
      benefitSupplier: 'B',
      ownerBuyerName: 'Ada',
      ownerSupplierName: 'Kim',
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
      createdBy: users.admin,
      createdByName: 'Ada Admin',
    });
    const value = (
      month: string,
      kind: 'plan' | 'actual',
      valueCents: number,
      effectType = 'ebit',
    ) => ({
      relationshipId: rel.a,
      ownerOrgId: orgs.oem,
      visibility: 'internal' as const,
      initiativeId: initiative,
      month,
      kind,
      valueCents,
      effectType,
    });
    // März bestätigt, April nicht; dazu Plan im Juni
    await db
      .insert(schema.initiativeValue)
      .values([
        value('2026-03-01', 'actual', 3_000_000),
        value('2026-04-01', 'actual', 1_000_000),
        value('2026-06-01', 'plan', 2_000_000),
      ]);
    await db.insert(schema.initiativeValidation).values({
      relationshipId: rel.a,
      initiativeId: initiative,
      periodFrom: '2026-01-01',
      periodTo: '2026-03-31',
      status: 'approved',
      requestedBy: users.sro,
      requestedByName: 'Sara',
      decidedBy: users.admin,
      decidedByName: 'Ada',
      decidedAt: new Date(),
    });
    // Zusagen: zwei im Jahr fällig (eine eingehalten), eine im Vorjahr, eine erst 2027
    const commitment = (dueOn: string, status: 'open' | 'kept' | 'missed') => ({
      relationshipId: rel.a,
      ownerOrgId: orgs.oem,
      jbpId: jbp.a,
      side: 'buyer' as const,
      title: `Zusage ${dueOn}`,
      ownerName: 'Sara',
      dueOn,
      status,
      createdBy: users.sro,
      createdByName: 'Sara',
    });
    await db
      .insert(schema.commitment)
      .values([
        commitment('2026-02-01', 'kept'),
        commitment('2026-03-01', 'missed'),
        commitment('2025-06-01', 'kept'),
        commitment('2027-01-15', 'open'),
      ]);
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    await db.execute(sql`delete from value_opportunity where org_id in ${orgIds}`);
    await db.execute(sql`delete from relationship_ebit_target where org_id in ${orgIds}`);
    await db.execute(sql`delete from org_setting where org_id in ${orgIds}`);
    await db.execute(sql`delete from commitment where relationship_id in ${Object.values(rel)}`);
    await db.execute(sql`delete from initiative_validation where initiative_id = ${initiative}`);
    await db.execute(sql`delete from initiative_value where initiative_id = ${initiative}`);
    await db.execute(sql`delete from initiative where id = ${initiative}`);
    await db.execute(sql`delete from jbp where relationship_id in ${Object.values(rel)}`);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('gesichert zählt nur vom Controlling bestätigte Monate; EBIT und Cash stehen getrennt', async () => {
    const data = await overview();
    expect(data.securedEbitCents).toBe(3_000_000);
    expect(data.focusTotal).toBe(2);
    expect(data.focusWithApprovedJbp).toBe(1);
    expect(data.cashCents).toBe(0);
    expect(data.inProgress.highCents).toBeGreaterThanOrEqual(2_000_000);
  });

  it('ohne Jahresziel gibt es keinen äußeren Ring; Admin und Lead setzen es, andere nicht', async () => {
    expect((await overview()).goalEbitCents).toBeNull();
    expect((await overview(users.member)).canSetGoal).toBe(false);
    expect(
      (await call(users.member, 'PUT', '/uebersicht/ziel', { year, amountCents: 6_000_000 }))
        .status,
    ).toBe(403);
    expect((await overview(users.lead)).canSetGoal).toBe(true);
    expect(
      (await call(users.lead, 'PUT', '/uebersicht/ziel', { year, amountCents: 6_000_000 })).status,
    ).toBe(204);
    expect((await overview()).goalEbitCents).toBe(6_000_000);
  });

  it('der innere Ring beim Lieferanten zählt nur Zusagen, die im Zeitraum fällig waren', async () => {
    const data = await rings();
    expect(data.securedEbitCents).toBe(3_000_000);
    expect(data.commitments).toEqual({ due: 2, keptOnTime: 1 });
  });

  it('das Ziel des Lieferanten schlägt der SRO vor, Admin oder Lead gibt frei; erst dann zählt es', async () => {
    expect((await rings()).target).toBeNull();
    expect(
      (
        await call(users.member, 'PUT', `/suppliers/${rel.a}/ergebnisse/ziel`, {
          year,
          amountCents: 5_000_000,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(users.sro, 'PUT', `/suppliers/${rel.a}/ergebnisse/ziel`, {
          year,
          amountCents: 5_000_000,
        })
      ).status,
    ).toBe(204);
    expect((await rings(users.sro)).target).toMatchObject({
      ebitTargetCents: 5_000_000,
      approved: false,
    });
    expect((await rings(users.sro)).canApprove).toBe(false);
    expect(
      (await call(users.sro, 'POST', `/suppliers/${rel.a}/ergebnisse/ziel/freigeben`, { year }))
        .status,
    ).toBe(403);
    expect(
      (await call(users.lead, 'POST', `/suppliers/${rel.a}/ergebnisse/ziel/freigeben`, { year }))
        .status,
    ).toBe(204);
    expect((await rings()).target).toMatchObject({ approved: true });
  });

  it('die Karte „Größte Chance“ nimmt das offene Potenzial mit der höchsten unteren Spanne, ohne low', async () => {
    expect((await rings()).chance).toBeNull();
    const row = (confidence: 'low' | 'medium' | 'high', low: number, status = 'new' as const) => ({
      orgId: orgs.oem,
      relationshipId: rel.a,
      templateKey: 'index_clause',
      templateVersion: 1,
      title: 'Preisgleitklausel nach Index',
      reason: 'Test',
      impactType: 'ebit' as const,
      buyerLowCents: low,
      buyerHighCents: low * 2,
      confidence,
      confidenceReason: 'test',
      inputs: {},
      status,
    });
    await db.insert(schema.valueOpportunity).values([row('low', 9_000_000)]);
    expect((await rings()).chance).toBeNull();
    await db
      .insert(schema.valueOpportunity)
      .values([row('medium', 3_000_000), row('high', 5_000_000)]);
    expect((await rings()).chance).toMatchObject({
      low: 5_000_000,
      high: 10_000_000,
      confidence: 'high',
    });
  });

  it('ein fremder Käufer und der Test-Lieferant sehen keinen Ring und keine Zahl', async () => {
    expect((await call(users.other, 'GET', `/suppliers/${rel.a}/ergebnisse/ringe`)).status).toBe(
      404,
    );
    const other = await overview(users.other);
    expect(other).toMatchObject({ securedEbitCents: 0, focusTotal: 0 });
    expect((await call(users.supplier, 'GET', '/uebersicht')).status).toBe(403);
    expect((await call(users.supplier, 'GET', `/suppliers/${rel.a}/ergebnisse/ringe`)).status).toBe(
      403,
    );
  });
});
