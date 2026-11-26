import { randomUUID } from 'node:crypto';
import { type Database, eq, schema, sql } from '@reziproq/db';
import {
  calculateSegment,
  defaultSegmentCriteria,
  defaultSegmentTypes,
  type OrgRole,
  type RatingAssignmentList,
  type RatingDetail,
  ratingAssignmentListSchema,
  ratingDetailSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

describe('SEG-04 Bewertung abgeben über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), zweit: randomUUID(), supplier: randomUUID() };
  const relationship = randomUUID();
  const users = {
    admin: `rat-admin-${run}`,
    sro: `rat-sro-${run}`,
    raterA: `rat-a-${run}`,
    raterB: `rat-b-${run}`,
    outsider: `rat-out-${run}`,
    zweit: `rat-zweit-${run}`,
    supplier: `rat-supplier-${run}`,
  };
  const roundId = randomUUID();
  const assignmentA = randomUUID();
  const assignmentB = randomUUID();
  const criteria = defaultSegmentCriteria.map((criterion) => criterion.key);
  const unitIds = { a: randomUUID(), b: randomUUID() };

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

  const list = async (user: string, path = `/ratings/relationship/${relationship}`) => {
    const response = await call(user, 'GET', path);
    expect(response.status).toBe(200);
    return ratingAssignmentListSchema.parse(response.body) as RatingAssignmentList;
  };

  const detail = async (user: string, id: string): Promise<RatingDetail> => {
    const response = await call(user, 'GET', `/ratings/${id}`);
    expect(response.status).toBe(200);
    return ratingDetailSchema.parse(response.body);
  };

  const fillAll = async (user: string, id: string, ist: number, soll: number) => {
    for (const criterionKey of criteria) {
      const response = await call(user, 'PUT', `/ratings/${id}`, { criterionKey, ist, soll });
      expect(response.status).toBe(200);
    }
  };

  const person = (id: string, role: OrgRole, organizationId: string) => ({
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
      { id: orgs.oem, name: `RAT-OEM ${run}` },
      { id: orgs.zweit, name: `RAT-Zweit ${run}` },
      { id: orgs.supplier, name: `RAT-Lieferant ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' },
      { organizationId: orgs.zweit, feature: 'buyer' },
    ]);
    await db
      .insert(schema.appUser)
      .values([
        person(users.admin, 'admin', orgs.oem),
        person(users.sro, 'member', orgs.oem),
        person(users.raterA, 'member', orgs.oem),
        person(users.raterB, 'member', orgs.oem),
        person(users.outsider, 'member', orgs.oem),
        person(users.zweit, 'admin', orgs.zweit),
        person(users.supplier, 'admin', orgs.supplier),
      ]);
    await insertRelationships(db, [{ id: relationship, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db.insert(schema.relationshipMember).values({
      relationshipId: relationship,
      orgId: orgs.oem,
      userId: users.sro,
      teamRole: 'sro',
    });
    await db.insert(schema.businessUnit).values([
      { id: unitIds.a, orgId: orgs.oem, name: 'Antrieb', code: `A-${run}` },
      { id: unitIds.b, orgId: orgs.oem, name: 'Karosserie', code: `B-${run}` },
    ]);
    const [model] = await db
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
    await db.insert(schema.ratingAssignment).values([
      {
        id: assignmentA,
        roundId,
        relationshipId: relationship,
        businessUnitId: unitIds.a,
        function: 'quality',
        raterUserId: users.raterA,
      },
      {
        id: assignmentB,
        roundId,
        relationshipId: relationship,
        businessUnitId: unitIds.b,
        function: 'purchasing',
        raterUserId: users.raterB,
      },
    ]);
  });

  afterAll(async () => {
    await deleteRelationships(db, Object.values(orgs));
    await db.delete(schema.businessUnit).where(sql`${schema.businessUnit.orgId} in ${[orgs.oem]}`);
    await db
      .delete(schema.segmentModel)
      .where(sql`${schema.segmentModel.orgId} in ${Object.values(orgs)}`);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('ein Nutzer der BU A sieht vor der Konsolidierung keine Bewertung der BU B; SRO und Admin sehen beide', async () => {
    const own = await list(users.raterA);
    expect(own.assignments.map((entry) => entry.id)).toEqual([assignmentA]);
    expect((await call(users.raterA, 'GET', `/ratings/${assignmentB}`)).status).toBe(404);

    for (const user of [users.sro, users.admin]) {
      const all = await list(user);
      expect(all.assignments.map((entry) => entry.id).sort()).toEqual(
        [assignmentA, assignmentB].sort(),
      );
      expect(all.assignments.every((entry) => entry.raterName !== null)).toBe(true);
    }
    // Den Namen der bewertenden Person sehen nur SRO und Admin.
    expect((await detail(users.raterA, assignmentA)).assignment.raterName).toBeNull();
    expect((await list(users.outsider)).assignments).toEqual([]);
    expect((await call(users.outsider, 'GET', `/ratings/${assignmentA}`)).status).toBe(404);
  });

  it('nach der Konsolidierung sehen alle Käufer-Nutzer mit Zugriff alle Bewertungen', async () => {
    await db.insert(schema.segmentDecision).values({
      relationshipId: relationship,
      scope: 'total',
      istImpactLevel: 1,
      istQualityLevel: 1,
      sollImpactLevel: 2,
      sollQualityLevel: 2,
      reason: 'Test',
      modelVersion: 1,
      decidedBy: users.admin,
      version: 1,
    });
    const all = await list(users.outsider);
    expect(all.assignments).toHaveLength(2);
    expect(all.assignments.every((entry) => entry.raterName === null)).toBe(true);
    expect((await detail(users.raterA, assignmentB)).editable).toBe(false);
    await db
      .delete(schema.segmentDecision)
      .where(eq(schema.segmentDecision.relationshipId, relationship));
  });

  it('der Entwurf überlebt Abmelden und Neuladen', async () => {
    const saved = await call(users.raterA, 'PUT', `/ratings/${assignmentA}`, {
      criterionKey: criteria[0],
      ist: 40,
      comment: 'Eher schwach',
    });
    expect(saved.status).toBe(200);
    // Ein neuer Token und eine neue Anfrage lesen denselben Stand.
    const again = await detail(users.raterA, assignmentA);
    const value = again.values.find((entry) => entry.criterionKey === criteria[0]);
    expect(value).toEqual({
      criterionKey: criteria[0],
      ist: 40,
      soll: null,
      comment: 'Eher schwach',
    });
    expect(again.assignment.status).toBe('in_progress');
  });

  it('ohne Werte für alle Kriterien lässt sich nicht abgeben; die Antwort nennt die fehlenden', async () => {
    const response = await call(users.raterA, 'POST', `/ratings/${assignmentA}/submit`);
    expect(response.status).toBe(400);
    const body = response.body as { code: string; missing: string[] };
    expect(body.code).toBe('ratings_incomplete');
    expect(body.missing).toEqual(criteria);
    expect((await detail(users.raterA, assignmentA)).assignment.status).toBe('in_progress');
  });

  it('Achsenwerte und Typ in der Zusammenfassung stimmen mit der Rechnung aus SEG-01 überein', async () => {
    await fillAll(users.raterA, assignmentA, 80, 20);
    const result = await detail(users.raterA, assignmentA);
    const model = {
      gridSize: 3 as const,
      lowMax: 33,
      midMax: 66,
      criteria: defaultSegmentCriteria,
      types: defaultSegmentTypes,
    };
    const scores = (value: number) => Object.fromEntries(criteria.map((key) => [key, value]));
    const ist = calculateSegment(model, scores(80));
    const soll = calculateSegment(model, scores(20));
    expect(result.ist).toEqual({
      impactScore: ist.impactScore,
      qualityScore: ist.qualityScore,
      impactLevel: ist.impactLevel,
      qualityLevel: ist.qualityLevel,
      typeName: ist.type.name,
    });
    expect(result.soll?.typeName).toBe(soll.type.name);
    expect(result.ist?.typeName).not.toBe(result.soll?.typeName);

    const submitted = await call(users.raterA, 'POST', `/ratings/${assignmentA}/submit`);
    expect(submitted.status).toBe(200);
    expect(ratingDetailSchema.parse(submitted.body).assignment.status).toBe('submitted');
    // Nach der Abgabe bis Rundenende änderbar.
    const changed = await call(users.raterA, 'PUT', `/ratings/${assignmentA}`, {
      criterionKey: criteria[0],
      ist: 10,
    });
    expect(changed.status).toBe(200);
    expect(ratingDetailSchema.parse(changed.body).assignment.status).toBe('submitted');
  });

  it('prüft Eingaben und Zuständigkeit', async () => {
    const put = (user: string, body: unknown, id = assignmentA) =>
      call(user, 'PUT', `/ratings/${id}`, body);
    expect((await put(users.raterA, { criterionKey: criteria[0], ist: 101 })).status).toBe(400);
    expect((await put(users.raterA, { criterionKey: 'gibt_es_nicht', ist: 5 })).status).toBe(400);
    // Auch der SRO ändert keine fremde Bewertung; er sieht sie nur.
    expect((await put(users.sro, { criterionKey: criteria[0], ist: 5 })).status).toBe(403);
    expect((await put(users.admin, { criterionKey: criteria[0], ist: 5 })).status).toBe(403);
  });

  it('nach dem Schließen der Runde ist nichts mehr änderbar', async () => {
    await db
      .update(schema.segmentationRound)
      .set({ status: 'closed', closedAt: new Date() })
      .where(eq(schema.segmentationRound.id, roundId));
    const put = await call(users.raterA, 'PUT', `/ratings/${assignmentA}`, {
      criterionKey: criteria[0],
      ist: 1,
    });
    expect(put.status).toBe(409);
    expect((await call(users.raterA, 'POST', `/ratings/${assignmentA}/submit`)).status).toBe(409);
    expect((await detail(users.raterA, assignmentA)).editable).toBe(false);
    // Auch die Datenbank hält die Regel, nicht nur die API.
    await expect(
      db.update(schema.rating).set({ ist: 2 }).where(eq(schema.rating.assignmentId, assignmentA)),
    ).rejects.toThrow();
  });

  it('der Test-Lieferant und der Zweit-OEM sehen keine Bewertung', async () => {
    for (const user of [users.supplier]) {
      expect((await call(user, 'GET', '/ratings/mine')).status).toBe(403);
      expect((await call(user, 'GET', `/ratings/${assignmentA}`)).status).toBe(403);
    }
    expect((await call(users.zweit, 'GET', `/ratings/${assignmentA}`)).status).toBe(404);
    expect((await list(users.zweit, `/ratings/relationship/${relationship}`)).assignments).toEqual(
      [],
    );
  });
});
