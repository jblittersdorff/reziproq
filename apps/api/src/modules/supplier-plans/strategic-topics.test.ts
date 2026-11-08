import { randomUUID } from 'node:crypto';
import { eq, schema, sql, type Database } from '@reziproq/db';
import {
  recommendedTopicLimit,
  supplierPlanResponseSchema,
  type OrgRole,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

describe('SPL-06: Strategische Themen', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const organizationId = randomUUID();
  const supplierOrgId = randomUUID();
  const relationshipId = randomUUID();
  const cycleId = randomUUID();
  const unitId = randomUUID();
  const otherUnitId = randomUUID();
  const groupId = randomUUID();
  const users = {
    admin: `spl06-admin-${run}`,
    sro: `spl06-sro-${run}`,
    anna: `spl06-anna-${run}`,
    ben: `spl06-ben-${run}`,
    viewer: `spl06-viewer-${run}`,
    supplier: `spl06-supplier-${run}`,
  };
  let planId: string;
  const objectiveIds: string[] = [];

  const call = async (user: string, method: string, path: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };

  const planPath = () => `/suppliers/${relationshipId}/plan`;

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: organizationId, name: `SPL-06 Käufer ${run}` },
      { id: supplierOrgId, name: `SPL-06 Lieferant ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values({ organizationId, feature: 'buyer' });
    const person = (
      id: string,
      orgRole: OrgRole,
      extra: { defaultFunction?: 'programs' | 'purchasing'; locale?: 'de' | 'en' } = {},
      organization = organizationId,
    ) => ({
      id,
      name: id,
      givenName: 'Pat',
      email: `${id}@example.com`,
      organizationId: organization,
      orgRole,
      rolesImportedAt: new Date(),
      ...extra,
    });
    await db.insert(schema.appUser).values([
      person(users.admin, 'admin'),
      person(users.sro, 'member'),
      person(users.anna, 'member', { defaultFunction: 'programs', locale: 'de' }),
      person(users.ben, 'member', { defaultFunction: 'purchasing', locale: 'en' }),
      person(users.viewer, 'member'),
      person(users.supplier, 'member', {}, supplierOrgId),
    ]);
    await insertRelationships(db, [
      { id: relationshipId, buyer: organizationId, supplier: supplierOrgId },
    ]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId, orgId: organizationId, userId: users.sro, teamRole: 'sro' },
      { relationshipId, orgId: organizationId, userId: users.anna, teamRole: 'member' },
      { relationshipId, orgId: organizationId, userId: users.ben, teamRole: 'member' },
      { relationshipId, orgId: organizationId, userId: users.viewer, teamRole: 'viewer' },
    ]);
    await db.insert(schema.cycle).values({ id: cycleId, relationshipId, label: '2099', status: 'active' });
    await db.insert(schema.businessUnit).values([
      { id: unitId, orgId: organizationId, name: 'Werk Nord', code: `N-${run}` },
      { id: otherUnitId, orgId: organizationId, name: 'Werk Süd', code: `S-${run}` },
    ]);
    await db.insert(schema.materialGroup).values({
      id: groupId,
      orgId: organizationId,
      name: 'Stahl',
      code: `ST-${run}`,
    });
    await db.insert(schema.relationshipBusinessUnit).values([
      { relationshipId, businessUnitId: unitId },
      { relationshipId, businessUnitId: otherUnitId },
    ]);
    await db.insert(schema.relationshipMaterialGroup).values({
      relationshipId,
      materialGroupId: groupId,
      isPrimary: true,
    });
    const created = await call(users.sro, 'POST', planPath());
    planId = (created.body as { id: string }).id;
    await call(users.sro, 'GET', planPath());
    for (const text of ['Kosten senken', 'Qualität sichern', 'Liefertreue']) {
      const objective = await call(users.sro, 'POST', `${planPath()}/${planId}/objectives`, {
        categoryKey: 'cost',
        businessUnitId: unitId,
        materialGroupId: null,
        text,
        ownerUserId: users.anna,
        targetYear: 2099,
      });
      if (objective.status !== 201) throw new Error(JSON.stringify(objective));
      objectiveIds.push((objective.body as { id: string }).id);
    }
  });

  afterAll(async () => {
    await db
      .delete(schema.outboxEvent)
      .where(eq(schema.outboxEvent.orgId, organizationId));
    await db.delete(schema.supplierPlan).where(eq(schema.supplierPlan.id, planId));
    await db
      .delete(schema.objectiveCategory)
      .where(eq(schema.objectiveCategory.orgId, organizationId));
    await deleteRelationships(db, [organizationId, supplierOrgId]);
    await db
      .delete(schema.materialGroup)
      .where(eq(schema.materialGroup.orgId, organizationId));
    await db
      .delete(schema.businessUnit)
      .where(eq(schema.businessUnit.orgId, organizationId));
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${[organizationId, supplierOrgId]}`);
    await testApp.close();
  });

  const topicsPath = () => `${planPath()}/${planId}/topics`;
  const readTopics = async (user = users.sro) =>
    supplierPlanResponseSchema.parse((await call(user, 'GET', planPath())).body).plan?.topics ?? [];
  const topic = (title: string, ids: string[]) => ({ title, reason: `Weil ${title}`, objectiveIds: ids });

  it('verlangt Titel, Begründung und mindestens ein Ziel', async () => {
    const [first] = objectiveIds;
    expect((await call(users.sro, 'POST', topicsPath(), topic('Ohne Ziel', []))).status).toBe(400);
    expect(
      (await call(users.sro, 'POST', topicsPath(), { title: 'x', reason: ' ', objectiveIds: [first] })).status,
    ).toBe(400);
    expect(
      (await call(users.sro, 'POST', topicsPath(), topic('Fremdes Ziel', [randomUUID()]))).status,
    ).toBe(409);
    const created = await call(users.sro, 'POST', topicsPath(), topic('Kosten', [objectiveIds[0] ?? '', objectiveIds[1] ?? '']));
    expect(created.status).toBe(201);
    const [saved] = await readTopics();
    expect(saved).toMatchObject({ title: 'Kosten', reason: 'Weil Kosten', priority: 1 });
    expect(saved?.objectives.map((objective) => objective.text).sort()).toEqual([
      'Kosten senken',
      'Qualität sichern',
    ]);
    const changed = await call(users.admin, 'PUT', `${topicsPath()}/${saved?.id}`, topic('Kosten neu', [objectiveIds[2] ?? '']));
    expect(changed.status).toBe(200);
    expect((await readTopics())[0]).toMatchObject({ title: 'Kosten neu' });
    expect((await readTopics())[0]?.objectives).toHaveLength(1);
  });

  it('nur SRO und Admin ändern; alle im Team sehen', async () => {
    for (const user of [users.anna, users.viewer]) {
      expect((await call(user, 'POST', topicsPath(), topic('Nein', [objectiveIds[0] ?? '']))).status).toBe(403);
    }
    expect((await readTopics(users.viewer)).length).toBe(1);
  });

  it('behält die Reihenfolge nach dem Neuladen', async () => {
    const [first] = await readTopics();
    await call(users.sro, 'POST', topicsPath(), topic('Qualität', [objectiveIds[1] ?? '']));
    await call(users.sro, 'POST', topicsPath(), topic('Liefertreue', [objectiveIds[2] ?? '']));
    const initial = await readTopics();
    expect(initial.map((item) => item.title)).toEqual(['Kosten neu', 'Qualität', 'Liefertreue']);
    const order = [initial[2], initial[0], initial[1]].map((item) => item?.id ?? '');
    const response = await call(users.sro, 'PUT', `${planPath()}/${planId}/topic-order`, { topicIds: order });
    expect(response.status).toBe(200);
    expect((await readTopics()).map((item) => item.id)).toEqual(order);
    expect((await readTopics()).map((item) => item.priority)).toEqual([1, 2, 3]);
    expect(first?.id).toBe(initial[0]?.id);
    const incomplete = await call(users.sro, 'PUT', `${planPath()}/${planId}/topic-order`, { topicIds: order.slice(1) });
    expect(incomplete.status).toBe(409);
  });

  it('erlaubt mehr als fünf Themen; der Hinweis ab sechs hängt an der Grenze', async () => {
    expect(recommendedTopicLimit).toBe(5);
    for (const title of ['A', 'B', 'C']) {
      expect((await call(users.sro, 'POST', topicsPath(), topic(title, [objectiveIds[0] ?? '']))).status).toBe(201);
    }
    expect((await readTopics()).length).toBe(6);
  });

  it('zeigt dem Lieferanten keine Themen', async () => {
    expect((await call(users.supplier, 'GET', planPath())).status).toBe(403);
    expect((await call(users.supplier, 'POST', topicsPath(), topic('Nein', [objectiveIds[0] ?? '']))).status).toBe(403);
  });
});
