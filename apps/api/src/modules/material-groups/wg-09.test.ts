import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  lastFullYear,
  marketAnalysisSchema,
  marketForceKeys,
  strategyContextResponseSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { TestDraftModel } from '../ai-drafts/draft-model.js';

// Tests zu docs/specs/WG-09.md (Marktanalyse), je Kriterium aus „Fertig, wenn“.
describe('WG-09 Marktanalyse', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), b: randomUUID(), s1: randomUUID() };
  const group = randomUUID();
  const manualGroup = randomUUID();
  const rel = randomUUID();
  const users = {
    lead: `wg09-lead-${run}`,
    buyer: `wg09-buyer-${run}`,
    adminB: `wg09-admin-b-${run}`,
    supplier: `wg09-sup-${run}`,
  };
  let strategyId = '';
  let manualId = '';

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
  const market = async (id = strategyId) =>
    marketAnalysisSchema.parse(
      (await call(users.lead, 'GET', `/warengruppen/strategien/${id}/markt`)).body,
    );
  const stepState = async (groupId = group) =>
    strategyContextResponseSchema.parse(
      (await call(users.lead, 'GET', `/warengruppen/${groupId}/strategie?jahr=2031`)).body,
    ).context?.strategy.steps[4];
  const create = async (groupId: string) =>
    strategyContextResponseSchema.parse(
      (await call(users.lead, 'POST', `/warengruppen/${groupId}/strategie`, { year: 2031 })).body,
    ).context?.strategy.id as string;

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `WG09-A ${run}` },
      { id: orgs.b, name: `WG09-B ${run}` },
      { id: orgs.s1, name: `WG09-Rheintal ${run}`, country: 'DE' },
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
        person(users.lead, orgs.a, 'member'),
        person(users.buyer, orgs.a, 'member'),
        person(users.adminB, orgs.b, 'admin'),
        person(users.supplier, orgs.s1, 'admin'),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.a, supplier: orgs.s1 }]);
    await db.insert(schema.materialGroup).values([
      {
        id: group,
        orgId: orgs.a,
        name: 'Leiterplatten',
        code: `LP-${run}`,
        leadUserId: users.lead,
      },
      {
        id: manualGroup,
        orgId: orgs.a,
        name: 'Gussteile',
        code: `GU-${run}`,
        leadUserId: users.lead,
      },
    ]);
    await db.insert(schema.materialGroupMember).values([
      { orgId: orgs.a, materialGroupId: group, userId: users.lead, role: 'lead' },
      { orgId: orgs.a, materialGroupId: manualGroup, userId: users.lead, role: 'lead' },
    ]);
    await db.insert(schema.relationshipSpend).values({
      relationshipId: rel,
      year: lastFullYear(),
      amountCents: 5_000_000,
      materialGroupId: group,
    });
    strategyId = await create(group);
    manualId = await create(manualGroup);
    // Grundlage: eine Beobachtung aus Schritt 3 und eine zur Kostensicht, die nie an die KI geht
    for (const [view, text] of [
      ['volume', 'Zwei Produktgruppen tragen zwei Drittel des Umsatzes.'],
      ['cost', 'GEHEIM Material ist 9 % teurer als beim Wettbewerb.'],
    ]) {
      await call(users.lead, 'PUT', `/warengruppen/strategien/${strategyId}/schritte/3/notiz`, {
        view,
        text,
      });
    }
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    await db.execute(sql`delete from ai_source where org_id in ${orgIds}`);
    await db.execute(sql`delete from ai_draft where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_strategy where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_kpi where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_question where org_id in ${orgIds}`);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from objective_category where org_id in ${orgIds}`);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('ein Entwurf erzeugt sechs Zeilen im Stand Entwurf; jeder Begründungspunkt hat eine Quelle', async () => {
    const response = await call(
      users.buyer,
      'POST',
      `/warengruppen/strategien/${strategyId}/markt/entwurf`,
    );
    // Außerhalb des Teams ist der Entwurf der Strategie nicht einmal lesbar
    expect(response.status).toBe(404);
    const drafted = marketAnalysisSchema.parse(
      (await call(users.lead, 'POST', `/warengruppen/strategien/${strategyId}/markt/entwurf`)).body,
    );
    expect(drafted.forces.map((force) => force.force)).toEqual([...marketForceKeys]);
    expect(drafted.forces.every((force) => force.status === 'draft')).toBe(true);
    for (const force of drafted.forces) {
      // Der Punkt ohne gültige Quelle ist weggefallen.
      expect(force.points).toHaveLength(2);
      expect(force.points.every((point) => point.sources.length >= 1)).toBe(true);
    }
    expect(drafted.forces[0]?.points[0]?.sources[0]?.title).toBe('Interne Analyse · Volumen');
    expect(drafted.publicResearch).toBe(false);
    expect(drafted.synthesisDraft?.text).toContain('Macht der Lieferanten');
    // Die Kostensicht geht nie an die KI.
    const prompt = TestDraftModel.requests.at(-1)?.prompt ?? '';
    expect(prompt).toContain('Volumen');
    expect(prompt).not.toContain('GEHEIM');
  });

  it('Schritt 5 ist erst fertig, wenn alle sechs Kräfte bestätigt sind und die Zusammenschau steht', async () => {
    expect(await stepState()).toBe('in_progress');
    for (const force of marketForceKeys.slice(0, 5)) {
      await call(
        users.lead,
        'POST',
        `/warengruppen/strategien/${strategyId}/markt/${force}/bestaetigen`,
      );
    }
    const draft = (await market()).synthesisDraft;
    await call(
      users.lead,
      'POST',
      `/warengruppen/strategien/${strategyId}/markt/zusammenschau/${draft?.id}/uebernehmen`,
    );
    expect(await stepState()).toBe('in_progress');
    const last = await call(
      users.lead,
      'POST',
      `/warengruppen/strategien/${strategyId}/markt/rivalry/bestaetigen`,
    );
    expect(marketAnalysisSchema.parse(last.body).confirmedCount).toBe(6);
    expect(marketAnalysisSchema.parse(last.body).forces[5]?.confirmedBy).toBe(users.lead);
    expect(await stepState()).toBe('done');
  });

  it('neu recherchieren lässt bestätigte Kräfte unverändert, bis der Nutzer übernimmt', async () => {
    const before = (await market()).forces.find((force) => force.force === 'supplier_power');
    await call(users.lead, 'PUT', `/warengruppen/strategien/${strategyId}/markt/supplier_power`, {
      today: 'low',
      future: 'low',
      relevant: false,
      points: ['Von Hand angepasst.'],
    });
    const again = marketAnalysisSchema.parse(
      (await call(users.lead, 'POST', `/warengruppen/strategien/${strategyId}/markt/entwurf`)).body,
    );
    const force = again.forces.find((entry) => entry.force === 'supplier_power');
    expect(force).toMatchObject({ status: 'confirmed', today: 'low', relevant: false });
    expect(force?.points.map((point) => point.text)).toEqual(['Von Hand angepasst.']);
    expect(force?.proposal).toMatchObject({ today: 'high', relevant: true });
    expect(before?.status).toBe('confirmed');
    expect(await stepState()).toBe('done');

    const adopted = marketAnalysisSchema.parse(
      (
        await call(
          users.lead,
          'POST',
          `/warengruppen/strategien/${strategyId}/markt/supplier_power/vorschlag/uebernehmen`,
        )
      ).body,
    );
    expect(adopted.forces[0]).toMatchObject({ status: 'confirmed', today: 'high', proposal: null });
  });

  it('mit abgeschalteter KI lässt sich der Schritt von Hand abschließen', async () => {
    for (const force of marketForceKeys) {
      const saved = await call(
        users.lead,
        'PUT',
        `/warengruppen/strategien/${manualId}/markt/${force}`,
        {
          today: 'high',
          future: 'low',
          relevant: true,
          points: ['Von Hand eingeschätzt.', 'Zweiter Punkt.'],
        },
      );
      expect(saved.status).toBe(200);
    }
    expect(
      (
        await call(users.lead, 'PUT', `/warengruppen/strategien/${manualId}/markt/rivalry`, {
          today: 'high',
          future: 'low',
          relevant: true,
          points: [],
        })
      ).status,
    ).toBe(400);
    await call(users.lead, 'PUT', `/warengruppen/strategien/${manualId}/schritte/5/notiz`, {
      text: 'Die Lieferanten haben die Macht; wir bündeln, um sie auszugleichen.',
    });
    expect((await market(manualId)).researchedAt).toBeNull();
    expect(await stepState(manualGroup)).toBe('done');
  });

  it('der Test-Lieferant und ein fremder Käufer sehen keine Marktanalyse', async () => {
    const path = `/warengruppen/strategien/${strategyId}/markt`;
    expect((await call(users.supplier, 'GET', path)).status).toBe(403);
    expect((await call(users.adminB, 'GET', path)).status).toBe(404);
    expect((await call(users.adminB, 'POST', `${path}/entwurf`)).status).toBe(404);
  });
});
