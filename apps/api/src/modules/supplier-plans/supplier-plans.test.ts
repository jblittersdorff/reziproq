import { randomUUID } from 'node:crypto';
import { eq, schema, type Database, sql } from '@reziproq/db';
import {
  objectiveCategoriesResponseSchema,
  supplierPlanResponseSchema,
  type OrgRole,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

describe('SPL-01: interner Lieferantenplan', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const organizationId = randomUUID();
  const supplierOrgId = randomUUID();
  const relationshipId = randomUUID();
  const cycleId = randomUUID();
  const segmentModelId = randomUUID();
  const businessUnitId = randomUUID();
  const users = {
    admin: `spl01-admin-${run}`,
    sro: `spl01-sro-${run}`,
    member: `spl01-member-${run}`,
    viewer: `spl01-viewer-${run}`,
    supplier: `spl01-supplier-${run}`,
  };
  let planId: string;
  let objectiveId: string;

  const call = async (user: string, method: string, path: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: response.status,
      body: (await response.json().catch(() => null)) as unknown,
    };
  };

  const planPath = `/suppliers/${relationshipId}/plan`;

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: organizationId, name: `SPL-01 Käufer ${run}` },
      { id: supplierOrgId, name: `SPL-01 Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId, feature: 'buyer' });
    const person = (id: string, orgRole: OrgRole, organization = organizationId) => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId: organization,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db.insert(schema.appUser).values([
      person(users.admin, 'admin'),
      person(users.sro, 'member'),
      person(users.member, 'member'),
      person(users.viewer, 'member'),
      person(users.supplier, 'member', supplierOrgId),
    ]);
    await insertRelationships(db, [
      { id: relationshipId, buyer: organizationId, supplier: supplierOrgId },
    ]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId, orgId: organizationId, userId: users.sro, teamRole: 'sro' },
      { relationshipId, orgId: organizationId, userId: users.member, teamRole: 'member' },
      { relationshipId, orgId: organizationId, userId: users.viewer, teamRole: 'viewer' },
    ]);
    await db.insert(schema.cycle).values({
      id: cycleId,
      relationshipId,
      label: '2026',
      status: 'active',
    });
    await db.insert(schema.businessUnit).values({
      id: businessUnitId,
      orgId: organizationId,
      name: 'Einkauf',
      code: `E-${run}`,
    });
    await db.insert(schema.relationshipBusinessUnit).values({
      relationshipId,
      businessUnitId,
    });
    await db.insert(schema.segmentModel).values({
      id: segmentModelId,
      orgId: organizationId,
      version: 1,
      status: 'active',
      lowMax: 33,
      midMax: 66,
      activatedAt: new Date(),
    });
    await db.insert(schema.segmentType).values({
      modelId: segmentModelId,
      impactLevel: 1,
      qualityLevel: 1,
      name: 'Typ A',
      description: 'Test',
    });
    await db.insert(schema.segmentDecision).values({
      relationshipId,
      scope: 'total',
      istImpactLevel: 1,
      istQualityLevel: 1,
      sollImpactLevel: 1,
      sollQualityLevel: 1,
      reason: 'Test',
      modelVersion: 1,
      decidedBy: users.sro,
      version: 1,
    });
  });

  afterAll(async () => {
    if (planId) {
      await db
        .delete(schema.supplierPlan)
        .where(eq(schema.supplierPlan.id, planId));
    }
    await db.delete(schema.objectiveCategory).where(eq(schema.objectiveCategory.orgId, organizationId));
    await db.delete(schema.segmentDecision).where(eq(schema.segmentDecision.relationshipId, relationshipId));
    await db.delete(schema.segmentType).where(eq(schema.segmentType.modelId, segmentModelId));
    await db.delete(schema.segmentModel).where(eq(schema.segmentModel.id, segmentModelId));
    await deleteRelationships(db, [organizationId, supplierOrgId]);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${[organizationId, supplierOrgId]}`);
    await testApp.close();
  });

  it('initialisiert alle Standardkategorien und erzeugt höchstens einen Entwurf je Zyklus', async () => {
    const categoryResponse = await call(users.sro, 'GET', '/objective-categories');
    expect(categoryResponse.status).toBe(200);
    const { categories } = objectiveCategoriesResponseSchema.parse(categoryResponse.body);
    expect(categories.map((category) => category.key)).toEqual([
      'cost',
      'quality',
      'technology',
      'supply',
      'sustainability',
      'capacity',
      'location',
    ]);

    const noPlan = supplierPlanResponseSchema.parse((await call(users.sro, 'GET', planPath)).body);
    expect(noPlan).toMatchObject({ plan: null, cycleId, canCreate: true });
    expect((await call(users.member, 'POST', planPath)).status).toBe(403);

    const created = await call(users.sro, 'POST', planPath);
    expect(created.status).toBe(201);
    planId = (created.body as { id: string }).id;
    expect((await call(users.sro, 'POST', planPath)).status).toBe(409);

    const forbiddenSummary = await call(users.member, 'PATCH', `${planPath}/${planId}/summary`, {
      summary: 'Nicht erlaubt',
    });
    expect(forbiddenSummary.status).toBe(403);
    expect(
      (
        await call(users.sro, 'PATCH', `${planPath}/${planId}/summary`, {
          summary: 'Qualität und Versorgung gemeinsam verbessern.',
        })
      ).status,
    ).toBe(200);
  });

  it('speichert Ziele mit Bezug, Verantwortlichem und Jahr; der Soll-Typ bleibt dynamisch', async () => {
    const created = await call(users.sro, 'POST', `${planPath}/${planId}/objectives`, {
      categoryKey: 'quality',
      businessUnitId,
      materialGroupId: null,
      text: 'Ausschussquote senken',
      ownerUserId: users.member,
      targetYear: 2027,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ id: expect.any(String) });
    objectiveId = (created.body as { id: string }).id;

    const first = supplierPlanResponseSchema.parse((await call(users.sro, 'GET', planPath)).body);
    expect(first.plan).toMatchObject({
      targetType: 'Typ A',
      summary: 'Qualität und Versorgung gemeinsam verbessern.',
      objectives: [
        {
          categoryKey: 'quality',
          businessUnit: { id: businessUnitId, name: 'Einkauf' },
          owner: { userId: users.member },
          targetYear: 2027,
        },
      ],
    });
    expect(first.plan?.objectives[0]?.canEdit).toBe(true);

    await db
      .update(schema.segmentType)
      .set({ name: 'Typ B' })
      .where(eq(schema.segmentType.modelId, segmentModelId));
    const changed = supplierPlanResponseSchema.parse((await call(users.sro, 'GET', planPath)).body);
    expect(changed.plan?.targetType).toBe('Typ B');

    expect(
      (
        await call(users.member, 'PATCH', `${planPath}/${planId}/objectives/${objectiveId}`, {
          categoryKey: 'quality',
          businessUnitId,
          materialGroupId: null,
          text: 'Ausschussquote deutlich senken',
          ownerUserId: users.member,
          targetYear: 2028,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call(users.viewer, 'PATCH', `${planPath}/${planId}/objectives/${objectiveId}`, {
          categoryKey: 'quality',
          businessUnitId,
          materialGroupId: null,
          text: 'Änderung durch Leser',
          ownerUserId: users.member,
          targetYear: 2028,
        })
      ).status,
    ).toBe(403);
  });

  it('weist Lieferantenzugriff auf Plan und Zielkategorien ab', async () => {
    expect((await call(users.supplier, 'GET', planPath)).status).toBe(403);
    expect((await call(users.supplier, 'POST', planPath)).status).toBe(403);
    expect(
      (
        await call(users.supplier, 'PATCH', `${planPath}/${planId}/summary`, {
          summary: 'Nicht sichtbar',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(users.supplier, 'POST', `${planPath}/${planId}/objectives`, {
          categoryKey: 'quality',
          businessUnitId,
          materialGroupId: null,
          text: 'Nicht sichtbar',
          ownerUserId: users.member,
          targetYear: 2027,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          users.supplier,
          'PATCH',
          `${planPath}/${planId}/objectives/${objectiveId}`,
          {
            categoryKey: 'quality',
            businessUnitId,
            materialGroupId: null,
            text: 'Nicht sichtbar',
            ownerUserId: users.member,
            targetYear: 2027,
          },
        )
      ).status,
    ).toBe(403);
    expect((await call(users.supplier, 'GET', '/objective-categories')).status).toBe(403);
  });

  it('lässt nur Admins Kategorien ändern und deaktiviert statt sie zu löschen', async () => {
    expect(
      (
        await call(users.sro, 'PATCH', '/objective-categories/quality', {
          name: 'Qualität',
          position: 2,
          active: false,
        })
      ).status,
    ).toBe(403);
    const updated = await call(users.admin, 'PATCH', '/objective-categories/quality', {
      name: 'Qualität',
      position: 2,
      active: false,
    });
    expect(updated.status).toBe(200);
    const categories = objectiveCategoriesResponseSchema.parse(
      (await call(users.admin, 'GET', '/objective-categories')).body,
    );
    expect(categories.categories.find((category) => category.key === 'quality')?.active).toBe(false);
    const plan = supplierPlanResponseSchema.parse((await call(users.sro, 'GET', planPath)).body);
    expect(plan.plan?.objectives[0]?.categoryName).toBe('Qualität');
    expect(plan.categories.find((category) => category.key === 'quality')?.active).toBe(false);
    expect(
      (
        await call(users.member, 'PATCH', `${planPath}/${planId}/objectives/${objectiveId}`, {
          categoryKey: 'quality',
          businessUnitId,
          materialGroupId: null,
          text: 'Trotz deaktivierter Kategorie bearbeitbar',
          ownerUserId: users.member,
          targetYear: 2028,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call(users.admin, 'POST', `${planPath}/${planId}/objectives`, {
          categoryKey: 'quality',
          businessUnitId,
          materialGroupId: null,
          text: 'Neues Ziel mit deaktivierter Kategorie',
          ownerUserId: users.member,
          targetYear: 2028,
        })
      ).status,
    ).toBe(409);
  });
});
