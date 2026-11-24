import { eq, schema, sql } from '@reziproq/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seed, seedBuyers } from './seed.js';
import { withTenant } from './tenant.js';
import { createTempDatabase } from './testing/temp-database.js';

const relationshipId = 'de300000-0000-7000-8000-000000000201';
const testOem = seedBuyers.testOem.id;
const secondOem = seedBuyers.zweitOem.id;

describe('PLT-07b: geschäftliche Lieferantenkontakte', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;
  let supplierOrganizationId: string;

  beforeAll(async () => {
    temp = await createTempDatabase({ from: 'migrated' });
    await seed(temp.db, { nodeEnv: 'test' });
    const [relationship] = await temp.db
      .select({ supplierOrganizationId: schema.relationship.supplierOrgId })
      .from(schema.relationship)
      .where(eq(schema.relationship.id, relationshipId));
    if (!relationship) throw new Error('Demo-Beziehung fehlt');
    supplierOrganizationId = relationship.supplierOrganizationId;
    await withTenant(temp.db, { userId: 'demo-test-oem-1', organizationId: testOem }, (tx) =>
      tx.insert(schema.supplierContact).values({
        relationshipId,
        name: 'Ada Example',
        email: 'ada@example.com',
        function: 'Purchasing',
        position: 'Buyer',
      }),
    );
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('macht Kontakte nur für den Käufer sichtbar, auch nicht für den Lieferanten oder Zweit-OEM', async () => {
    const visibleToBuyer = await withTenant(
      temp.db,
      { userId: 'demo-test-oem-1', organizationId: testOem },
      (tx) => tx.select().from(schema.supplierContact),
    );
    expect(visibleToBuyer).toMatchObject([{ email: 'ada@example.com', name: 'Ada Example' }]);

    const readers: {
      userId: string;
      organizationId: string;
      customerOrganizationId: string | null;
    }[] = [
      { userId: 'demo-zweit-oem-1', organizationId: secondOem, customerOrganizationId: null },
      {
        userId: 'demo-test-lieferant-1',
        organizationId: supplierOrganizationId,
        customerOrganizationId: testOem,
      },
    ];
    for (const { userId, organizationId, customerOrganizationId } of readers) {
      const visible = await withTenant(
        temp.db,
        { userId, organizationId, customerOrganizationId },
        (tx) => tx.select().from(schema.supplierContact),
      );
      expect(visible).toEqual([]);
    }
  });

  it('macht Spend des Käufers für den Zweit-OEM und den jeweiligen Lieferanten unsichtbar', async () => {
    const buyerSpend = await withTenant(
      temp.db,
      { userId: 'demo-test-oem-1', organizationId: testOem },
      (tx) =>
        tx
          .select()
          .from(schema.relationshipSpend)
          .where(eq(schema.relationshipSpend.relationshipId, relationshipId)),
    );
    expect(buyerSpend.length).toBeGreaterThan(0);

    const secondOemSpend = await withTenant(
      temp.db,
      { userId: 'demo-zweit-oem-1', organizationId: secondOem },
      (tx) =>
        tx
          .select()
          .from(schema.relationshipSpend)
          .where(eq(schema.relationshipSpend.relationshipId, relationshipId)),
    );
    const supplierSpend = await withTenant(
      temp.db,
      {
        userId: 'demo-test-lieferant-1',
        organizationId: supplierOrganizationId,
        customerOrganizationId: testOem,
      },
      (tx) =>
        tx
          .select()
          .from(schema.relationshipSpend)
          .where(eq(schema.relationshipSpend.relationshipId, relationshipId)),
    );
    expect(secondOemSpend).toEqual([]);
    expect(supplierSpend).toEqual([]);
  });

  it('erzwingt eindeutige Kontakt-E-Mails je Beziehung unabhängig von Großschreibung', async () => {
    const duplicate = await withTenant(
      temp.db,
      { userId: 'demo-test-oem-1', organizationId: testOem },
      (tx) =>
        tx.insert(schema.supplierContact).values({
          relationshipId,
          name: 'Doppelt',
          email: 'ADA@example.com',
        }),
    ).catch((error: unknown) => error);
    expect(String((duplicate as Error).cause ?? duplicate)).toMatch(/supplier_contact_email/);
  });

  it('löscht Kontakte gezielt und erhält die Beziehung', async () => {
    await withTenant(temp.db, { userId: 'demo-test-oem-1', organizationId: testOem }, (tx) =>
      tx
        .delete(schema.supplierContact)
        .where(eq(schema.supplierContact.relationshipId, relationshipId)),
    );
    const remaining = await temp.db.execute<{ contacts: number; relationships: number }>(sql`
      select
        (select count(*)::int from supplier_contact where relationship_id = ${relationshipId}) as contacts,
        (select count(*)::int from relationship where id = ${relationshipId}) as relationships
    `);
    expect(remaining.rows[0]).toEqual({ contacts: 0, relationships: 1 });
  });
});
