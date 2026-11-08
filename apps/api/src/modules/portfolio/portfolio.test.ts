import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  defaultSegmentCriteria,
  defaultSegmentTypes,
  lastFullYear,
  portfolioMatrixSchema,
  portfolioOpenSchema,
  portfolioSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { largestDeviation, openGroups } from './open-decisions.js';

describe('SEG-07 Portfolio über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), zweit: randomUUID() };
  const suppliers = Array.from({ length: 4 }, () => ({ org: randomUUID(), id: randomUUID() }));
  const [decided, waiting, calm, split] = suppliers as [
    (typeof suppliers)[number],
    (typeof suppliers)[number],
    (typeof suppliers)[number],
    (typeof suppliers)[number],
  ];
  const users = {
    admin: `pf-admin-${run}`,
    member: `pf-member-${run}`,
    sro: `pf-sro-${run}`,
    zweit: `pf-zweit-${run}`,
    supplier: `pf-sup-${run}`,
  };
  const roundId = randomUUID();
  const unit = randomUUID();
  const group = randomUUID();
  const criteria = defaultSegmentCriteria.map((criterion) => criterion.key);
  const year = lastFullYear();
  const typeName = (impact: number, quality: number) =>
    defaultSegmentTypes.find((t) => t.impactLevel === impact && t.qualityLevel === quality)?.name;

  const get = async (user: string, path: string) => {
    const response = await fetch(`${testApp.baseUrl}/api${path}`, {
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: user })}` },
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };
  const person = (id: string, role: 'admin' | 'member', organizationId: string) => ({
    id,
    name: `Person ${id}`,
    givenName: 'Pat',
    email: `${id}@example.com`,
    organizationId,
    orgRole: role,
    rolesImportedAt: new Date(),
  });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `PF-OEM ${run}` },
      { id: orgs.zweit, name: `PF-Zweit ${run}` },
      ...suppliers.map((entry, index) => ({
        id: entry.org,
        name: `PF-Lieferant ${index} ${run}`,
      })),
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' },
      { organizationId: orgs.zweit, feature: 'buyer' },
    ]);
    await db
      .insert(schema.appUser)
      .values([
        person(users.admin, 'admin', orgs.oem),
        person(users.member, 'member', orgs.oem),
        person(users.sro, 'member', orgs.oem),
        person(users.zweit, 'admin', orgs.zweit),
        person(users.supplier, 'admin', suppliers[0]?.org ?? ''),
      ]);
    await insertRelationships(
      db,
      suppliers.map((entry, index) => ({
        id: entry.id,
        buyer: orgs.oem,
        supplier: entry.org,
        spend: [{ year, amountCents: (index + 1) * 1_000_000 }],
      })),
    );
    await db.insert(schema.relationshipMember).values({
      relationshipId: split.id,
      orgId: orgs.oem,
      userId: users.sro,
      teamRole: 'sro',
    });
    await db
      .insert(schema.businessUnit)
      .values({ id: unit, orgId: orgs.oem, name: 'Antrieb', code: `A-${run}` });
    await db
      .insert(schema.materialGroup)
      .values({ id: group, orgId: orgs.oem, name: 'Stahl', code: `S-${run}` });
    const [model] = await db
      .insert(schema.segmentModel)
      .values({
        orgId: orgs.oem,
        version: 1,
        status: 'active',
        lowMax: 33,
        midMax: 66,
        activatedAt: new Date(),
      })
      .returning({ id: schema.segmentModel.id });
    if (!model) throw new Error('Modell fehlt');
    await db
      .insert(schema.segmentCriterion)
      .values(defaultSegmentCriteria.map((criterion) => ({ ...criterion, modelId: model.id })));
    await db
      .insert(schema.segmentType)
      .values(defaultSegmentTypes.map((type) => ({ ...type, modelId: model.id })));
    await db.insert(schema.segmentationRound).values({
      id: roundId,
      orgId: orgs.oem,
      name: 'Runde',
      dueDate: '2099-12-31',
      status: 'open',
      modelVersion: 1,
      createdBy: users.admin,
    });
    const assign = async (relationshipId: string, status: 'open' | 'submitted', ist: number) => {
      const [row] = await db
        .insert(schema.ratingAssignment)
        .values({
          roundId,
          relationshipId,
          businessUnitId: unit,
          function: ist > 50 ? 'quality' : 'purchasing',
          raterUserId: users.member,
          status,
        })
        .returning({ id: schema.ratingAssignment.id });
      if (!row) throw new Error('Zuordnung fehlt');
      if (status === 'submitted') {
        await db.insert(schema.rating).values(
          criteria.map((criterionKey) => ({
            assignmentId: row.id,
            relationshipId,
            criterionKey,
            modelVersion: 1,
            ist,
            soll: ist,
            submittedAt: new Date(),
          })),
        );
      }
    };
    await assign(waiting.id, 'open', 50);
    await assign(calm.id, 'submitted', 52);
    await assign(split.id, 'submitted', 10);
    await assign(split.id, 'submitted', 90);
    const decision = (scope: 'total' | 'bu_mg', ist: [number, number], soll: [number, number]) => ({
      relationshipId: decided.id,
      scope,
      businessUnitId: scope === 'bu_mg' ? unit : null,
      materialGroupId: scope === 'bu_mg' ? group : null,
      istImpactLevel: ist[0],
      istQualityLevel: ist[1],
      sollImpactLevel: soll[0],
      sollQualityLevel: soll[1],
      reason: 'Test',
      modelVersion: 1,
      decidedBy: users.admin,
      version: 1,
    });
    await db
      .insert(schema.segmentDecision)
      .values([decision('total', [2, 2], [3, 3]), decision('bu_mg', [1, 1], [2, 3])]);
  });

  afterAll(async () => {
    await deleteRelationships(db, [...Object.values(orgs), ...suppliers.map((entry) => entry.org)]);
    await db.delete(schema.businessUnit).where(sql`${schema.businessUnit.orgId} = ${orgs.oem}`);
    await db.delete(schema.materialGroup).where(sql`${schema.materialGroup.orgId} = ${orgs.oem}`);
    await db.delete(schema.segmentModel).where(sql`${schema.segmentModel.orgId} = ${orgs.oem}`);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db
      .delete(schema.organization)
      .where(
        sql`${schema.organization.id} in ${[...Object.values(orgs), ...suppliers.map((s) => s.org)]}`,
      );
    await testApp.close();
  });

  it('die Matrix zeigt Typen und Spend aus der Konsolidierung', async () => {
    const { body, status } = await get(users.member, '/portfolio/matrix');
    expect(status).toBe(200);
    const matrix = portfolioMatrixSchema.parse(body);
    expect(matrix.points).toHaveLength(1);
    expect(matrix.points[0]).toMatchObject({
      relationshipId: decided.id,
      spendCents: 1_000_000,
      ist: { impactLevel: 2, qualityLevel: 2, typeName: typeName(2, 2) },
      soll: { impactLevel: 3, qualityLevel: 3, typeName: typeName(3, 3) },
    });
  });

  it('die Filter wirken und lesen die Zeilen je BU und Warengruppe', async () => {
    const filtered = portfolioMatrixSchema.parse(
      (await get(users.member, `/portfolio/matrix?businessUnitId=${unit}&materialGroupId=${group}`))
        .body,
    );
    expect(filtered.points).toHaveLength(1);
    expect(filtered.points[0]?.ist.impactLevel).toBe(1);
    expect(filtered.points[0]?.soll.qualityLevel).toBe(3);
    expect(filtered.points[0]?.businessUnit?.name).toBe('Antrieb');
    expect(filtered.businessUnits.map((entry) => entry.id)).toContain(unit);
    const other = portfolioMatrixSchema.parse(
      (await get(users.member, `/portfolio/matrix?businessUnitId=${randomUUID()}`)).body,
    );
    expect(other.points).toEqual([]);
    expect((await get(users.member, '/portfolio/matrix?businessUnitId=kaputt')).status).toBe(400);
  });

  it('jede Gruppe der offenen Entscheidungen enthält den richtigen Lieferanten', async () => {
    const open = portfolioOpenSchema.parse((await get(users.admin, '/portfolio/open')).body);
    const ids = (key: keyof typeof open.groups) =>
      open.groups[key].map((item) => item.relationshipId);
    expect(ids('ratings_open')).toEqual([waiting.id]);
    expect(ids('not_consolidated')).toEqual([calm.id]);
    expect(ids('deviation')).toEqual([split.id]);
    expect(open.groups.deviation[0]?.deviation).toBe(40);
    expect(open.deviationThreshold).toBe(30);
  });

  it('die Kacheln zählen Matrix, offene Entscheidungen und laufende Runden', async () => {
    const tiles = portfolioSchema.parse((await get(users.admin, '/portfolio')).body);
    expect(tiles).toEqual({ matrixCount: 1, openCount: 3, openRounds: 1, focusCount: 0 });
  });

  it('der Schwellwert für Abweichungen steuert die Gruppe', async () => {
    await db
      .update(schema.segmentModel)
      .set({ deviationThreshold: 50 })
      .where(sql`${schema.segmentModel.orgId} = ${orgs.oem}`);
    const open = portfolioOpenSchema.parse((await get(users.admin, '/portfolio/open')).body);
    expect(open.deviationThreshold).toBe(50);
    expect(open.groups.deviation).toEqual([]);
    expect(open.groups.not_consolidated.map((item) => item.relationshipId).sort()).toEqual(
      [calm.id, split.id].sort(),
    );
  });

  it('offene Entscheidungen sieht nur, wer die Beziehung verantwortet', async () => {
    const own = portfolioOpenSchema.parse((await get(users.sro, '/portfolio/open')).body);
    expect(
      Object.values(own.groups)
        .flat()
        .map((item) => item.relationshipId),
    ).toEqual([split.id]);
    const other = portfolioOpenSchema.parse((await get(users.member, '/portfolio/open')).body);
    expect(Object.values(other.groups).flat()).toEqual([]);
  });

  it('Zweit-OEM und Lieferant sehen keine fremden Lieferanten', async () => {
    const zweit = portfolioMatrixSchema.parse((await get(users.zweit, '/portfolio/matrix')).body);
    expect(zweit.points).toEqual([]);
    expect((await get(users.supplier, '/portfolio')).status).toBe(403);
    expect((await get(users.supplier, '/portfolio/matrix')).status).toBe(403);
    expect((await get(users.supplier, '/portfolio/open')).status).toBe(403);
  });

  it('ohne Eingaben entsteht kein offener Eintrag und keine Abweichung', () => {
    expect(openGroups([], 30)).toEqual({ ratings_open: [], not_consolidated: [], deviation: [] });
    expect(largestDeviation([])).toBeNull();
  });
});
