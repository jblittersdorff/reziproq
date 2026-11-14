import { randomUUID } from 'node:crypto';
import { type Database, eq, schema, sql } from '@reziproq/db';
import { touchpointListSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PLB-06.md: Lücken zu vereinbarten Formaten, „geprüft“ erledigt den
// Zyklus-Schritt, interne Kontaktpunkte sieht der Lieferant nie, geteilte schon, und eine geteilte
// Zeile verweist nie auf einen käuferprivaten Kontakt.
describe('PLB-06 Kontaktpunkte', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const contactId = randomUUID();
  const users = {
    sro: `plb06-sro-${run}`,
    outsider: `plb06-out-${run}`,
    supplier: `plb06-sup-${run}`,
  };
  const base = `/suppliers/${rel}/kontaktpunkte`;

  const call = async (user: string, method: string, url: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api${url}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      body: (await response.json().catch(() => null)) as Record<string, unknown> | null,
    };
  };

  const touchpoint = (overrides: Record<string, unknown> = {}) => ({
    visibility: 'internal',
    buyerUserId: users.sro,
    buyerName: null,
    buyerLevel: 'executive',
    supplierContactId: contactId,
    supplierName: null,
    supplierLevel: 'executive',
    format: 'Strategiedialog',
    cadence: 'semiannual',
    notes: null,
    ...overrides,
  });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `PLB6-OEM ${run}` },
      { id: orgs.supplier, name: `PLB6-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const user = (id: string, name: string, organizationId: string) => ({
      id,
      name,
      email: `${id}@example.com`,
      organizationId,
      orgRole: 'member' as const,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        user(users.sro, 'Sara Ost', orgs.oem),
        user(users.outsider, 'Otto Rand', orgs.oem),
        user(users.supplier, 'Kim Kaiser', orgs.supplier),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    // Die Zyklus-Leiste gibt es nur für Fokuslieferanten (SEG-02).
    await db
      .insert(schema.relationshipSide)
      .values({ relationshipId: rel, orgId: orgs.oem, isFocus: true, focusReason: 'Test' });
    await db.insert(schema.relationshipMember).values({
      relationshipId: rel,
      orgId: orgs.oem,
      userId: users.sro,
      teamRole: 'sro',
    });
    await db.insert(schema.supplierContact).values({
      id: contactId,
      relationshipId: rel,
      name: 'Petra Wolf',
      email: `petra-${run}@example.com`,
    });
    await db.insert(schema.cycle).values({ relationshipId: rel, label: '2099' });
    const [set] = await db
      .insert(schema.ruleSet)
      .values({
        relationshipId: rel,
        ownerOrgId: orgs.oem,
        version: 1,
        status: 'approved',
        targetImpactLevel: 3,
        targetQualityLevel: 3,
        typeName: 'Strategischer Partner',
        createdBy: users.sro,
        approvedBy: users.sro,
        approvedByName: 'Sara Ost',
        approvedAt: new Date(),
      })
      .returning({ id: schema.ruleSet.id });
    const format = (
      de: string,
      en: string,
      position: number,
      level: 'executive' | 'operational',
    ) => ({
      ruleSetId: set?.id as string,
      relationshipId: rel,
      ownerOrgId: orgs.oem,
      kind: 'format' as const,
      title: { de, en },
      description: { de: 'x', en: 'x' },
      cadence: 'quarterly' as const,
      level,
      origin: 'custom' as const,
      position,
    });
    await db
      .insert(schema.ruleSetItem)
      .values([
        format('Strategiedialog', 'Strategy dialogue', 1, 'executive'),
        format('Operative Abstimmung', 'Operational alignment', 2, 'operational'),
      ]);
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    await db.delete(schema.touchpoint).where(eq(schema.touchpoint.relationshipId, rel));
    await db.execute(sql`delete from touchpoint_review where relationship_id = ${rel}`);
    await db.delete(schema.ruleSetItem).where(eq(schema.ruleSetItem.relationshipId, rel));
    await db.delete(schema.ruleSet).where(eq(schema.ruleSet.relationshipId, rel));
    await db.delete(schema.cycle).where(eq(schema.cycle.relationshipId, rel));
    await db.delete(schema.supplierContact).where(eq(schema.supplierContact.relationshipId, rel));
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  let internalId: string;

  it('ein vereinbartes Format ohne Kontaktpunkt erscheint als Lücke', async () => {
    const before = touchpointListSchema.parse((await call(users.sro, 'GET', base)).body);
    expect(before.gaps.map((gap) => gap.title.de)).toEqual([
      'Strategiedialog',
      'Operative Abstimmung',
    ]);
    const created = await call(users.sro, 'POST', base, touchpoint());
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ buyerName: 'Sara Ost', supplierName: 'Petra Wolf' });
    internalId = created.body?.id as string;
    // Gleicher Name in anderer Schreibweise zählt; das andere Format bleibt Lücke.
    await call(
      users.sro,
      'POST',
      base,
      touchpoint({
        format: ' strategy DIALOGUE ',
        supplierContactId: null,
        supplierName: 'Kim Kaiser',
      }),
    );
    const after = touchpointListSchema.parse((await call(users.sro, 'GET', base)).body);
    expect(after.gaps.map((gap) => gap.title.de)).toEqual(['Operative Abstimmung']);
    expect(after.touchpoints).toHaveLength(2);
  });

  it('nur SRO und Team bearbeiten; der Lieferant ändert nichts', async () => {
    expect((await call(users.outsider, 'POST', base, touchpoint())).status).toBe(403);
    expect(
      (await call(users.supplier, 'POST', `/kunden/${rel}/kontaktpunkte`, touchpoint())).status,
    ).toBe(404);
    expect((await call(users.supplier, 'GET', base)).status).toBe(403);
  });

  it('eine geteilte Zeile kann nicht auf einen käuferprivaten Kontakt verweisen', async () => {
    const response = await call(users.sro, 'POST', base, touchpoint({ visibility: 'shared' }));
    expect(response.status).toBe(400);
    await expect(
      db.execute(sql`update touchpoint set visibility = 'shared' where id = ${internalId}`),
    ).rejects.toThrow();
  });

  it('interne Kontaktpunkte sieht der Lieferant nie, geteilte nach dem Teilen schon', async () => {
    const supplierView = async () =>
      touchpointListSchema.parse(
        (await call(users.supplier, 'GET', `/kunden/${rel}/kontaktpunkte`)).body,
      );
    expect((await supplierView()).touchpoints).toEqual([]);
    const shared = await call(users.sro, 'POST', `${base}/${internalId}/teilen`);
    expect(shared.status).toBe(200);
    // Der Verweis auf den Kontakt fällt beim Teilen weg, der Name bleibt.
    expect(shared.body).toMatchObject({
      visibility: 'shared',
      supplierContactId: null,
      supplierName: 'Petra Wolf',
    });
    const seen = await supplierView();
    expect(seen.touchpoints.map((entry) => entry.id)).toEqual([internalId]);
    expect(seen.gaps).toEqual([]);
    expect(seen.contacts).toEqual([]);
  });

  it('„geprüft“ erledigt den Zyklus-Schritt Kontaktpunkte', async () => {
    const step = async () => {
      const overview = (await call(users.sro, 'GET', `/suppliers/${rel}/overview`)).body as {
        cycle: { steps: { key: string; status: string }[] };
      };
      return overview.cycle.steps.find((entry) => entry.key === 'touchpoints')?.status;
    };
    expect(await step()).toBe('in_progress');
    const reviewed = touchpointListSchema.parse(
      (await call(users.sro, 'POST', `${base}/geprueft`)).body,
    );
    expect(reviewed.review?.reviewedByName).toBe('Sara Ost');
    expect(reviewed.canReview).toBe(false);
    expect(await step()).toBe('completed');
  });
});
