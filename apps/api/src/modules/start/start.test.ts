import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  defaultSegmentCriteria,
  defaultSegmentTypes,
  dueListSchema,
  type StartData,
  startSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

describe('NAV-05 Start über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const oem = randomUUID();
  const supplierOrgs = Array.from({ length: 7 }, () => randomUUID());
  const relationships = supplierOrgs.map(() => randomUUID());
  const assignments = supplierOrgs.map(() => randomUUID());
  const users = {
    rater: `st-rater-${run}`,
    other: `st-other-${run}`,
    supplier: `st-supplier-${run}`,
  };
  const roundId = randomUUID();
  const unitId = randomUUID();

  const call = async (user: string, method: string, path: string) => {
    const response = await fetch(`${testApp.baseUrl}/api${path}`, {
      method,
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: user })}` },
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };

  const person = (id: string, organizationId: string) => ({
    id,
    name: `Person ${id}`,
    givenName: 'Pat',
    email: `${id}@example.com`,
    organizationId,
    orgRole: 'member' as const,
    rolesImportedAt: new Date(),
  });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db
      .insert(schema.organization)
      .values([
        { id: oem, name: `ST-OEM ${run}` },
        ...supplierOrgs.map((id, index) => ({ id, name: `ST-Lieferant ${run} ${index + 1}` })),
      ]);
    await db.insert(schema.organizationFeature).values({ organizationId: oem, feature: 'buyer' });
    await db
      .insert(schema.appUser)
      .values([
        person(users.rater, oem),
        person(users.other, oem),
        person(users.supplier, supplierOrgs[0] as string),
      ]);
    await insertRelationships(
      db,
      supplierOrgs.map((supplier, index) => ({
        id: relationships[index] as string,
        buyer: oem,
        supplier,
      })),
    );
    await db.insert(schema.relationshipMember).values(
      relationships.map((relationshipId) => ({
        relationshipId,
        orgId: oem,
        userId: users.rater,
        teamRole: 'sro' as const,
      })),
    );
    await db
      .insert(schema.businessUnit)
      .values({ id: unitId, orgId: oem, name: 'Antrieb', code: `A-${run}` });
    const [model] = await db
      .insert(schema.segmentModel)
      .values({
        orgId: oem,
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
      orgId: oem,
      name: 'Runde',
      dueDate: '2099-12-31',
      status: 'open',
      modelVersion: 1,
      createdBy: users.rater,
    });
    await db.insert(schema.ratingAssignment).values(
      relationships.map((relationshipId, index) => ({
        id: assignments[index] as string,
        roundId,
        relationshipId,
        businessUnitId: unitId,
        function: 'quality' as const,
        raterUserId: users.rater,
      })),
    );
  });

  afterAll(async () => {
    await deleteRelationships(db, [oem, ...supplierOrgs]);
    await db.delete(schema.businessUnit).where(sql`${schema.businessUnit.orgId} = ${oem}`);
    await db.delete(schema.segmentModel).where(sql`${schema.segmentModel.orgId} = ${oem}`);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${[oem, ...supplierOrgs]}`);
    await testApp.close();
  });

  const overview = async (user: string): Promise<StartData> => {
    const response = await call(user, 'GET', '/start');
    expect(response.status).toBe(200);
    return startSchema.parse(response.body);
  };

  it('zeigt höchstens fünf Einträge je Kachel; die volle Liste hat alle', async () => {
    const data = await overview(users.rater);
    expect(data.due.items).toHaveLength(5);
    expect(data.due.total).toBe(7);
    expect(data.relationships.items).toHaveLength(5);
    expect(data.relationships.total).toBe(7);
    const all = dueListSchema.parse((await call(users.rater, 'GET', '/start/due')).body);
    expect(all.items).toHaveLength(7);
    expect(data.due.items[0]?.href).toMatch(/^\/bewertungen\//);
  });

  it('„Meine Beziehungen“ nennt den Soll-Typ aus der Konsolidierung, sonst nichts', async () => {
    const before = await overview(users.rater);
    expect(before.relationships.items.every((item) => item.target === null)).toBe(true);
    const target = defaultSegmentTypes.find(
      (type) => type.impactLevel === 3 && type.qualityLevel === 3,
    );
    const first = before.relationships.items[0]?.id as string;
    await db.insert(schema.segmentDecision).values({
      relationshipId: first,
      scope: 'total',
      istImpactLevel: 2,
      istQualityLevel: 2,
      sollImpactLevel: 3,
      sollQualityLevel: 3,
      reason: 'Test',
      modelVersion: 1,
      decidedBy: users.rater,
      version: 1,
    });
    const after = await overview(users.rater);
    expect(after.relationships.items.find((item) => item.id === first)?.target).toBe(target?.name);
    expect(after.relationships.items.filter((item) => item.target !== null)).toHaveLength(1);
    await db
      .delete(schema.segmentDecision)
      .where(sql`${schema.segmentDecision.relationshipId} = ${first}`);
  });

  it('eine abgegebene Bewertung verschwindet aus „Fällig bei mir“', async () => {
    await db
      .update(schema.ratingAssignment)
      .set({ status: 'submitted' })
      .where(sql`${schema.ratingAssignment.id} = ${assignments[0]}`);
    const all = dueListSchema.parse((await call(users.rater, 'GET', '/start/due')).body);
    expect(all.items.map((item) => item.id)).not.toContain(assignments[0]);
    expect(all.items).toHaveLength(6);
  });

  it('jeder sieht nur seine eigenen Aufgaben und Beziehungen', async () => {
    const data = await overview(users.other);
    expect(data.due.total).toBe(0);
    expect(data.relationships.total).toBe(0);
  });

  it('der Lieferant bekommt keine Käuferdaten, sieht aber seinen Kunden (LIF-02)', async () => {
    const data = await overview(users.supplier);
    expect(data.due.total).toBe(0);
    // Nur der Name des Kunden, kein Soll-Typ und keine Aufgaben des Käufers.
    expect(data.relationships.items).toEqual([
      { id: relationships[0], name: expect.stringMatching(/^ST-OEM/), target: null },
    ]);
  });

  it('Start speichert nichts: Es gibt keine Tabelle dafür', async () => {
    const result = await db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public' and table_name like 'start%'`,
    );
    expect(result.rows ?? result).toHaveLength(0);
  });
});
