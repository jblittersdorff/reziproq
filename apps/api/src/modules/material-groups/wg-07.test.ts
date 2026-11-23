import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  analysisStepSchema,
  dueListSchema,
  lastFullYear,
  strategyContextResponseSchema,
  strategyStepSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/WG-07.md (Analysen), je Kriterium aus „Fertig, wenn“.
describe('WG-07 Analysen', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), b: randomUUID(), s1: randomUUID(), s2: randomUUID() };
  const group = randomUUID();
  const unit = randomUUID();
  const rel1 = randomUUID();
  const rel2 = randomUUID();
  const year = lastFullYear();
  const users = {
    admin: `wg07-admin-${run}`,
    lead: `wg07-lead-${run}`,
    buyer: `wg07-buyer-${run}`,
    reader: `wg07-reader-${run}`,
    fn: `wg07-fn-${run}`,
    adminB: `wg07-admin-b-${run}`,
    supplier: `wg07-sup-${run}`,
  };
  const productGroups = Array.from({ length: 12 }, () => randomUUID());
  // Je Produktgruppe ein weiterer Lieferant: Spend kennt je Lieferant, Jahr, BU und Warengruppe eine Zeile.
  const extra = Array.from({ length: 10 }, () => ({ org: randomUUID(), id: randomUUID() }));
  let strategyId = '';

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
  const analyses = async (step: 3 | 4, user = users.lead) =>
    analysisStepSchema.parse(
      (await call(user, 'GET', `/warengruppen/strategien/${strategyId}/schritte/${step}/analysen`))
        .body,
    );
  const states = async () =>
    strategyContextResponseSchema.parse(
      (await call(users.lead, 'GET', `/warengruppen/${group}/strategie?jahr=2031`)).body,
    ).context?.strategy.steps ?? [];
  const note = (step: number, view: string, text: string, notApplicable = false) =>
    call(users.buyer, 'PUT', `/warengruppen/strategien/${strategyId}/schritte/${step}/notiz`, {
      view,
      text,
      notApplicable,
    });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `WG07-A ${run}` },
      { id: orgs.b, name: `WG07-B ${run}` },
      { id: orgs.s1, name: `WG07-Rheintal ${run}`, country: 'DE' },
      { id: orgs.s2, name: `WG07-Moldau ${run}`, country: 'CZ' },
      ...extra.map((entry, n) => ({
        id: entry.org,
        name: `WG07-Extra ${n} ${run}`,
        country: 'PL',
      })),
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.a, feature: 'buyer' },
      { organizationId: orgs.b, feature: 'buyer' },
    ]);
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
        person(users.admin, orgs.a, 'admin'),
        person(users.lead, orgs.a, 'member'),
        person(users.buyer, orgs.a, 'member'),
        person(users.reader, orgs.a, 'member'),
        person(users.fn, orgs.a, 'member'),
        person(users.adminB, orgs.b, 'admin'),
        person(users.supplier, orgs.s1, 'admin'),
      ]);
    await insertRelationships(db, [
      { id: rel1, buyer: orgs.a, supplier: orgs.s1 },
      { id: rel2, buyer: orgs.a, supplier: orgs.s2 },
      ...extra.map((entry) => ({ id: entry.id, buyer: orgs.a, supplier: entry.org })),
    ]);
    await db
      .insert(schema.businessUnit)
      .values({ id: unit, orgId: orgs.a, name: 'Antriebe', code: `A-${run}` });
    await db.insert(schema.relationshipBusinessUnit).values([
      { relationshipId: rel1, businessUnitId: unit },
      { relationshipId: rel2, businessUnitId: unit },
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
      { orgId: orgs.a, materialGroupId: group, userId: users.fn, role: 'function' },
    ]);
    await db.insert(schema.materialGroupProductGroup).values(
      productGroups.map((id, n) => ({
        id,
        orgId: orgs.a,
        materialGroupId: group,
        name: `PG ${String(n).padStart(2, '0')}`,
        position: n + 1,
      })),
    );
    // Spend je Produktgruppe: PG 00 46 %, PG 01 22 %, PG 02 15 %, dann kleine
    const amounts = [46, 22, 15, 5, 4, 3, 2, 1, 1, 0.5, 0.3, 0.2];
    await db.insert(schema.relationshipSpend).values(
      amounts.map((pct, n) => ({
        relationshipId: n === 0 ? rel1 : n === 1 ? rel2 : (extra[n - 2]?.id as string),
        year,
        amountCents: Math.round(pct * 1_000_000),
        materialGroupId: group,
        productGroupId: productGroups[n] as string,
        businessUnitId: n === 0 ? unit : null,
      })),
    );
    const created = await call(users.lead, 'POST', `/warengruppen/${group}/strategie`, {
      year: 2031,
    });
    strategyId = strategyContextResponseSchema.parse(created.body).context?.strategy.id as string;
  });

  afterAll(async () => {
    const orgIds = [...Object.values(orgs), ...extra.map((entry) => entry.org)];
    await db.execute(sql`delete from material_group_strategy where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_kpi where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_question where org_id in ${orgIds}`);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from objective_category where org_id in ${orgIds}`);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(
      sql`delete from organization where id in ${orgIds} or name like ${`WG07-Kandidat ${run}%`}`,
    );
    await testApp.close();
  });

  it('die Volumensicht zeigt die Produktgruppen mit den obersten 80 % des Umsatzes, höchstens zehn', async () => {
    const step = await analyses(3);
    expect(step.views.map((view) => view.view)).toEqual([
      'volume',
      'supply_chain',
      'cost',
      'technology',
    ]);
    expect(step.computed.productGroups.map((entry) => entry.name)).toEqual([
      'PG 00',
      'PG 01',
      'PG 02',
    ]);
    expect(step.computed.productGroupRestShare).toBeCloseTo(0.17, 2);
    expect(
      step.computed.byBusinessUnit.find((entry) => entry.businessUnit?.id === unit),
    ).toBeTruthy();
  });

  it('eine Sicht ohne Beobachtung ist nicht fertig; nicht anwendbar mit Begründung schon', async () => {
    const saved = await call(
      users.buyer,
      'PUT',
      `/warengruppen/strategien/${strategyId}/analysen/supply_chain`,
      {
        data: { stages: [{ name: 'Laminat', description: '', valueSharePct: 30 }], countries: [] },
      },
    );
    expect(saved.status).toBe(200);
    const view = (await analyses(3)).views.find((entry) => entry.view === 'supply_chain');
    expect(view?.state).toBe('in_progress');
    expect((await states())[2]).toBe('in_progress');

    expect((await note(3, 'supply_chain', '', true)).status).toBe(400);
    await note(
      3,
      'supply_chain',
      'Wir kennen nur Stufe 1; mehr liefern die Lieferanten nicht.',
      true,
    );
    await note(3, 'volume', 'Zwei Produktgruppen tragen zwei Drittel des Umsatzes.');
    await note(3, 'cost', 'Material dominiert.');
    const after = await analyses(3);
    expect(after.views.find((entry) => entry.view === 'supply_chain')?.state).toBe('done');
    expect((await states())[2]).toBe('in_progress');
    await note(3, 'technology', 'Ultra-HDI ab 2027.');
    expect((await states())[2]).toBe('done');
  });

  it('Schritt 4 ist erst fertig, wenn alle drei Sichten fertig sind und die Runde entschieden ist', async () => {
    for (const view of ['revenue_finance', 'quality', 'footprint']) {
      await note(4, view, `Beobachtung ${view}`);
    }
    expect((await states())[3]).toBe('in_progress');
    const roundId = randomUUID();
    await db.insert(schema.segmentationRound).values({
      id: roundId,
      orgId: orgs.a,
      name: 'Segmentierung Leiterplatten',
      dueDate: '2099-12-31',
      status: 'open',
      scope: 'category',
      materialGroupId: group,
      modelVersion: 1,
      createdBy: users.lead,
    });
    await db.insert(schema.ratingAssignment).values({
      roundId,
      relationshipId: rel1,
      businessUnitId: unit,
      materialGroupId: group,
      function: 'purchasing',
      raterUserId: users.buyer,
    });
    expect((await analyses(4)).round).toEqual({ exists: true, decided: false });
    expect((await states())[3]).toBe('in_progress');
    await db.insert(schema.segmentDecision).values({
      relationshipId: rel1,
      scope: 'category',
      materialGroupId: group,
      istImpactLevel: 2,
      istQualityLevel: 2,
      sollImpactLevel: 3,
      sollQualityLevel: 3,
      reason: 'Im Team',
      modelVersion: 1,
      decidedBy: users.lead,
      version: 1,
    });
    expect((await analyses(4)).round).toEqual({ exists: true, decided: true });
    expect((await states())[3]).toBe('done');
  });

  it('ein Käufer außerhalb des Teams erhält die Kostensicht nicht, auch nicht nach der Freigabe', async () => {
    await call(users.buyer, 'PUT', `/warengruppen/strategien/${strategyId}/analysen/cost`, {
      data: { costTypes: [{ name: 'Material', own: 100, target: 98.5, market: 91 }] },
    });
    expect((await analyses(3)).views.some((view) => view.view === 'cost')).toBe(true);
    // Entwurf: außerhalb des Teams gar nicht lesbar
    expect(
      (
        await call(
          users.reader,
          'GET',
          `/warengruppen/strategien/${strategyId}/schritte/3/analysen`,
        )
      ).status,
    ).toBe(404);
    await db
      .update(schema.materialGroupStrategy)
      .set({ status: 'approved' })
      .where(sql`${schema.materialGroupStrategy.id} = ${strategyId}`);
    const outside = await analyses(3, users.reader);
    expect(outside.views.map((view) => view.view)).toEqual([
      'volume',
      'supply_chain',
      'technology',
    ]);
    expect(JSON.stringify(outside)).not.toContain('98.5');
    const step = strategyStepSchema.parse(
      (await call(users.reader, 'GET', `/warengruppen/strategien/${strategyId}/schritte/3`)).body,
    );
    expect(step.notes.some((entry) => entry.view === 'cost')).toBe(false);
    await db
      .update(schema.materialGroupStrategy)
      .set({ status: 'draft' })
      .where(sql`${schema.materialGroupStrategy.id} = ${strategyId}`);
  });

  it('Schritt 24: die Funktion sieht keine Kosten und kommentiert nur zugewiesene Sichten', async () => {
    const base = `/warengruppen/strategien/${strategyId}/analysen`;
    const own = await analyses(3, users.fn);
    expect(own.views.map((view) => view.view)).not.toContain('cost');
    expect(JSON.stringify(own)).not.toContain('98.5');
    expect(own.views.every((view) => !view.canComment)).toBe(true);
    expect(
      (await call(users.fn, 'POST', `${base}/volume/kommentare`, { body: 'Hallo' })).status,
    ).toBe(403);
    // Zuweisen dürfen Lead, Commodity Manager und Admin; nie die Kostensicht, nur an die Funktion
    expect(
      (await call(users.buyer, 'PUT', `${base}/volume/zuweisung`, { userIds: [users.fn] })).status,
    ).toBe(403);
    expect(
      (await call(users.lead, 'PUT', `${base}/cost/zuweisung`, { userIds: [users.fn] })).status,
    ).toBe(400);
    expect(
      (await call(users.lead, 'PUT', `${base}/volume/zuweisung`, { userIds: [users.buyer] }))
        .status,
    ).toBe(400);
    const assigned = analysisStepSchema.parse(
      (await call(users.lead, 'PUT', `${base}/volume/zuweisung`, { userIds: [users.fn] })).body,
    );
    expect(assigned.canAssign).toBe(true);
    expect(assigned.functionMembers.map((entry) => entry.userId)).toEqual([users.fn]);
    expect(assigned.views.find((view) => view.view === 'volume')?.assignees).toEqual([
      { userId: users.fn, name: users.fn },
    ]);
    // Aufgabe in Mein Tag, bis die Person kommentiert hat
    const due = async () =>
      dueListSchema
        .parse((await call(users.fn, 'GET', '/start/due')).body)
        .items.filter((item) => item.kind === 'view_assignment');
    expect(await due()).toEqual([
      expect.objectContaining({ detail: 'volume', href: `/warengruppen/${group}/strategie/3` }),
    ]);
    const after = analysisStepSchema.parse(
      (
        await call(users.fn, 'POST', `${base}/volume/kommentare`, {
          body: 'Die Prüftechnik fehlt in der Volumensicht.',
        })
      ).body,
    );
    expect(after.views.find((view) => view.view === 'volume')?.comments).toEqual([
      expect.objectContaining({ body: 'Die Prüftechnik fehlt in der Volumensicht.', own: true }),
    ]);
    expect(await due()).toEqual([]);
    expect(
      (await call(users.fn, 'POST', `${base}/technology/kommentare`, { body: 'Nicht zugewiesen' }))
        .status,
    ).toBe(403);
    // Das Team liest den Kommentar, Lead antwortet
    const lead = await analyses(3);
    expect(lead.views.find((view) => view.view === 'volume')?.comments[0]?.own).toBe(false);
    expect(
      (await call(users.lead, 'POST', `${base}/volume/kommentare`, { body: 'Danke, ergänze ich.' }))
        .status,
    ).toBe(201);
  });

  it('das Schema der Kostensicht lehnt ein Lieferantenfeld ab, auch in der Datenbank', async () => {
    const response = await call(
      users.buyer,
      'PUT',
      `/warengruppen/strategien/${strategyId}/analysen/cost`,
      {
        data: {
          costTypes: [{ name: 'Material', own: 100, target: 98, market: 91, relationshipId: rel1 }],
        },
      },
    );
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'invalid_analysis' });
    await expect(
      db
        .insert(schema.materialGroupAnalysis)
        .values({
          orgId: orgs.a,
          strategyId,
          view: 'cost',
          data: { costTypes: [{ name: 'Material', supplierName: 'Rheintal' }] },
          updatedBy: users.lead,
        })
        .onConflictDoUpdate({
          target: [schema.materialGroupAnalysis.strategyId, schema.materialGroupAnalysis.view],
          set: { data: { costTypes: [{ name: 'Material', supplierName: 'Rheintal' }] } },
        }),
    ).rejects.toThrow();
  });

  it('ein weiterer verfügbarer Lieferant wird mit einem Klick als Lieferant im Entwurf angelegt', async () => {
    const added = analysisStepSchema.parse(
      (
        await call(users.buyer, 'POST', `/warengruppen/strategien/${strategyId}/kandidaten`, {
          name: `WG07-Kandidat ${run}`,
          site: 'Brno',
          country: 'CZ',
          revenueCents: 120_000_000,
          comment: 'Will die Warengruppe anbieten',
        })
      ).body,
    );
    const candidate = added.candidates[0];
    expect(candidate).toMatchObject({ site: 'Brno', isSupplier: false });
    const created = await call(
      users.buyer,
      'POST',
      `/warengruppen/strategien/${strategyId}/kandidaten/${candidate?.id}/lieferant`,
    );
    expect(created.status).toBe(201);
    const { relationshipId, step } = created.body as { relationshipId: string; step: unknown };
    expect(analysisStepSchema.parse(step).candidates[0]?.isSupplier).toBe(true);
    const [relationship] = await db
      .select({ status: schema.relationship.status })
      .from(schema.relationship)
      .where(sql`${schema.relationship.id} = ${relationshipId}`);
    expect(relationship?.status).toBe('draft');
    expect(
      (
        await call(
          users.buyer,
          'POST',
          `/warengruppen/strategien/${strategyId}/kandidaten/${candidate?.id}/lieferant`,
        )
      ).status,
    ).toBe(409);
  });

  it('der Test-Lieferant und ein fremder Käufer sehen keine Analyse', async () => {
    const path = `/warengruppen/strategien/${strategyId}/schritte/3/analysen`;
    expect((await call(users.supplier, 'GET', path)).status).toBe(403);
    expect((await call(users.adminB, 'GET', path)).status).toBe(404);
    expect(
      (
        await call(users.adminB, 'PUT', `/warengruppen/strategien/${strategyId}/analysen/volume`, {
          data: {},
        })
      ).status,
    ).toBe(404);
  });
});
