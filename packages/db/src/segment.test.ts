import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from './schema/index.js';
import { seed, seedBuyers } from './seed.js';
import { withTenant } from './tenant.js';
import { createTempDatabase } from './testing/temp-database.js';

describe('SEG-01 Segmentmodell in der Mandanten-Session', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;

  beforeAll(async () => {
    temp = await createTempDatabase({ from: 'migrated' });
    await seed(temp.db, { nodeEnv: 'test' });
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('sieht im Test-OEM das aktive Modell mit allen Kriterien und Typen', async () => {
    const result = await withTenant(
      temp.db,
      { userId: 'demo-test-oem-1', organizationId: seedBuyers.testOem.id },
      async (tx) => {
        const [model] = await tx
          .select()
          .from(schema.segmentModel)
          .where(eq(schema.segmentModel.status, 'active'));
        if (!model) throw new Error('Aktives Segmentmodell fehlt.');
        const criteria = await tx
          .select()
          .from(schema.segmentCriterion)
          .where(eq(schema.segmentCriterion.modelId, model.id));
        const types = await tx
          .select()
          .from(schema.segmentType)
          .where(eq(schema.segmentType.modelId, model.id));
        return { model, criteria, types };
      },
    );

    expect(result.model).toMatchObject({
      orgId: seedBuyers.testOem.id,
      version: 1,
      status: 'active',
      lowMax: 33,
      midMax: 66,
    });
    expect(result.criteria.filter((criterion) => criterion.axis === 'impact')).toHaveLength(6);
    expect(result.criteria.filter((criterion) => criterion.axis === 'quality')).toHaveLength(4);
    expect(result.types).toHaveLength(9);
  });

  it('sieht beim Zweit-OEM keine Modelle, Kriterien oder Typen des Test-OEM', async () => {
    const testModel = await temp.db.execute<{ id: string }>(
      sql`select id::text from segment_model where org_id = ${seedBuyers.testOem.id} and status = 'active'`,
    );
    const id = testModel.rows[0]?.id;
    if (!id) throw new Error('Aktives Segmentmodell des Test-OEM fehlt.');

    const visible = await withTenant(
      temp.db,
      { userId: 'demo-zweit-oem-1', organizationId: seedBuyers.zweitOem.id },
      async (tx) => ({
        models: await tx.select().from(schema.segmentModel),
        criteria: await tx
          .select()
          .from(schema.segmentCriterion)
          .where(eq(schema.segmentCriterion.modelId, id)),
        types: await tx.select().from(schema.segmentType).where(eq(schema.segmentType.modelId, id)),
      }),
    );

    expect(visible.models).toHaveLength(1);
    expect(visible.models[0]?.orgId).toBe(seedBuyers.zweitOem.id);
    expect(visible.criteria).toEqual([]);
    expect(visible.types).toEqual([]);
  });

  it('kann keine Kriterien an das Modell einer anderen Organisation hängen', async () => {
    const model = await temp.db.execute<{ id: string }>(
      sql`select id::text from segment_model where org_id = ${seedBuyers.testOem.id} and status = 'active'`,
    );
    const id = model.rows[0]?.id;
    if (!id) throw new Error('Aktives Segmentmodell des Test-OEM fehlt.');

    const error = await withTenant(
      temp.db,
      { userId: 'demo-zweit-oem-1', organizationId: seedBuyers.zweitOem.id },
      (tx) =>
        tx.insert(schema.segmentCriterion).values({
          modelId: id,
          axis: 'impact',
          key: 'other_org',
          name: 'Fremder Eintrag',
          description: 'Darf nicht gespeichert werden.',
          weight: 0,
          position: 99,
        }),
    ).catch((caught: unknown) => caught);

    expect(String((error as Error).cause)).toMatch(/row-level security policy/);
  });
});
