import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import {
  defaultSegmentCriteria,
  defaultSegmentTypes,
  dueListSchema,
  lastFullYear,
  supplierCategoriesSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { MergeService } from './merge.service.js';

// Tests zu docs/specs/WG-20.md (Zusammenführung), je Kriterium aus „Fertig, wenn“ (Teil 31a).
describe('WG-20 Zusammenführung je Lieferant', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), s1: randomUUID(), s2: randomUUID(), s3: randomUUID() };
  const rel = { main: randomUUID(), other: randomUUID(), lonely: randomUUID() };
  const groups = { g1: randomUUID(), g2: randomUUID(), g3: randomUUID(), g4: randomUUID() };
  const unit = randomUUID();
  const u = (key: string) => `wg20-${key}-${run}`;
  const users = {
    sro: u('sro'),
    lead1: u('lead1'),
    lead2: u('lead2'),
    lead3: u('lead3'),
    cm2: u('cm2'),
    admin: u('admin'),
    reader: u('reader'),
    supplier: u('sup'),
  };
  const strategies = { g1: randomUUID(), g2: randomUUID(), g3: randomUUID() };
  let modelId = '';
  const year = lastFullYear();

  const call = async (user: string, method: string, url: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api${url}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };
  const page = async (user = users.sro, relationshipId = rel.main) =>
    supplierCategoriesSchema.parse(
      (await call(user, 'GET', `/warengruppen/lieferanten/${relationshipId}`)).body,
    );
  const sync = () => testApp.app.get(MergeService).syncOrganization(orgs.a);
  const due = async (user: string, kind: string) =>
    dueListSchema
      .parse((await call(user, 'GET', '/start/due')).body)
      .items.filter((item) => item.kind === kind);
  const decide = (
    group: string,
    ist: [number, number],
    soll: [number, number],
    version: number,
    decidedAt = new Date(),
  ) =>
    db.insert(schema.segmentDecision).values({
      relationshipId: rel.main,
      scope: 'category',
      materialGroupId: group,
      istImpactLevel: ist[0],
      istQualityLevel: ist[1],
      sollImpactLevel: soll[0],
      sollQualityLevel: soll[1],
      reason: 'Runde',
      modelVersion: 1,
      decidedBy: users.sro,
      version,
      decidedAt,
    });
  /** Abgegebene Bewertung je Warengruppe: alle Kriterien mit demselben Ist und Soll */
  const rate = async (group: string, ist: number, soll: number) => {
    const roundId = randomUUID();
    await db.insert(schema.segmentationRound).values({
      id: roundId,
      orgId: orgs.a,
      name: `Runde ${group}`,
      dueDate: '2099-12-31',
      status: 'open',
      scope: 'category',
      materialGroupId: group,
      modelVersion: 1,
      createdBy: users.admin,
    });
    const [assignment] = await db
      .insert(schema.ratingAssignment)
      .values({
        roundId,
        relationshipId: rel.main,
        businessUnitId: unit,
        materialGroupId: group,
        function: 'purchasing',
        raterUserId: users.admin,
        status: 'submitted',
      })
      .returning({ id: schema.ratingAssignment.id });
    await db.insert(schema.rating).values(
      defaultSegmentCriteria.map((criterion) => ({
        assignmentId: assignment?.id as string,
        relationshipId: rel.main,
        criterionKey: criterion.key,
        modelVersion: 1,
        ist,
        soll,
        submittedAt: new Date(),
      })),
    );
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `WG20-A ${run}` },
      { id: orgs.s1, name: `WG20-Rheintal ${run}` },
      { id: orgs.s2, name: `WG20-Saar ${run}` },
      { id: orgs.s3, name: `WG20-Ohne ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.a, feature: 'buyer' });
    await db.insert(schema.appUser).values(
      Object.entries(users).map(([key, id]) => ({
        id,
        name: key,
        email: `${id}@example.com`,
        organizationId: key === 'supplier' ? orgs.s1 : orgs.a,
        orgRole: key === 'admin' || key === 'supplier' ? ('admin' as const) : ('member' as const),
        rolesImportedAt: new Date(),
      })),
    );
    await insertRelationships(db, [
      { id: rel.main, buyer: orgs.a, supplier: orgs.s1 },
      { id: rel.other, buyer: orgs.a, supplier: orgs.s2 },
      { id: rel.lonely, buyer: orgs.a, supplier: orgs.s3 },
    ]);
    await db
      .insert(schema.relationshipMember)
      .values({ relationshipId: rel.main, orgId: orgs.a, userId: users.sro, teamRole: 'sro' });
    await db
      .insert(schema.businessUnit)
      .values({ id: unit, orgId: orgs.a, name: 'Antrieb', code: `A-${run}` });
    await db.insert(schema.materialGroup).values([
      {
        id: groups.g1,
        orgId: orgs.a,
        name: 'Leiterplatten',
        code: `LP-${run}`,
        leadUserId: users.lead1,
      },
      {
        id: groups.g2,
        orgId: orgs.a,
        name: 'Gussteile',
        code: `GU-${run}`,
        leadUserId: users.lead2,
        commodityManagerUserId: users.cm2,
      },
      { id: groups.g3, orgId: orgs.a, name: 'Kabel', code: `KA-${run}`, leadUserId: users.lead3 },
      { id: groups.g4, orgId: orgs.a, name: 'Schrauben', code: `SC-${run}` },
    ]);
    // Spend in drei Warengruppen; Saar nur in Leiterplatten
    await db.insert(schema.relationshipSpend).values([
      { relationshipId: rel.main, year, amountCents: 6_000_000, materialGroupId: groups.g1 },
      { relationshipId: rel.main, year, amountCents: 3_000_000, materialGroupId: groups.g2 },
      { relationshipId: rel.main, year, amountCents: 1_000_000, materialGroupId: groups.g3 },
      { relationshipId: rel.other, year, amountCents: 4_000_000, materialGroupId: groups.g1 },
      { relationshipId: rel.lonely, year, amountCents: 500_000, materialGroupId: groups.g4 },
    ]);
    const [model] = await db
      .insert(schema.segmentModel)
      .values({
        orgId: orgs.a,
        version: 1,
        status: 'active',
        lowMax: 33,
        midMax: 66,
        activatedAt: new Date(),
      })
      .returning({ id: schema.segmentModel.id });
    modelId = model?.id as string;
    await db
      .insert(schema.segmentCriterion)
      .values(defaultSegmentCriteria.map((criterion) => ({ ...criterion, modelId })));
    await db
      .insert(schema.segmentType)
      .values(defaultSegmentTypes.map((type) => ({ ...type, modelId })));
    // Zunächst nur eine Strategie (Leiterplatten)
    await db.insert(schema.materialGroupStrategy).values({
      id: strategies.g1,
      orgId: orgs.a,
      materialGroupId: groups.g1,
      year: 2031,
      createdBy: users.lead1,
    });
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    await db.execute(sql`delete from material_group_conflict where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_strategy where org_id in ${orgIds}`);
    await deleteRelationships(db, orgIds);
    if (modelId) {
      await db.execute(sql`delete from segment_type where model_id = ${modelId}`);
      await db.execute(sql`delete from segment_criterion where model_id = ${modelId}`);
    }
    await db.execute(sql`delete from segment_model where org_id in ${orgIds}`);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('ein Lieferant mit Spend in drei Warengruppen hat drei Zeilen, auch wenn nur eine Strategie existiert', async () => {
    const result = await page();
    expect(
      result.rows.map((row) => [row.groupName, row.amountCents, row.strategy?.id ?? null]),
    ).toEqual([
      ['Leiterplatten', 6_000_000, strategies.g1],
      ['Gussteile', 3_000_000, null],
      ['Kabel', 1_000_000, null],
    ]);
    expect(result.totalCents).toBe(10_000_000);
    expect(result.rows[0]?.shareInGroup).toBeCloseTo(0.6);
    expect(result.conflicts).toEqual([]);
    expect(result.proposal?.skipped.map((entry) => entry.reason)).toEqual([
      'no_rating',
      'no_rating',
      'no_rating',
    ]);
  });

  it('jede der vier Regeln löst genau einen Widerspruch und die Aufgaben aus', async () => {
    await db.insert(schema.materialGroupStrategy).values([
      {
        id: strategies.g2,
        orgId: orgs.a,
        materialGroupId: groups.g2,
        year: 2031,
        createdBy: users.lead2,
      },
      {
        id: strategies.g3,
        orgId: orgs.a,
        materialGroupId: groups.g3,
        year: 2031,
        createdBy: users.lead3,
      },
    ]);
    // Leiterplatten schwach, Gussteile stark und Soll mit hohem Business Impact
    await decide(groups.g1, [2, 1], [2, 2], 1);
    await decide(groups.g2, [2, 3], [3, 3], 1);
    // Kabel: Soll „beenden“, trotzdem möglicher Lieferant einer Vergabe
    await db.insert(schema.materialGroupSupplierMapRow).values([
      {
        orgId: orgs.a,
        strategyId: strategies.g3,
        relationshipId: rel.main,
        targetYear: 2032,
        shareTarget: 0,
        ended: true,
      },
      {
        orgId: orgs.a,
        strategyId: strategies.g1,
        relationshipId: rel.main,
        targetYear: 2032,
        shareTarget: 60,
      },
      {
        orgId: orgs.a,
        strategyId: strategies.g1,
        relationshipId: rel.other,
        targetYear: 2032,
        shareTarget: 30,
      },
      {
        orgId: orgs.a,
        strategyId: strategies.g2,
        relationshipId: rel.main,
        targetYear: 2032,
        shareTarget: 60,
      },
    ]);
    const [award] = await db
      .insert(schema.materialGroupAward)
      .values({ orgId: orgs.a, strategyId: strategies.g3, name: 'Rahmenvertrag Kabel' })
      .returning({ id: schema.materialGroupAward.id });
    await db.insert(schema.materialGroupAwardSupplier).values({
      orgId: orgs.a,
      strategyId: strategies.g3,
      awardId: award?.id as string,
      relationshipId: rel.main,
    });
    await sync();
    await sync();
    const conflicts = (await page()).conflicts;
    const byRule = (rule: string) => conflicts.filter((entry) => entry.ruleKey === rule);
    expect(conflicts).toHaveLength(4);
    const names = (rule: string) =>
      byRule(rule)[0]
        ?.groups.map((group) => group.name)
        .sort();
    expect(names('phase_out_vs_growth')).toEqual(['Gussteile', 'Kabel']);
    expect(names('relationship_mixed')).toEqual(['Gussteile', 'Leiterplatten']);
    expect(names('concentration')).toEqual(['Gussteile', 'Leiterplatten']);
    expect(names('award_vs_target')).toEqual(['Kabel']);
    // Aufgaben „Botschaft abstimmen“ beim SRO (alle) und bei den Leads (ihre Warengruppen)
    expect(await due(users.sro, 'category_conflict')).toHaveLength(4);
    expect(await due(users.lead3, 'category_conflict')).toHaveLength(2);
    expect(await due(users.lead1, 'category_conflict')).toHaveLength(2);
    expect((await due(users.reader, 'category_conflict')).length).toBe(0);
    // Überblick und JBP-Vorbereitung nennen die offenen Widersprüche
    const overview = await call(users.sro, 'GET', `/suppliers/${rel.main}/overview`);
    expect(overview.body).toMatchObject({ openConflicts: 4 });
    // Kabel und Gussteile haben keine Strategie im laufenden Jahr; die Warnung blockiert nicht
    const jbp = await call(users.sro, 'GET', `/suppliers/${rel.main}/jbp`);
    expect(jbp.status).toBe(200);
    expect(jbp.body).toMatchObject({ categories: { openConflicts: 4 } });
  });

  it('ein gelöster Widerspruch kommt nicht wieder, solange sich die Lage nicht ändert', async () => {
    const mixed = (await page()).conflicts.find((entry) => entry.ruleKey === 'relationship_mixed');
    const url = `/warengruppen/widersprueche/${mixed?.id}`;
    expect((await call(users.reader, 'POST', url, { status: 'aligned', note: 'x' })).status).toBe(
      403,
    );
    expect(await call(users.lead1, 'POST', url, { status: 'aligned', note: ' ' })).toMatchObject({
      status: 400,
      body: { code: 'note_required' },
    });
    // Der Commodity Manager einer betroffenen Warengruppe darf lösen (Gründer, 23.11.2026)
    const resolved = await call(users.cm2, 'POST', url, {
      status: 'aligned',
      note: 'Botschaft: Gussteile ausbauen, Leiterplatten Gespräch zur Zusammenarbeit.',
    });
    expect(resolved.status).toBe(201);
    await sync();
    let mixedRows = (await page()).conflicts.filter(
      (entry) => entry.ruleKey === 'relationship_mixed',
    );
    expect(mixedRows).toHaveLength(1);
    expect(mixedRows[0]).toMatchObject({
      status: 'aligned',
      note: 'Botschaft: Gussteile ausbauen, Leiterplatten Gespräch zur Zusammenarbeit.',
      decidedBy: 'cm2',
    });
    // Neue Lage: Kabel ebenfalls schwach → neuer offener Widerspruch, der alte bleibt im Verlauf
    await decide(groups.g3, [1, 1], [1, 1], 1);
    await sync();
    mixedRows = (await page()).conflicts.filter((entry) => entry.ruleKey === 'relationship_mixed');
    expect(mixedRows.map((entry) => entry.status)).toEqual(['open', 'aligned']);
  });

  it('der Vorschlag für das Gesamtsegment zeigt seinen Rechenweg und stimmt mit einer Rechnung von Hand überein', async () => {
    // Leiterplatten Ist 80 / Soll 90, Gussteile Ist 20 / Soll 40; Kabel ohne Bewertung
    await rate(groups.g1, 80, 90);
    await rate(groups.g2, 20, 40);
    const { proposal } = await page();
    // Gewichte 6 : 3 → 2/3 und 1/3; Ist = 80·2/3 + 20·1/3 = 60, Soll = 90·2/3 + 40·1/3 = 73,33
    expect(proposal?.sources.map((entry) => [entry.groupName, entry.weight])).toEqual([
      ['Leiterplatten', 0.6667],
      ['Gussteile', 0.3333],
    ]);
    expect(proposal?.skipped).toEqual([
      { groupId: groups.g3, groupName: 'Kabel', reason: 'no_rating' },
    ]);
    expect(proposal?.criteria.every((entry) => entry.ist === 60 && entry.soll === 73.33)).toBe(
      true,
    );
    expect(proposal?.ist).toMatchObject({
      impactScore: 60,
      qualityScore: 60,
      impactLevel: 2,
      qualityLevel: 2,
    });
    expect(proposal?.soll).toMatchObject({ impactLevel: 3, qualityLevel: 3 });
    // Übernehmen nur SRO oder Admin; dann Gesamtsegment mit Herkunft „merged“
    expect(
      (await call(users.lead1, 'POST', `/warengruppen/lieferanten/${rel.main}/gesamtsegment`))
        .status,
    ).toBe(403);
    const adopted = supplierCategoriesSchema.parse(
      (await call(users.sro, 'POST', `/warengruppen/lieferanten/${rel.main}/gesamtsegment`)).body,
    );
    expect(adopted.decided).toMatchObject({ origin: 'merged' });
    expect(await due(users.sro, 'overall_segment_check')).toHaveLength(0);
    // Ändert sich danach ein Segment in einer Warengruppe, bekommt der SRO „Gesamtsegment prüfen“
    await decide(groups.g2, [2, 2], [3, 3], 2, new Date(Date.now() + 60_000));
    expect(await due(users.sro, 'overall_segment_check')).toHaveLength(1);
  });

  it('ein Lieferant ohne jede Strategie bleibt im Lieferantenmanagement voll nutzbar', async () => {
    const lonely = await page(users.admin, rel.lonely);
    expect(lonely.rows.map((row) => [row.groupName, row.strategy])).toEqual([['Schrauben', null]]);
    expect(lonely.conflicts).toEqual([]);
    const overview = await call(users.admin, 'GET', `/suppliers/${rel.lonely}/overview`);
    expect(overview.status).toBe(200);
    expect(overview.body).toMatchObject({ openConflicts: 0, upcomingAwards: 0 });
  });

  it('der Test-Lieferant sieht weder Zusammenführung noch Widersprüche', async () => {
    const result = await call(users.supplier, 'GET', `/warengruppen/lieferanten/${rel.main}`);
    expect([403, 404]).toContain(result.status);
    const rows = await withTenant(
      db,
      { userId: users.supplier, organizationId: orgs.s1 },
      async (tx) => tx.execute(sql`select 1 from material_group_conflict`),
    );
    expect(rows.rows).toHaveLength(0);
  });
});
