import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  categorySegmentationSchema,
  defaultSegmentCriteria,
  defaultSegmentTypes,
  lastFullYear,
  portfolioMatrixSchema,
  portfolioOpenSchema,
  ratingAssignmentListSchema,
  segmentationSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/WG-18.md: Segmentierung je Warengruppe, je Kriterium aus „Fertig, wenn“.
describe('WG-18 Segmentierung je Warengruppe', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), b: randomUUID(), s1: randomUUID(), s2: randomUUID() };
  const rel1 = randomUUID();
  const rel2 = randomUUID();
  const unit = randomUUID();
  const boards = randomUUID();
  const castings = randomUUID();
  const portfolioRound = randomUUID();
  let modelId = '';
  const year = lastFullYear();
  const users = {
    admin: `wg18-admin-${run}`,
    lead: `wg18-lead-${run}`,
    buyer: `wg18-buyer-${run}`,
    outsider: `wg18-out-${run}`,
    adminB: `wg18-admin-b-${run}`,
    supplier: `wg18-sup-${run}`,
  };
  const impact = defaultSegmentCriteria.filter((c) => c.axis === 'impact').map((c) => c.key);
  const quality = defaultSegmentCriteria.filter((c) => c.axis === 'quality').map((c) => c.key);
  const typeName = (i: number, q: number) =>
    defaultSegmentTypes.find((t) => t.impactLevel === i && t.qualityLevel === q)?.name;

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
  const overview = async (group: string, user = users.lead) =>
    categorySegmentationSchema.parse(
      (await call(user, 'GET', `/warengruppen/${group}/segmentierung`)).body,
    );
  const row = async (group: string, relationshipId: string) =>
    (await overview(group)).suppliers.find((entry) => entry.relationshipId === relationshipId);
  // Werte: Spend hoch, übrige Wirkung null, Qualität mittel. Mit gleichen Gewichten ist die
  // Wirkung niedrig; liegt das Gewicht auf Spend, wird sie mittel.
  const values = () => [
    ...impact.map((key) => ({ key, ist: key === 'spend' ? 100 : 0 })),
    ...quality.map((key) => ({ key, ist: 50 })),
  ];
  const rate = async (assignmentIds: string[]) => {
    for (const assignmentId of assignmentIds) {
      const [assignment] = await db
        .select()
        .from(schema.ratingAssignment)
        .where(sql`${schema.ratingAssignment.id} = ${assignmentId}`);
      if (!assignment) throw new Error('Zuordnung fehlt');
      await db.insert(schema.rating).values(
        values().map((value) => ({
          assignmentId,
          relationshipId: assignment.relationshipId,
          criterionKey: value.key,
          modelVersion: 1,
          ist: value.ist,
          soll: value.ist,
          submittedAt: new Date(),
        })),
      );
      await db
        .update(schema.ratingAssignment)
        .set({ status: 'submitted' })
        .where(sql`${schema.ratingAssignment.id} = ${assignmentId}`);
    }
  };
  const categoryAssignments = async (group: string) =>
    db
      .select({ id: schema.ratingAssignment.id, rater: schema.ratingAssignment.raterUserId })
      .from(schema.ratingAssignment)
      .innerJoin(
        schema.segmentationRound,
        sql`${schema.segmentationRound.id} = ${schema.ratingAssignment.roundId}`,
      )
      .where(sql`${schema.segmentationRound.materialGroupId} = ${group}`);

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `WG18-A ${run}` },
      { id: orgs.b, name: `WG18-B ${run}` },
      { id: orgs.s1, name: `WG18-Rheintal ${run}` },
      { id: orgs.s2, name: `WG18-Mosel ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.a, feature: 'buyer' },
      { organizationId: orgs.b, feature: 'buyer' },
    ]);
    const person = (
      id: string,
      organizationId: string,
      orgRole: 'admin' | 'member',
      defaultFunction: 'purchasing' | 'quality' | null = null,
    ) => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      defaultFunction,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.admin, orgs.a, 'admin'),
        person(users.lead, orgs.a, 'member', 'purchasing'),
        person(users.buyer, orgs.a, 'member', 'quality'),
        person(users.outsider, orgs.a, 'member'),
        person(users.adminB, orgs.b, 'admin'),
        person(users.supplier, orgs.s1, 'admin'),
      ]);
    await insertRelationships(db, [
      { id: rel1, buyer: orgs.a, supplier: orgs.s1 },
      { id: rel2, buyer: orgs.a, supplier: orgs.s2 },
    ]);
    await db
      .insert(schema.businessUnit)
      .values({ id: unit, orgId: orgs.a, name: 'Antrieb', code: `A-${run}` });
    await db.insert(schema.relationshipBusinessUnit).values([
      { relationshipId: rel1, businessUnitId: unit },
      { relationshipId: rel2, businessUnitId: unit },
    ]);
    await db.insert(schema.materialGroup).values([
      {
        id: boards,
        orgId: orgs.a,
        name: 'Leiterplatten',
        code: `LP-${run}`,
        leadUserId: users.lead,
      },
      { id: castings, orgId: orgs.a, name: 'Gussteile', code: `GU-${run}`, leadUserId: users.lead },
    ]);
    await db.insert(schema.materialGroupMember).values([
      { orgId: orgs.a, materialGroupId: boards, userId: users.lead, role: 'lead' },
      { orgId: orgs.a, materialGroupId: boards, userId: users.buyer, role: 'buyer' },
      { orgId: orgs.a, materialGroupId: castings, userId: users.lead, role: 'lead' },
    ]);
    // Spend je Warengruppe; die Zuordnung zur Warengruppe entsteht daraus (WG-01).
    await db.insert(schema.relationshipSpend).values([
      { relationshipId: rel1, year, amountCents: 3_000_000, materialGroupId: boards },
      { relationshipId: rel1, year, amountCents: 7_000_000, materialGroupId: castings },
      { relationshipId: rel2, year, amountCents: 1_000_000, materialGroupId: boards },
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
    if (!model) throw new Error('Modell fehlt');
    modelId = model.id;
    await db
      .insert(schema.segmentCriterion)
      .values(defaultSegmentCriteria.map((criterion) => ({ ...criterion, modelId })));
    await db
      .insert(schema.segmentType)
      .values(defaultSegmentTypes.map((type) => ({ ...type, modelId })));
    // Eine Portfolio-Runde für rel1 mit denselben Werten (SEG-03)
    await db.insert(schema.segmentationRound).values({
      id: portfolioRound,
      orgId: orgs.a,
      name: 'Portfolio',
      dueDate: '2099-12-31',
      status: 'open',
      modelVersion: 1,
      createdBy: users.admin,
    });
    const [portfolioAssignment] = await db
      .insert(schema.ratingAssignment)
      .values({
        roundId: portfolioRound,
        relationshipId: rel1,
        businessUnitId: unit,
        function: 'purchasing',
        raterUserId: users.admin,
      })
      .returning({ id: schema.ratingAssignment.id });
    await rate([portfolioAssignment?.id ?? '']);
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from segment_type where model_id = ${modelId}`);
    await db.execute(sql`delete from segment_criterion where model_id = ${modelId}`);
    await db.execute(sql`delete from segment_model where org_id in ${orgIds}`);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('der Lead startet die Runde: Lieferanten der Warengruppe vornominiert, das Team bewertet', async () => {
    const before = await overview(boards);
    expect(before.canManage).toBe(true);
    expect(before.round).toBeNull();
    expect(before.suppliers.map((entry) => entry.relationshipId).sort()).toEqual(
      [rel1, rel2].sort(),
    );
    expect(before.suppliers.find((entry) => entry.relationshipId === rel1)?.spendCents).toBe(
      3_000_000,
    );
    expect(before.raters.map((entry) => entry.userId).sort()).toEqual(
      [users.lead, users.buyer].sort(),
    );

    // Nur Lead, Commodity Manager und Admin starten.
    const outsider = await call(users.outsider, 'POST', `/warengruppen/${boards}/runden`, {
      dueDate: '2099-06-30',
      relationshipIds: [rel1],
    });
    expect(outsider.status).toBe(403);
    expect((await overview(boards, users.outsider)).canManage).toBe(false);

    const started = await call(users.lead, 'POST', `/warengruppen/${boards}/runden`, {
      dueDate: '2099-06-30',
      relationshipIds: [rel1, rel2],
    });
    expect(started.status).toBe(201);
    const after = categorySegmentationSchema.parse(started.body);
    expect(after.round).toMatchObject({ status: 'open', submitted: 0, total: 4 });
    const again = await call(users.lead, 'POST', `/warengruppen/${boards}/runden`, {
      dueDate: '2099-06-30',
      relationshipIds: [rel1],
    });
    expect(again.status).toBe(409);

    // Die Bewertung nennt die Warengruppe.
    const mine = ratingAssignmentListSchema.parse(
      (await call(users.buyer, 'GET', '/ratings/mine')).body,
    );
    expect(mine.assignments).toHaveLength(2);
    expect(mine.assignments.every((entry) => entry.materialGroup?.name === 'Leiterplatten')).toBe(
      true,
    );
  });

  it('dieselben Kriterien und Gewichte wie die Portfolio-Runde; eine Änderung wirkt in beiden', async () => {
    await rate((await categoryAssignments(boards)).map((entry) => entry.id));
    const portfolio = async () =>
      segmentationSchema.parse(
        (await call(users.admin, 'GET', `/ratings/relationship/${rel1}/segmentation`)).body,
      ).segmentation;
    const category = async () => (await row(boards, rel1))?.suggestion;

    // Die Portfolio-Sicht liest nur die Portfolio-Runde.
    expect((await portfolio())?.roundId).toBe(portfolioRound);
    expect((await category())?.ist.impactLevel).toBe(1);
    expect((await portfolio())?.overall.ist?.impactLevel).toBe(1);

    await db.execute(
      sql`update segment_criterion set weight = case when key = 'spend' then 50 else 10 end
          where model_id = ${modelId} and axis = 'impact'`,
    );
    expect((await category())?.ist.impactLevel).toBe(2);
    expect((await portfolio())?.overall.ist?.impactLevel).toBe(2);
    expect((await category())?.ist.typeName).toBe((await portfolio())?.overall.ist?.typeName);
  });

  it('ein Lieferant in zwei Warengruppen hat zwei Segmente und ein drittes als Gesamtentscheidung', async () => {
    const decide = (group: string, ist: [number, number], soll: [number, number]) =>
      call(users.lead, 'POST', `/warengruppen/${group}/segmente/${rel1}`, {
        ist: { impactLevel: ist[0], qualityLevel: ist[1] },
        soll: { impactLevel: soll[0], qualityLevel: soll[1] },
        reason: 'Im Team besprochen',
      });
    expect((await decide(boards, [2, 2], [3, 3])).status).toBe(201);
    expect((await decide(castings, [1, 3], [1, 3])).status).toBe(201);
    // Gesamtentscheidung wie in SEG-06
    const total = await call(users.admin, 'POST', `/ratings/relationship/${rel1}/decisions`, {
      total: {
        ist: { impactLevel: 3, qualityLevel: 1 },
        soll: { impactLevel: 3, qualityLevel: 2 },
        reason: 'Gesamtbild',
      },
      entries: [
        {
          businessUnitId: unit,
          materialGroupId: null,
          ist: { impactLevel: 3, qualityLevel: 1 },
          soll: { impactLevel: 3, qualityLevel: 2 },
          reason: 'Gesamtbild',
        },
      ],
    });
    expect(total.status).toBe(200);

    const inBoards = await row(boards, rel1);
    expect(inBoards?.decision).toMatchObject({
      ist: { impactLevel: 2, qualityLevel: 2, typeName: typeName(2, 2) },
      origin: 'round',
      version: 1,
    });
    expect(inBoards?.overall?.ist.typeName).toBe(typeName(3, 1));
    // Ohne Runde in Gussteile ist die Entscheidung manuell.
    expect((await row(castings, rel1))?.decision).toMatchObject({
      ist: { impactLevel: 1, qualityLevel: 3 },
      origin: 'manual',
    });
    // Eine neue Entscheidung ist eine neue Version; es gilt die jüngste.
    await decide(boards, [2, 3], [3, 3]);
    expect((await row(boards, rel1))?.decision).toMatchObject({
      ist: { impactLevel: 2, qualityLevel: 3 },
      version: 2,
    });
    // Die Historie aus SEG-06 kennt nur die Gesamtentscheidung.
    const history = (await call(users.admin, 'GET', `/ratings/relationship/${rel1}/decisions`))
      .body as { versions: { entries: { scope: string }[] }[] };
    expect(history.versions).toHaveLength(1);
    expect(history.versions[0]?.entries.map((entry) => entry.scope).sort()).toEqual([
      'bu_mg',
      'total',
    ]);
  });

  it('nirgends erscheint ein Segment außerhalb der eingestellten Segmente', async () => {
    const response = await call(users.lead, 'POST', `/warengruppen/${boards}/segmente/${rel2}`, {
      ist: { impactLevel: 4, qualityLevel: 1 },
      soll: { impactLevel: 1, qualityLevel: 1 },
      reason: 'x',
    });
    expect(response.status).toBe(400);
    await db.execute(
      sql`delete from segment_type where model_id = ${modelId} and impact_level = 1 and quality_level = 1`,
    );
    const unknown = await call(users.lead, 'POST', `/warengruppen/${boards}/segmente/${rel2}`, {
      ist: { impactLevel: 1, qualityLevel: 1 },
      soll: { impactLevel: 1, qualityLevel: 1 },
      reason: 'x',
    });
    expect(unknown.body).toMatchObject({ code: 'segment_unknown' });
    const type = defaultSegmentTypes.find((t) => t.impactLevel === 1 && t.qualityLevel === 1);
    if (type) await db.insert(schema.segmentType).values({ ...type, modelId });

    const allowed = new Set(defaultSegmentTypes.map((t) => t.name));
    const seen = await overview(boards);
    const names = [
      ...seen.types.map((t) => t.name),
      ...seen.suppliers.flatMap((s) => [
        s.decision?.ist.typeName,
        s.decision?.soll.typeName,
        s.suggestion?.ist.typeName,
        s.suggestion?.soll.typeName,
        s.overall?.ist.typeName,
      ]),
    ].filter((name): name is string => Boolean(name));
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((name) => allowed.has(name))).toBe(true);
  });

  it('der Filter ändert Matrix, Soll und „Spend nach Segment“', async () => {
    const matrix = async (query = '') =>
      portfolioMatrixSchema.parse(
        (await call(users.admin, 'GET', `/portfolio/matrix${query}`)).body,
      );
    const total = (await matrix()).points.find((p) => p.relationshipId === rel1);
    const inBoards = (await matrix(`?materialGroupId=${boards}`)).points.find(
      (p) => p.relationshipId === rel1,
    );
    const inCastings = (await matrix(`?materialGroupId=${castings}`)).points.find(
      (p) => p.relationshipId === rel1,
    );
    expect(total).toMatchObject({ ist: { impactLevel: 3, qualityLevel: 1 } });
    expect(inBoards).toMatchObject({
      ist: { impactLevel: 2, qualityLevel: 3 },
      soll: { impactLevel: 3, qualityLevel: 3 },
      spendCents: 3_000_000,
      materialGroup: { id: boards, name: 'Leiterplatten' },
    });
    expect(inCastings).toMatchObject({
      ist: { impactLevel: 1, qualityLevel: 3 },
      soll: { impactLevel: 1, qualityLevel: 3 },
      spendCents: 7_000_000,
    });
  });

  it('„Zu klären“ zeigt Lieferanten, deren Gesamtentscheidung älter ist als eine in der Warengruppe', async () => {
    const open = async () =>
      portfolioOpenSchema.parse((await call(users.admin, 'GET', '/portfolio/open')).body).groups
        .category_newer;
    // Die Gesamtentscheidung kam nach Leiterplatten v1, aber vor v2.
    expect((await open()).map((item) => item.relationshipId)).toEqual([rel1]);
    expect((await open())[0]?.materialGroup?.name).toBe('Leiterplatten');
  });

  it('Test-Lieferant und fremder Käufer sehen weder Runde noch Segment', async () => {
    expect(
      (await call(users.supplier, 'GET', `/warengruppen/${boards}/segmentierung`)).status,
    ).toBe(403);
    expect((await call(users.supplier, 'GET', '/ratings/mine')).status).toBe(403);
    expect(
      (await call(users.supplier, 'GET', `/portfolio/matrix?materialGroupId=${boards}`)).status,
    ).toBe(403);
    expect((await call(users.adminB, 'GET', `/warengruppen/${boards}/segmentierung`)).status).toBe(
      404,
    );
    expect(
      (
        await call(users.adminB, 'POST', `/warengruppen/${boards}/segmente/${rel1}`, {
          ist: { impactLevel: 1, qualityLevel: 1 },
          soll: { impactLevel: 1, qualityLevel: 1 },
          reason: 'x',
        })
      ).status,
    ).toBe(404);
  });
});
