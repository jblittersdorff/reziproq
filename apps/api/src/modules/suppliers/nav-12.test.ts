import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { defaultSegmentTypes, suppliersResponseSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// NAV-12: Die Liste trägt die Angaben für die Filter (Zuordnung, Soll-Typ, Fokus, Team).
describe('NAV-12 Lieferantenliste für Filter', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const oem = randomUUID();
  const orgs = [randomUUID(), randomUUID(), randomUUID()];
  const rels = [randomUUID(), randomUUID(), randomUUID()];
  const unit = randomUUID();
  const top = randomUUID();
  const sub = randomUUID();
  const users = { anna: `n12-anna-${run}`, ben: `n12-ben-${run}` };

  const list = async (user: string) => {
    const response = await testApp.get(
      '/api/suppliers',
      await testApp.signToken({ subject: user }),
    );
    return suppliersResponseSchema.parse(await response.json());
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db
      .insert(schema.organization)
      .values([
        { id: oem, name: `OEM ${run}`, country: 'DE' },
        ...orgs.map((id, index) => ({ id, name: `Lief ${index} ${run}`, country: 'DE' })),
      ]);
    await db.insert(schema.organizationFeature).values({ organizationId: oem, feature: 'buyer' });
    await db.insert(schema.appUser).values(
      Object.values(users).map((id) => ({
        id,
        name: id,
        email: `${id}@example.com`,
        organizationId: oem,
      })),
    );
    await insertRelationships(
      db,
      rels.map((id, index) => ({ id, buyer: oem, supplier: orgs[index] as string })),
    );
    await db
      .insert(schema.businessUnit)
      .values({ id: unit, orgId: oem, name: 'Antrieb', code: `A-${run}` });
    await db.insert(schema.materialGroup).values([
      { id: top, orgId: oem, name: 'Stahl', code: `S-${run}` },
      { id: sub, orgId: oem, name: 'Blech', code: `B-${run}`, parentId: top },
    ]);
    await db
      .insert(schema.relationshipBusinessUnit)
      .values({ relationshipId: rels[0] as string, businessUnitId: unit });
    await db
      .insert(schema.relationshipMaterialGroup)
      .values({ relationshipId: rels[0] as string, materialGroupId: sub, isPrimary: true });
    await db.insert(schema.relationshipMember).values({
      relationshipId: rels[1] as string,
      orgId: oem,
      userId: users.anna,
      teamRole: 'sro',
    });
    await db.insert(schema.relationshipSide).values({
      relationshipId: rels[2] as string,
      orgId: oem,
      isFocus: true,
      focusReason: 'Test',
    });
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
    await db
      .insert(schema.segmentType)
      .values(defaultSegmentTypes.map((type) => ({ ...type, modelId: model?.id as string })));
    await db.insert(schema.segmentDecision).values({
      relationshipId: rels[0] as string,
      scope: 'total',
      istImpactLevel: 2,
      istQualityLevel: 2,
      sollImpactLevel: 3,
      sollQualityLevel: 3,
      reason: 'Test',
      modelVersion: 1,
      decidedBy: users.ben,
      version: 1,
    });
  });

  afterAll(async () => {
    await db.delete(schema.segmentModel).where(sql`${schema.segmentModel.orgId} = ${oem}`);
    await deleteRelationships(db, [oem, ...orgs]);
    await db.delete(schema.businessUnit).where(sql`${schema.businessUnit.orgId} = ${oem}`);
    await db.delete(schema.materialGroup).where(sql`${schema.materialGroup.orgId} = ${oem}`);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db.delete(schema.organization).where(sql`${schema.organization.id} in ${[oem, ...orgs]}`);
    await testApp.close();
  });

  it('jede Beziehung trägt Zuordnung, Soll-Typ, Fokus und Team-Zugehörigkeit', async () => {
    const byId = new Map((await list(users.anna)).suppliers.map((s) => [s.relationshipId, s]));
    expect(byId.get(rels[0] as string)).toMatchObject({
      businessUnitIds: [unit],
      materialGroupIds: [sub],
      targetType: '3-3',
      isFocus: false,
      isMine: false,
    });
    expect(byId.get(rels[1] as string)).toMatchObject({ isMine: true, targetType: null });
    expect(byId.get(rels[2] as string)).toMatchObject({ isFocus: true, isMine: false });
  });

  it('„meine“ gilt je Person: Ben ist in keinem Team', async () => {
    const suppliers = (await list(users.ben)).suppliers;
    expect(suppliers.filter((s) => s.isMine)).toHaveLength(0);
  });

  it('die Filterauswahl nennt Business Units, Warengruppen mit Oberebene und Soll-Typen', async () => {
    const { filters } = await list(users.anna);
    expect(filters?.businessUnits).toEqual([{ id: unit, name: 'Antrieb' }]);
    expect(filters?.materialGroups).toEqual(
      expect.arrayContaining([
        { id: top, name: 'Stahl', parentId: null },
        { id: sub, name: 'Blech', parentId: top },
      ]),
    );
    expect(filters?.targetTypes.map((type) => type.key)).toContain('3-3');
    expect(filters?.targetTypes).toHaveLength(9);
  });
});
