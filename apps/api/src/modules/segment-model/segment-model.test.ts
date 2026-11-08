import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  defaultSegmentCriteria,
  defaultSegmentTypes,
  type OrgRole,
  segmentModelResponseSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp } from '../../testing/test-app.js';

describe('SEG-01 Segmentmodell über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), zweit: randomUUID(), supplier: randomUUID() };
  const users = {
    admin: `seg-admin-${run}`,
    member: `seg-member-${run}`,
    viewer: `seg-viewer-${run}`,
    zweit: `seg-zweit-${run}`,
    supplier: `seg-supplier-${run}`,
  };

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

  const addUser = (id: string, role: OrgRole, organizationId: string) => ({
    id,
    name: id,
    email: `${id}@example.com`,
    organizationId,
    orgRole: role,
    rolesImportedAt: new Date(),
  });

  const addModel = async (orgId: string, typePrefix: string) => {
    const [model] = await db
      .insert(schema.segmentModel)
      .values({
        orgId,
        version: 1,
        status: 'active',
        lowMax: 33,
        midMax: 66,
        activatedAt: new Date(),
      })
      .returning({ id: schema.segmentModel.id });
    if (!model) throw new Error('Segmentmodell konnte nicht angelegt werden.');
    await db
      .insert(schema.segmentCriterion)
      .values(defaultSegmentCriteria.map((criterion) => ({ ...criterion, modelId: model.id })));
    await db.insert(schema.segmentType).values(
      defaultSegmentTypes.map((type) => ({
        ...type,
        modelId: model.id,
        name: `${typePrefix}: ${type.name}`,
      })),
    );
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `SEG-OEM ${run}` },
      { id: orgs.zweit, name: `SEG-Zweit ${run}` },
      { id: orgs.supplier, name: `SEG-Lieferant ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' },
      { organizationId: orgs.zweit, feature: 'buyer' },
    ]);
    await db
      .insert(schema.appUser)
      .values([
        addUser(users.admin, 'admin', orgs.oem),
        addUser(users.member, 'member', orgs.oem),
        addUser(users.viewer, 'viewer', orgs.oem),
        addUser(users.zweit, 'admin', orgs.zweit),
        addUser(users.supplier, 'admin', orgs.supplier),
      ]);
    await addModel(orgs.oem, 'Test');
    await addModel(orgs.zweit, 'Zweit');
  });

  afterAll(async () => {
    await db
      .delete(schema.segmentModel)
      .where(sql`${schema.segmentModel.orgId} in ${Object.values(orgs)}`);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('alle Käuferrollen sehen nur das eigene Modell', async () => {
    for (const user of [users.admin, users.member, users.viewer]) {
      const response = await call(user, 'GET', '/segment-model');
      expect(response.status, user).toBe(200);
      const model = segmentModelResponseSchema.parse(response.body);
      expect(model.active?.types[0]?.name).toContain('Test:');
      expect(model.active?.version).toBe(1);
      expect(model.draft).toBeNull();
    }

    const second = segmentModelResponseSchema.parse(
      (await call(users.zweit, 'GET', '/segment-model')).body,
    );
    expect(second.active?.types[0]?.name).toContain('Zweit:');
    expect(second.active?.types[0]?.name).not.toContain('Test:');
    expect((await call(users.supplier, 'GET', '/segment-model')).status).toBe(403);
  });

  it('nur Admins ändern ein Modell; ungültige Gewichte bleiben ungespeichert', async () => {
    for (const user of [users.member, users.viewer]) {
      expect(
        (await call(user, 'PATCH', '/segment-model/draft/boundaries', { lowMax: 32, midMax: 66 }))
          .status,
      ).toBe(403);
    }

    const invalid = await call(users.admin, 'PUT', '/segment-model/draft/weights', {
      impact: defaultSegmentCriteria
        .filter((criterion) => criterion.axis === 'impact')
        .map(({ key, weight }) => ({ key, weight })),
      quality: defaultSegmentCriteria
        .filter((criterion) => criterion.axis === 'quality')
        .map(({ key, weight }, index) => ({ key, weight: index === 0 ? weight - 1 : weight })),
    });
    expect(invalid.status).toBe(400);

    const untouched = segmentModelResponseSchema.parse(
      (await call(users.admin, 'GET', '/segment-model')).body,
    );
    expect(untouched.draft).toBeNull();
  });

  it('Bearbeitungen entstehen als Entwurf; Aktivierung erhöht die Version und retired die alte', async () => {
    const update = await call(users.admin, 'PATCH', '/segment-model/draft/boundaries', {
      lowMax: 32,
      midMax: 67,
    });
    expect(update.status).toBe(200);
    let response = segmentModelResponseSchema.parse(update.body);
    expect(response.active).toMatchObject({ version: 1, status: 'active', lowMax: 33 });
    expect(response.draft).toMatchObject({ version: 2, status: 'draft', lowMax: 32, midMax: 67 });

    const criterion = await call(users.admin, 'PATCH', '/segment-model/draft/criteria/spend', {
      name: 'Einkaufsvolumen',
      description: 'Bedeutung des gesamten Einkaufsvolumens.',
    });
    expect(criterion.status).toBe(200);
    response = segmentModelResponseSchema.parse(criterion.body);
    expect(response.draft?.criteria.find((entry) => entry.key === 'spend')).toMatchObject({
      name: 'Einkaufsvolumen',
      description: 'Bedeutung des gesamten Einkaufsvolumens.',
    });

    const activated = await call(users.admin, 'POST', '/segment-model/draft/activate');
    expect(activated.status).toBe(201);
    response = segmentModelResponseSchema.parse(activated.body);
    expect(response.active).toMatchObject({ version: 2, status: 'active', lowMax: 32, midMax: 67 });
    expect(response.draft).toBeNull();

    const versions = await db
      .select({ version: schema.segmentModel.version, status: schema.segmentModel.status })
      .from(schema.segmentModel)
      .where(sql`${schema.segmentModel.orgId} = ${orgs.oem}`)
      .orderBy(schema.segmentModel.version);
    expect(versions).toEqual([
      { version: 1, status: 'retired' },
      { version: 2, status: 'active' },
    ]);
  });
});
