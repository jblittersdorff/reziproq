import { randomUUID } from 'node:crypto';
import { type Database, eq, schema, sql } from '@reziproq/db';
import {
  maxPlanSummaryWords,
  type OrgRole,
  type PlanSummaryDraft,
  planSummaryDraftSchema,
  supplierPlanResponseSchema,
  wordCount,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { TestDraftModel } from '../ai-drafts/draft-model.js';

// Tests zu docs/specs/SPL-10.md mit AI_PROVIDER=test.
describe('SPL-10 KI-Entwurf der Strategie-Zusammenfassung', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const buyerOrg = randomUUID();
  const supplierOrg = randomUUID();
  const rel = randomUUID();
  const cycleId = randomUUID();
  const businessUnitId = randomUUID();
  const users = {
    sro: `spl10-sro-${run}`,
    member: `spl10-member-${run}`,
    supplier: `spl10-supplier-${run}`,
  };
  const names = ['Sara Ostermeier', 'Mia Mitglied', 'Kim Kaiserling'];
  const path = `/suppliers/${rel}/plan`;
  let planId = '';

  const call = async (user: string, method: string, url: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api${url}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };
  const draftOf = (body: unknown): PlanSummaryDraft => planSummaryDraftSchema.parse(body);
  const summary = async () =>
    supplierPlanResponseSchema.parse((await call(users.sro, 'GET', path)).body).plan?.summary;

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: buyerOrg, name: `SPL-10 Käufer ${run}` },
      { id: supplierOrg, name: `SPL-10 Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: buyerOrg, feature: 'buyer' });
    const person = (id: string, name: string, orgRole: OrgRole, organizationId = buyerOrg) => ({
      id,
      name,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.sro, names[0] as string, 'member'),
        person(users.member, names[1] as string, 'member'),
        person(users.supplier, names[2] as string, 'admin', supplierOrg),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: buyerOrg, supplier: supplierOrg }]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel, orgId: buyerOrg, userId: users.sro, teamRole: 'sro' },
      { relationshipId: rel, orgId: buyerOrg, userId: users.member, teamRole: 'member' },
    ]);
    await db
      .insert(schema.cycle)
      .values({ id: cycleId, relationshipId: rel, label: '2026', status: 'active' });
    await db
      .insert(schema.businessUnit)
      .values({ id: businessUnitId, orgId: buyerOrg, name: 'Elektronik', code: `E-${run}` });
    await db
      .insert(schema.relationshipBusinessUnit)
      .values({ relationshipId: rel, businessUnitId });
    await db.insert(schema.relationshipSpend).values([
      { relationshipId: rel, year: 2024, amountCents: 1_200_000_000 },
      { relationshipId: rel, year: 2025, amountCents: 1_500_000_000 },
    ]);
    await db.insert(schema.supplierProfile).values({
      relationshipId: rel,
      employees: 2400,
      businessSegments: 'Steuergeräte und Sensorik',
      updatedBy: users.sro,
      updatedByName: names[0] as string,
    });

    await call(users.sro, 'GET', '/objective-categories');
    planId = ((await call(users.sro, 'POST', path)).body as { id: string }).id;
    await call(users.sro, 'PATCH', `${path}/${planId}/summary`, { summary: 'Alter Text.' });
    const objective = await call(users.sro, 'POST', `${path}/${planId}/objectives`, {
      categoryKey: 'cost',
      businessUnitId,
      materialGroupId: null,
      text: 'Kosten je Baugruppe um 5 % senken, abgestimmt mit Mia Mitglied',
      ownerUserId: users.sro,
      targetYear: 2027,
    });
    await call(users.sro, 'POST', `${path}/${planId}/topics`, {
      title: 'Plattform 2027',
      reason: 'Herr Brandt vom Lieferanten bringt neue Steuergeräte ein',
      objectiveIds: [(objective.body as { id: string }).id],
    });
  });

  afterAll(async () => {
    await db.delete(schema.aiDraft).where(eq(schema.aiDraft.relationshipId, rel));
    await db.delete(schema.supplierProfile).where(eq(schema.supplierProfile.relationshipId, rel));
    await db.delete(schema.supplierPlan).where(eq(schema.supplierPlan.relationshipId, rel));
    await db.delete(schema.objectiveCategory).where(eq(schema.objectiveCategory.orgId, buyerOrg));
    await deleteRelationships(db, [buyerOrg, supplierOrg]);
    await db.delete(schema.businessUnit).where(eq(schema.businessUnit.orgId, buyerOrg));
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${buyerOrg}`);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${[buyerOrg, supplierOrg]}`);
    await testApp.close();
  });

  it('Der Entwurf ändert den Plan erst nach autorisierter Übernahme', async () => {
    const proposed = draftOf(
      (await call(users.sro, 'POST', `${path}/${planId}/summary/draft`)).body,
    );
    expect(proposed.canDraft).toBe(true);
    const draft = proposed.draft;
    expect(draft).toMatchObject({
      status: 'draft',
      decision: 'open',
      claims: [
        {
          sources: expect.arrayContaining([
            expect.objectContaining({ objectId: planId, kind: 'own_data' }),
          ]),
        },
      ],
    });
    expect(await summary()).toBe('Alter Text.');

    // Nur SRO und Admin; der Lieferant nie.
    expect((await call(users.member, 'POST', `${path}/${planId}/summary/draft`)).status).toBe(403);
    expect(
      draftOf((await call(users.member, 'GET', `${path}/${planId}/summary/draft`)).body),
    ).toEqual({ canDraft: false, draft: null });
    expect((await call(users.supplier, 'GET', `${path}/${planId}/summary/draft`)).status).toBe(403);

    const accepted = draftOf(
      (await call(users.sro, 'POST', `${path}/${planId}/summary/draft/${draft?.id}/accept`)).body,
    );
    expect(accepted.draft).toBeNull();
    expect(accepted.accepted).toMatchObject({ decision: 'adopted', decidedAt: expect.any(String) });
    expect(await summary()).toBe(draft?.content);
    const edited = `${draft?.content} Ergänzt vom SRO.`;
    expect(
      (await call(users.sro, 'PATCH', `${path}/${planId}/summary`, { summary: edited })).status,
    ).toBe(200);
    expect(await summary()).toBe(edited);
  });

  it('Die Eingabe an die KI enthält keine Namen von Personen', async () => {
    TestDraftModel.requests.length = 0;
    expect((await call(users.sro, 'POST', `${path}/${planId}/summary/draft`)).status).toBe(200);
    const prompt = TestDraftModel.requests.at(-1)?.prompt ?? '';
    for (const name of [...names, 'Brandt'])
      for (const part of name.split(' ')) expect(prompt).not.toContain(part);
    expect(prompt).toContain('[Person] vom Lieferanten bringt neue Steuergeräte ein');
    expect(prompt).toContain('Kosten je Baugruppe um 5 % senken');
    expect(prompt).toContain('2025: 15 Mio. EUR');
    expect(prompt).toContain('Mitarbeitende: 2400');
  });

  it('Der Entwurf überschreitet nie 120 Wörter', async () => {
    const proposed = draftOf(
      (await call(users.sro, 'POST', `${path}/${planId}/summary/draft`)).body,
    );
    const content = proposed.draft?.content ?? '';
    // Das Testmodell schreibt absichtlich mehr; Reziproq kürzt am Satzende.
    expect(wordCount(content)).toBeGreaterThan(80);
    expect(wordCount(content)).toBeLessThanOrEqual(maxPlanSummaryWords);
    expect(content.endsWith('.')).toBe(true);
  });
});
