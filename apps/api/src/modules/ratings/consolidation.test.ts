import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  decisionHistorySchema,
  defaultSegmentCriteria,
  defaultSegmentTypes,
  segmentationSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

describe('SEG-06 Konsolidierung über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID(), zweit: randomUUID() };
  const relationship = randomUUID();
  const emptyRelationship = randomUUID();
  const emptySupplier = randomUUID();
  const users = {
    admin: `seg-admin-${run}`,
    raterA: `seg-a-${run}`,
    raterA2: `seg-a2-${run}`,
    raterB: `seg-b-${run}`,
    sro: `seg-sro-${run}`,
    zweit: `seg-zweit-${run}`,
    supplier: `seg-sup-${run}`,
  };
  const roundId = randomUUID();
  const units = { a: randomUUID(), b: randomUUID() };
  const criteria = defaultSegmentCriteria.map((criterion) => criterion.key);

  const call = async (user: string, method: string, path: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };
  const decisionsPath = `/ratings/relationship/${relationship}/decisions`;

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
      { id: orgs.zweit, name: `SEG5-Zweit ${run}` },
    ]);
    await db.insert(schema.organization).values({ id: emptySupplier, name: `SEG5-Leer ${run}` });
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' },
      { organizationId: orgs.zweit, feature: 'buyer' },
    ]);
    await db
      .insert(schema.appUser)
      .values([
        person(users.admin, 'admin', orgs.oem),
        person(users.raterA, 'member', orgs.oem),
        person(users.raterA2, 'member', orgs.oem),
        person(users.raterB, 'member', orgs.oem),
        person(users.sro, 'member', orgs.oem),
        person(users.zweit, 'admin', orgs.zweit),
        person(users.supplier, 'admin', orgs.supplier),
      ]);
    await insertRelationships(db, [
      { id: relationship, buyer: orgs.oem, supplier: orgs.supplier },
      { id: emptyRelationship, buyer: orgs.oem, supplier: emptySupplier },
    ]);
    await db.insert(schema.relationshipMember).values({
      relationshipId: relationship,
      orgId: orgs.oem,
      userId: users.sro,
      teamRole: 'sro',
    });
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

  const level = (impactLevel: number, qualityLevel: number) => ({ impactLevel, qualityLevel });
  const body = (reason = 'Weil', soll = level(3, 3)) => ({
    total: { ist: level(2, 2), soll, reason },
    entries: [units.a, units.b].map((businessUnitId) => ({
      businessUnitId,
      materialGroupId: null,
      ist: level(2, 2),
      soll,
      reason,
    })),
  });

  it('ohne Begründung lässt sich nicht festlegen', async () => {
    expect((await call(users.sro, 'POST', decisionsPath, body(''))).status).toBe(400);
    const missing = body();
    missing.entries[0] = { ...missing.entries[0], reason: '  ' } as never;
    expect((await call(users.sro, 'POST', decisionsPath, missing)).status).toBe(400);
    const history = decisionHistorySchema.parse((await call(users.sro, 'GET', decisionsPath)).body);
    expect(history.versions).toEqual([]);
    expect(history.canConsolidate).toBe(true);
  });

  it('nur SRO und Admin konsolidieren, alle anderen bekommen 403', async () => {
    for (const user of [users.raterA, users.raterB]) {
      expect((await call(user, 'POST', decisionsPath, body())).status).toBe(403);
      const history = decisionHistorySchema.parse((await call(user, 'GET', decisionsPath)).body);
      expect(history.canConsolidate).toBe(false);
    }
    expect((await call(users.supplier, 'POST', decisionsPath, body())).status).toBe(403);
  });

  it('die Entscheidung muss jede Gruppe der Bewertungen genau einmal enthalten', async () => {
    const partial = body();
    partial.entries.pop();
    expect((await call(users.sro, 'POST', decisionsPath, partial)).status).toBe(400);
  });

  it('eine neue Konsolidierung erzeugt eine neue Version, die alte bleibt lesbar', async () => {
    const first = await call(users.sro, 'POST', decisionsPath, body('Erste Sicht', level(3, 3)));
    expect(first.status).toBe(200);
    const second = await call(
      users.admin,
      'POST',
      decisionsPath,
      body('Zweite Sicht', level(1, 3)),
    );
    expect(second.status).toBe(200);
    const history = decisionHistorySchema.parse(second.body);
    expect(history.versions.map((entry) => entry.version)).toEqual([2, 1]);
    const [newer, older] = history.versions;
    expect(older?.entries.find((entry) => entry.scope === 'total')?.reason).toBe('Erste Sicht');
    expect(older?.entries.find((entry) => entry.scope === 'total')?.soll.typeName).toBe(
      defaultSegmentTypes.find((type) => type.impactLevel === 3 && type.qualityLevel === 3)?.name,
    );
    expect(newer?.decidedBy.userId).toBe(users.admin);
    expect(newer?.entries).toHaveLength(3);
    const stored = await db
      .select()
      .from(schema.segmentDecision)
      .where(sql`${schema.segmentDecision.relationshipId} = ${relationship}`);
    expect(stored.filter((row) => row.version === 1)).toHaveLength(3);
    expect(
      stored.filter((row) => row.version === 1).every((row) => row.sollImpactLevel === 3),
    ).toBe(true);
  });

  it('nach dem Festlegen zeigt der Kopf Ist → Soll gesamt', async () => {
    const response = await call(users.raterA, 'GET', `/suppliers/${relationship}/overview`);
    expect(response.status).toBe(200);
    const head = (
      response.body as { head: { segment: { current: string; target: string } | null } }
    ).head;
    const name = (impact: number, quality: number) =>
      defaultSegmentTypes.find(
        (type) => type.impactLevel === impact && type.qualityLevel === quality,
      )?.name;
    expect(head.segment).toEqual({ current: name(2, 2), target: name(1, 3) });
  });

  it('nach dem Festlegen sehen alle Käufer-Nutzer alle Bewertungen', async () => {
    const { segmentation } = segmentationSchema.parse(
      (await call(users.raterA, 'GET', `/ratings/relationship/${relationship}/segmentation`)).body,
    );
    expect(segmentation?.status).toBe('consolidated');
    expect(segmentation?.rows).toHaveLength(3);
    expect(segmentation?.decision?.version).toBe(2);
  });

  it('der Zweit-OEM und der Test-Lieferant sehen nichts davon', async () => {
    expect((await call(users.zweit, 'GET', decisionsPath)).status).toBe(404);
    expect((await call(users.zweit, 'POST', decisionsPath, body())).status).toBe(404);
    expect((await call(users.supplier, 'GET', decisionsPath)).status).toBe(403);
  });
});
