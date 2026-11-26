import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import {
  categoryReviewSchema,
  categoryScorecardSchema,
  dueListSchema,
  kpiListSchema,
  strategyContextResponseSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { ScorecardService } from './scorecard.service.js';
import { insertWorkItems } from '../../testing/work-items.js';

// Tests zu docs/specs/WG-12.md (Scorecard und Review), je Kriterium aus „Fertig, wenn“.
describe('WG-12 Scorecard und Review', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), s1: randomUUID(), s2: randomUUID() };
  const group = randomUUID();
  const rel = { inGroup: randomUUID(), outside: randomUUID() };
  const jbp = { inGroup: randomUUID(), outside: randomUUID() };
  const users = {
    lead: `wg12-lead-${run}`,
    buyer: `wg12-buyer-${run}`,
    owner: `wg12-owner-${run}`,
    supplier: `wg12-sup-${run}`,
  };
  let strategyId = '';
  let goalId = '';
  const choices: string[] = [];

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
  const base = () => `/warengruppen/strategien/${strategyId}`;
  const stepState = async () =>
    strategyContextResponseSchema.parse(
      (await call(users.lead, 'GET', `/warengruppen/${group}/strategie?jahr=2031`)).body,
    ).context?.strategy.steps[6];
  const complete = (leverChoiceId: string, name: string) => ({
    goalId,
    leverChoiceId,
    name,
    effect: 'Zweite Quelle für Starrflex',
    target: 2,
    ownerUserId: users.owner,
    targetQuarter: 4,
    targetYear: 2031,
    supplierIds: [rel.inGroup],
  });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `WG12-A ${run}` },
      { id: orgs.s1, name: `WG12-Rheintal ${run}` },
      { id: orgs.s2, name: `WG12-Fremd ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.a, feature: 'buyer' });
    const person = (id: string, organizationId: string, orgRole: 'admin' | 'member') => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.lead, orgs.a, 'member'),
        person(users.buyer, orgs.a, 'member'),
        person(users.owner, orgs.a, 'member'),
        person(users.supplier, orgs.s1, 'admin'),
      ]);
    await insertRelationships(db, [
      { id: rel.inGroup, buyer: orgs.a, supplier: orgs.s1 },
      { id: rel.outside, buyer: orgs.a, supplier: orgs.s2 },
    ]);
    await db.insert(schema.materialGroup).values({
      id: group,
      orgId: orgs.a,
      name: 'Leiterplatten',
      code: `LP-${run}`,
      leadUserId: users.lead,
    });
    await db.insert(schema.materialGroupMember).values([
      { orgId: orgs.a, materialGroupId: group, userId: users.lead, role: 'lead' },
      { orgId: orgs.a, materialGroupId: group, userId: users.buyer, role: 'buyer' },
    ]);
    await db
      .insert(schema.relationshipMaterialGroup)
      .values({ relationshipId: rel.inGroup, materialGroupId: group, isPrimary: true });
    strategyId = strategyContextResponseSchema.parse(
      (await call(users.lead, 'POST', `/warengruppen/${group}/strategie`, { year: 2031 })).body,
    ).context?.strategy.id as string;
    // Ziel (WG-06), Profil und zwei gewählte Hebel (WG-10)
    const kpi = kpiListSchema
      .parse((await call(users.lead, 'GET', '/warengruppen/kennzahlen')).body)
      .kpis.find((entry) => entry.dimension === 'supply');
    await call(users.lead, 'POST', `${base()}/ziele`, {
      kpiId: kpi?.id,
      text: 'Zwei Quellen je Technologie',
    });
    const [goal] = (
      await db.execute<{ id: string }>(
        sql`select id from material_group_goal where strategy_id = ${strategyId}`,
      )
    ).rows;
    goalId = goal?.id as string;
    const item = async (type: 'strength' | 'threat' | 'opportunity', code: string) =>
      (
        await db
          .insert(schema.materialGroupSwotItem)
          .values({ orgId: orgs.a, strategyId, type, code, text: code, status: 'confirmed' })
          .returning({ id: schema.materialGroupSwotItem.id })
      )[0]?.id as string;
    const s1 = await item('strength', 'S1');
    const t1 = await item('threat', 'T1');
    const o1 = await item('opportunity', 'O1');
    const levers = (
      await db.execute<{ id: string }>(
        sql`select id from lever where org_id = ${orgs.a} order by created_at limit 2`,
      )
    ).rows;
    for (const [index, external] of [t1, o1].entries()) {
      const [row] = await db
        .insert(schema.materialGroupLeverChoice)
        .values({
          orgId: orgs.a,
          strategyId,
          internalItemId: s1,
          externalItemId: external,
          leverId: levers[index]?.id as string,
          reason: 'Begründung',
          status: 'chosen',
        })
        .returning({ id: schema.materialGroupLeverChoice.id });
      choices.push(row?.id as string);
    }
    // Zusagen und Maßnahmen: eine Beziehung in der Warengruppe, eine außerhalb
    await db.insert(schema.jbp).values([
      {
        id: jbp.inGroup,
        relationshipId: rel.inGroup,
        ownerOrgId: orgs.a,
        status: 'approved',
        createdBy: users.lead,
        createdByName: 'Lead',
      },
      {
        id: jbp.outside,
        relationshipId: rel.outside,
        ownerOrgId: orgs.a,
        status: 'approved',
        createdBy: users.lead,
        createdByName: 'Lead',
      },
    ]);
    for (const [key, title] of [
      ['inGroup', 'Lieferplan Q1 schicken'],
      ['outside', 'Fremde Zusage'],
    ] as const) {
      await db.insert(schema.commitment).values({
        relationshipId: rel[key],
        ownerOrgId: orgs.a,
        jbpId: jbp[key],
        side: 'supplier',
        title,
        ownerName: 'Kim',
        dueOn: '2031-02-01',
        createdBy: users.lead,
        createdByName: 'Lead',
      });
      await insertWorkItems(db, [
        {
          relationshipId: rel[key],
          ownerOrgId: orgs.a,
          visibility: 'internal',
          title: `Maßnahme ${title}`,
          ownerSide: 'buyer',
          ownerName: 'Lead',
          dueDate: '2031-03-01',
          sourceType: 'manual',
          createdBy: users.lead,
          createdByName: 'Lead',
        },
      ]);
    }
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    await db.execute(sql`delete from commitment where owner_org_id in ${orgIds}`);
    await db.execute(sql`delete from task where org_id in ${orgIds}`);
    await db.execute(sql`delete from commitment where owner_org_id in ${orgIds}`);
    await db.execute(sql`delete from jbp where owner_org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_strategy where org_id in ${orgIds}`);
    await db.execute(sql`delete from lever where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_kpi where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_question where org_id in ${orgIds}`);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from objective_category where org_id in ${orgIds}`);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('eine Initiative ohne Ziel oder ohne Hebelwahl wird abgelehnt', async () => {
    const { goalId: _goal, ...withoutGoal } = complete(choices[0] as string, 'Ohne Ziel');
    const missingGoal = await call(users.lead, 'POST', `${base()}/initiativen`, withoutGoal);
    expect(missingGoal).toMatchObject({ status: 400, body: { code: 'goal_required' } });
    const { leverChoiceId: _choice, ...withoutLever } = complete(
      choices[0] as string,
      'Ohne Hebel',
    );
    const missingLever = await call(users.lead, 'POST', `${base()}/initiativen`, withoutLever);
    expect(missingLever).toMatchObject({ status: 400, body: { code: 'lever_required' } });
    // Ein Lieferant außerhalb der Warengruppe ist nicht zuordenbar
    const outside = await call(users.lead, 'POST', `${base()}/initiativen`, {
      ...complete(choices[0] as string, 'Fremd'),
      supplierIds: [rel.outside],
    });
    expect(outside).toMatchObject({ status: 400, body: { code: 'supplier_not_in_group' } });
  });

  it('Schritt 7 ist fertig, wenn jeder gewählte Hebel eine Initiative mit Effekt, Verantwortung und Termin hat', async () => {
    expect(await stepState()).toBe('open');
    const first = categoryScorecardSchema.parse(
      (
        await call(
          users.buyer,
          'POST',
          `${base()}/initiativen`,
          complete(choices[0] as string, 'Zweite Quelle aufbauen'),
        )
      ).body,
    );
    expect(first.missingChoiceIds).toEqual([choices[1]]);
    expect(first.initiatives[0]).toMatchObject({
      horizon: 'short',
      suppliers: [{ relationshipId: rel.inGroup }],
    });
    expect(await stepState()).toBe('in_progress');
    // Ohne Verantwortung zählt die zweite noch nicht
    const second = await call(users.buyer, 'POST', `${base()}/initiativen`, {
      ...complete(choices[1] as string, 'Bündeln'),
      ownerUserId: null,
    });
    expect(second.status).toBe(201);
    expect(await stepState()).toBe('in_progress');
    const id = categoryScorecardSchema
      .parse(second.body)
      .initiatives.find((entry) => entry.name === 'Bündeln')?.id;
    await call(
      users.buyer,
      'PATCH',
      `${base()}/initiativen/${id}`,
      complete(choices[1] as string, 'Bündeln'),
    );
    expect(await stepState()).toBe('done');
  });

  it('die verantwortliche Person meldet Fortschritt, auch ohne Recht an der Strategie', async () => {
    const card = categoryScorecardSchema.parse(
      (await call(users.lead, 'GET', `${base()}/scorecard`)).body,
    );
    const initiative = card.initiatives[0];
    if (!initiative) throw new Error('Initiative fehlt');
    // Die Person ist nicht im Team: den Entwurf sieht sie nicht
    expect(
      (
        await call(users.owner, 'POST', `${base()}/initiativen/${initiative.id}/fortschritt`, {
          progress: 40,
        })
      ).status,
    ).toBe(404);
    await db
      .update(schema.materialGroupStrategy)
      .set({ status: 'approved', approvedAt: new Date('2031-01-10T08:00:00Z') })
      .where(sql`${schema.materialGroupStrategy.id} = ${strategyId}`);
    const reported = await call(
      users.owner,
      'POST',
      `${base()}/initiativen/${initiative.id}/fortschritt`,
      { progress: 40, actual: 1 },
    );
    expect(reported.status).toBe(201);
    expect(
      categoryScorecardSchema
        .parse(reported.body)
        .initiatives.find((entry) => entry.id === initiative.id),
    ).toMatchObject({ progress: 40, actual: 1, canReport: true });
  });

  it('drei Monate nach der Freigabe entsteht genau ein Review mit einer Aufgabe für den Lead', async () => {
    const service = testApp.app.get(ScorecardService);
    expect(await service.createDueReviews(orgs.a, new Date('2031-04-09T08:00:00Z'))).toBe(0);
    expect(await service.createDueReviews(orgs.a, new Date('2031-04-10T08:00:00Z'))).toBe(1);
    expect(await service.createDueReviews(orgs.a, new Date('2031-04-20T08:00:00Z'))).toBe(0);
    const reviews = await db.execute<{ due_on: string }>(
      sql`select due_on::text from material_group_review where strategy_id = ${strategyId}`,
    );
    expect(reviews.rows.map((row) => row.due_on)).toEqual(['2031-04-10']);
    const due = dueListSchema
      .parse((await call(users.lead, 'GET', '/start/due')).body)
      .items.filter((item) => item.kind === 'category_review');
    expect(due).toEqual([
      expect.objectContaining({ supplier: 'Leiterplatten', dueDate: '2031-04-10' }),
    ]);
    const buyerDue = dueListSchema
      .parse((await call(users.buyer, 'GET', '/start/due')).body)
      .items.filter((item) => item.kind === 'category_review');
    expect(buyerDue).toEqual([]);
  });

  it('das Review zeigt nur Zusagen und Maßnahmen von Lieferanten dieser Warengruppe', async () => {
    const [row] = (
      await db.execute<{ id: string }>(
        sql`select id from material_group_review where strategy_id = ${strategyId}`,
      )
    ).rows;
    const reviewId = row?.id as string;
    const review = categoryReviewSchema.parse(
      (await call(users.lead, 'GET', `/warengruppen/reviews/${reviewId}`)).body,
    );
    expect(review.commitments.map((entry) => entry.title)).toEqual(['Lieferplan Q1 schicken']);
    expect(review.actions.map((entry) => entry.title)).toEqual(['Maßnahme Lieferplan Q1 schicken']);
    expect(review.initiatives.map((entry) => entry.progress)).toContain(40);
    expect(review.canHold).toBe(true);
    const held = categoryReviewSchema.parse(
      (
        await call(users.lead, 'POST', `/warengruppen/reviews/${reviewId}/abschliessen`, {
          summary: 'Zweite Quelle läuft an, Bündeln verschoben.',
        })
      ).body,
    );
    expect(held).toMatchObject({ canHold: false, heldBy: users.lead });
    expect(
      (
        await call(users.lead, 'POST', `/warengruppen/reviews/${reviewId}/abschliessen`, {
          summary: 'Noch einmal',
        })
      ).status,
    ).toBe(403);
  });

  it('der Test-Lieferant sieht weder Scorecard noch Review', async () => {
    expect((await call(users.supplier, 'GET', `${base()}/scorecard`)).status).toBe(403);
    const rows = await withTenant(
      db,
      { userId: users.supplier, organizationId: orgs.s1 },
      async (tx) => ({
        initiatives: await tx.execute(sql`select 1 from material_group_initiative`),
        links: await tx.execute(sql`select 1 from material_group_initiative_supplier`),
        reviews: await tx.execute(sql`select 1 from material_group_review`),
      }),
    );
    expect(rows.initiatives.rows).toHaveLength(0);
    expect(rows.links.rows).toHaveLength(0);
    expect(rows.reviews.rows).toHaveLength(0);
  });
});
