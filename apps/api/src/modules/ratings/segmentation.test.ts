import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  calculateSegment,
  defaultSegmentCriteria,
  defaultSegmentTypes,
  segmentationSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

describe('SEG-05 Segmentierung je Lieferant über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const relationship = randomUUID();
  const emptyRelationship = randomUUID();
  const emptySupplier = randomUUID();
  const users = {
    admin: `seg-admin-${run}`,
    raterA: `seg-a-${run}`,
    raterA2: `seg-a2-${run}`,
    raterB: `seg-b-${run}`,
    supplier: `seg-sup-${run}`,
  };
  const roundId = randomUUID();
  const units = { a: randomUUID(), b: randomUUID() };
  const criteria = defaultSegmentCriteria.map((criterion) => criterion.key);
  const model = {
    gridSize: 3 as const,
    lowMax: 33,
    midMax: 66,
    criteria: defaultSegmentCriteria,
    types: defaultSegmentTypes,
  };

  const get = async (user: string, id = relationship) => {
    const response = await fetch(`${testApp.baseUrl}/api/ratings/relationship/${id}/segmentation`, {
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
      { id: orgs.oem, name: `SEG5-OEM ${run}` },
      { id: orgs.supplier, name: `SEG5-Lieferant ${run}` },
    ]);
    await db.insert(schema.organization).values({ id: emptySupplier, name: `SEG5-Leer ${run}` });
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    await db
      .insert(schema.appUser)
      .values([
        person(users.admin, 'admin', orgs.oem),
        person(users.raterA, 'member', orgs.oem),
        person(users.raterA2, 'member', orgs.oem),
        person(users.raterB, 'member', orgs.oem),
        person(users.supplier, 'admin', orgs.supplier),
      ]);
    await insertRelationships(db, [
      { id: relationship, buyer: orgs.oem, supplier: orgs.supplier },
      { id: emptyRelationship, buyer: orgs.oem, supplier: emptySupplier },
    ]);
    await db.insert(schema.businessUnit).values([
      { id: units.a, orgId: orgs.oem, name: 'Antrieb', code: `A-${run}` },
      { id: units.b, orgId: orgs.oem, name: 'Karosserie', code: `B-${run}` },
    ]);
    const [created] = await db
      .insert(schema.segmentModel)
      .values({
        orgId: orgs.oem,
        version: 1,
        status: 'active',
        gridSize: 3 as const,
        lowMax: 33,
        midMax: 66,
        activatedAt: new Date(),
      })
      .returning({ id: schema.segmentModel.id });
    if (!created) throw new Error('Modell fehlt');
    await db
      .insert(schema.segmentCriterion)
      .values(defaultSegmentCriteria.map((criterion) => ({ ...criterion, modelId: created.id })));
    await db
      .insert(schema.segmentType)
      .values(defaultSegmentTypes.map((type) => ({ ...type, modelId: created.id })));
    await db.insert(schema.segmentationRound).values({
      id: roundId,
      orgId: orgs.oem,
      name: 'Runde',
      dueDate: '2099-12-31',
      status: 'open',
      modelVersion: 1,
      createdBy: users.admin,
    });
    const fill = async (
      unit: string,
      fn: 'quality' | 'purchasing',
      rater: string,
      ist: number,
      soll: number,
    ) => {
      const [assignment] = await db
        .insert(schema.ratingAssignment)
        .values({
          roundId,
          relationshipId: relationship,
          businessUnitId: unit,
          function: fn,
          raterUserId: rater,
          status: 'submitted',
        })
        .returning({ id: schema.ratingAssignment.id });
      if (!assignment) throw new Error('Zuordnung fehlt');
      await db.insert(schema.rating).values(
        criteria.map((criterionKey) => ({
          assignmentId: assignment.id,
          relationshipId: relationship,
          criterionKey,
          modelVersion: 1,
          ist,
          soll,
          comment: criterionKey === criteria[0] ? `K ${ist}` : null,
          submittedAt: new Date(),
        })),
      );
    };
    await fill(units.a, 'quality', users.raterA, 80, 90);
    await fill(units.a, 'purchasing', users.raterA2, 60, 70);
    await fill(units.b, 'quality', users.raterB, 10, 20);
  });

  afterAll(async () => {
    await deleteRelationships(db, [...Object.values(orgs), emptySupplier]);
    await db.delete(schema.businessUnit).where(sql`${schema.businessUnit.orgId} = ${orgs.oem}`);
    await db.delete(schema.segmentModel).where(sql`${schema.segmentModel.orgId} = ${orgs.oem}`);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${[...Object.values(orgs), emptySupplier]}`);
    await testApp.close();
  });

  const scores = (value: number) => Object.fromEntries(criteria.map((key) => [key, value]));

  it('Gruppen, Gesamtwert und Heatmap stimmen mit den Bewertungen überein; größte Abweichung oben', async () => {
    const response = await get(users.admin);
    expect(response.status).toBe(200);
    const { segmentation } = segmentationSchema.parse(response.body);
    if (!segmentation) throw new Error('Keine Einordnung');
    expect(segmentation.status).toBe('provisional');
    expect(segmentation.overall.count).toBe(3);
    expect(segmentation.overall.ist?.typeName).toBe(calculateSegment(model, scores(50)).type.name);
    const groupA = segmentation.groups.find((group) => group.businessUnit.id === units.a);
    expect(groupA?.count).toBe(2);
    expect(groupA?.ist?.typeName).toBe(calculateSegment(model, scores(70)).type.name);
    expect(groupA?.soll?.typeName).toBe(calculateSegment(model, scores(80)).type.name);
    expect(segmentation.rows).toHaveLength(3);
    const deviations = segmentation.rows.map((row) => row.deviation);
    expect(deviations).toEqual([...deviations].sort((a, b) => b - a));
    expect(segmentation.rows[0]?.businessUnit.id).toBe(units.b);
    expect(segmentation.rows[0]?.values[0]?.comment).toBe('K 10');
    expect(segmentation.stats).toHaveLength(criteria.length);
    expect(segmentation.stats[0]).toMatchObject({ min: 10, max: 80 });
  });

  it('ein Nutzer der BU A sieht vor der Konsolidierung nur Zeilen der BU A', async () => {
    const { segmentation } = segmentationSchema.parse((await get(users.raterA)).body);
    expect(segmentation?.rows.every((row) => row.businessUnit.id === units.a)).toBe(true);
    expect(segmentation?.overall.count).toBe(2);
  });

  it('nach der Konsolidierung gilt „konsolidiert“ und alle Zeilen sind sichtbar', async () => {
    await db.insert(schema.segmentDecision).values({
      relationshipId: relationship,
      scope: 'total',
      istImpactLevel: 2,
      istQualityLevel: 2,
      sollImpactLevel: 3,
      sollQualityLevel: 3,
      reason: 'Test',
      modelVersion: 1,
      decidedBy: users.admin,
      version: 1,
    });
    const { segmentation } = segmentationSchema.parse((await get(users.raterA)).body);
    expect(segmentation?.status).toBe('consolidated');
    expect(segmentation?.rows).toHaveLength(3);
  });

  it('ohne abgegebene Bewertung ist die Einordnung leer; der Lieferant bekommt 403', async () => {
    const empty = await get(users.admin, emptyRelationship);
    expect(empty.status).toBe(200);
    expect(segmentationSchema.parse(empty.body).segmentation).toBeNull();
    expect((await get(users.supplier)).status).toBe(403);
  });
});
