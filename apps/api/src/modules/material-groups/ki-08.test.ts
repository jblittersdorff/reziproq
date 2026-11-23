import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import {
  lastFullYear,
  marketAnalysisSchema,
  marketForceKeys,
  strategyContextResponseSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { supports } from './market.service.js';

// Tests zu docs/specs/KI-08.md (Agent Marktanalyse) mit Anbieter fake, je Kriterium ein Test.
describe('KI-08 Agent Marktanalyse', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), s1: randomUUID() };
  const group = randomUUID();
  const numbered = randomUUID();
  const rel = randomUUID();
  const users = {
    lead: `ki08-lead-${run}`,
    fn: `ki08-fn-${run}`,
    supplier: `ki08-sup-${run}`,
  };
  let strategyId = '';
  let numberedId = '';

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
  const research = async (id = strategyId) => {
    const response = await call(users.lead, 'POST', `/warengruppen/strategien/${id}/markt/entwurf`);
    expect(response.status).toBeLessThan(300);
    return marketAnalysisSchema.parse(response.body);
  };
  const setResearch = (value: boolean) =>
    db.execute(sql`
      insert into org_setting (org_id, key, value, updated_by)
      values (${orgs.a}, 'ai_public_research', ${JSON.stringify(value)}::jsonb, ${users.lead})
      on conflict (org_id, key) do update set value = excluded.value`);
  const create = async (groupId: string) =>
    strategyContextResponseSchema.parse(
      (await call(users.lead, 'POST', `/warengruppen/${groupId}/strategie`, { year: 2031 })).body,
    ).context?.strategy.id as string;

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `KI08-A ${run}` },
      { id: orgs.s1, name: `KI08-Rheintal ${run}`, country: 'DE' },
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
        person(users.fn, orgs.a, 'member'),
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
      // Der Name enthält den Spend in Euro: jede Suchfrage würde ihn nach außen tragen
      {
        id: numbered,
        orgId: orgs.a,
        name: 'Kabel 50000',
        code: `KA-${run}`,
        leadUserId: users.lead,
      },
    ]);
    await db.insert(schema.materialGroupMember).values([
      { orgId: orgs.a, materialGroupId: group, userId: users.lead, role: 'lead' },
      { orgId: orgs.a, materialGroupId: group, userId: users.fn, role: 'function' },
      { orgId: orgs.a, materialGroupId: numbered, userId: users.lead, role: 'lead' },
    ]);
    await db.insert(schema.relationshipSpend).values([
      { relationshipId: rel, year: lastFullYear(), amountCents: 7_300_000, materialGroupId: group },
      {
        relationshipId: rel,
        year: lastFullYear(),
        amountCents: 5_000_000,
        materialGroupId: numbered,
      },
    ]);
    await setResearch(true);
    strategyId = await create(group);
    numberedId = await create(numbered);
    for (const [id, view, text] of [
      [strategyId, 'volume', 'Zwei Produktgruppen tragen zwei Drittel des Umsatzes.'],
      [strategyId, 'cost', 'GEHEIM Material ist 9 % teurer als beim Wettbewerb.'],
      [numberedId, 'volume', 'Eine Produktgruppe trägt den Umsatz.'],
    ] as const) {
      await call(users.lead, 'PUT', `/warengruppen/strategien/${id}/schritte/3/notiz`, {
        view,
        text,
      });
    }
    // Bestätigte Stärke, damit ein Hebel eine Paarung bekommt (WG-10)
    await db.insert(schema.materialGroupSwotItem).values({
      orgId: orgs.a,
      strategyId,
      type: 'strength',
      code: 'S1',
      text: 'Hoher Anteil am Umsatz der Lieferanten',
      status: 'confirmed',
    });
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    await db.execute(sql`delete from ai_source where org_id in ${orgIds}`);
    await db.execute(sql`delete from ai_draft where org_id in ${orgIds}`);
    await db.execute(sql`delete from model_call where org_id in ${orgIds}`).catch(() => undefined);
    await db.execute(sql`delete from agent where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_strategy where org_id in ${orgIds}`);
    await db.execute(sql`delete from lever where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_kpi where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_question where org_id in ${orgIds}`);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from org_setting where org_id in ${orgIds}`);
    await db.execute(sql`delete from objective_category where org_id in ${orgIds}`);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('ein Lauf mit fake legt sechs Kräfte, Zusammenschau, Chancen und Risiken und Hebelvorschläge als Entwürfe an', async () => {
    const analysis = await research();
    expect(analysis.run?.status).toBe('done');
    expect(analysis.run?.steps.map((step) => [step.key, step.status])).toEqual([
      ['plan', 'done'],
      ['own_data', 'done'],
      ['public_sources', 'done'],
      ['forces', 'done'],
      ['check', 'done'],
      ['implications', 'done'],
      ['drafts', 'done'],
    ]);
    expect(analysis.forces.map((force) => force.force)).toEqual([...marketForceKeys]);
    expect(analysis.forces.every((force) => force.status === 'draft')).toBe(true);
    expect(analysis.synthesisDraft?.text).toContain('Macht der Lieferanten');
    expect(analysis.run?.created).toEqual({ forces: 6, opportunities: 1, threats: 1, levers: 2 });
    const items = await db.execute<{ type: string; status: string }>(
      sql`select type, status from material_group_swot_item where strategy_id = ${strategyId} and origin_step = 5`,
    );
    expect(items.rows.map((row) => `${row.type}:${row.status}`).sort()).toEqual([
      'opportunity:draft',
      'threat:draft',
    ]);
    const levers = await db.execute<{ status: string }>(
      sql`select status from material_group_lever_choice where strategy_id = ${strategyId}`,
    );
    expect(levers.rows.map((row) => row.status)).toEqual(['proposed', 'proposed']);
  });

  it('jede Aussage hat eine Quelle; eine Aussage, die ihre Quelle nicht stützt, fehlt und steht im Protokoll', async () => {
    const analysis = await research();
    const points = analysis.forces.flatMap((force) => force.points);
    expect(points.every((point) => point.sources.length >= 1)).toBe(true);
    expect(points.some((point) => point.text.includes('Kapazität'))).toBe(false);
    expect(analysis.run?.discardedPoints).toEqual(
      expect.arrayContaining([
        { text: 'Die Kapazität wird ab 2028 knapp.', reason: 'not_supported' },
        { text: 'Eine Aussage ohne Beleg.', reason: 'no_source' },
      ]),
    );
    // Mit Recherche trägt eine öffentliche Quelle einen Punkt
    expect(points.some((point) => point.sources.some((source) => source.kind === 'public'))).toBe(
      true,
    );
    expect(supports('Der Kupferindex sinkt.', ['Kupferindex Monatsstand'])).toBe(true);
    expect(supports('Die Kapazität wird knapp.', ['Spend der Warengruppe'])).toBe(false);
  });

  it('eine Quelle älter als 24 Monate wird verworfen', async () => {
    const analysis = await research();
    const limit = new Date();
    limit.setUTCMonth(limit.getUTCMonth() - 24);
    const from = limit.toISOString().slice(0, 10);
    expect(analysis.run?.publicSources.length).toBeGreaterThan(0);
    expect(analysis.run?.publicSources.every((source) => source.publishedOn >= from)).toBe(true);
    expect(analysis.run?.discardedSources.map((source) => source.reason)).toEqual(
      expect.arrayContaining(['too_old', 'undated']),
    );
    expect(analysis.run?.outbound.length).toBe(4);
  });

  it('eine Suchfrage mit einer Zahl aus dem Spend wird nicht gesendet', async () => {
    const analysis = await research(numberedId);
    expect(analysis.run?.blockedQueries).toBe(4);
    expect(analysis.run?.outbound).toEqual([]);
    const sent = await db.execute(
      sql`select 1 from agent_outbound_query where run_id = ${analysis.run?.id as string}`,
    );
    expect(sent.rows).toHaveLength(0);
  });

  it('ohne öffentliche Recherche entstehen Entwürfe nur mit Quellen der Art eigene Daten', async () => {
    await setResearch(false);
    const analysis = await research();
    await setResearch(true);
    expect(analysis.publicResearch).toBe(false);
    expect(analysis.run?.outbound).toEqual([]);
    const kinds = analysis.forces.flatMap((force) =>
      force.points.flatMap((point) => point.sources.map((source) => source.kind)),
    );
    expect(new Set(kinds)).toEqual(new Set(['own_data']));
    expect(analysis.synthesisDraft?.text).toContain('nur mit euren eigenen Daten');
  });

  it('neu recherchieren lässt bestätigte Kräfte unverändert', async () => {
    const before = await research();
    const confirmed = await call(
      users.lead,
      'POST',
      `/warengruppen/strategien/${strategyId}/markt/rivalry/bestaetigen`,
    );
    expect(confirmed.status).toBeLessThan(300);
    const points = before.forces.find((force) => force.force === 'rivalry')?.points;
    const after = await research();
    const rivalry = after.forces.find((force) => force.force === 'rivalry');
    expect(rivalry?.status).toBe('confirmed');
    expect(rivalry?.points.map((point) => point.text)).toEqual(points?.map((point) => point.text));
    expect(rivalry?.proposal).not.toBeNull();
  });

  it('ein Nutzer ohne Zugriff auf die Kostensicht sieht im Protokoll keine Kostendaten', async () => {
    const response = await call(users.fn, 'GET', `/warengruppen/strategien/${strategyId}/markt`);
    expect(response.status).toBe(200);
    const analysis = marketAnalysisSchema.parse(response.body);
    expect(analysis.run).not.toBeNull();
    const text = JSON.stringify(analysis);
    expect(text).not.toContain('GEHEIM');
    expect(text).not.toContain('teurer als beim Wettbewerb');
    expect(analysis.run?.ownSources.some((title) => title.includes('Kosten'))).toBe(false);
  });

  it('der Test-Lieferant sieht weder Lauf noch Entwürfe', async () => {
    expect(
      (await call(users.supplier, 'GET', `/warengruppen/strategien/${strategyId}/markt`)).status,
    ).toBe(403);
    const rows = await withTenant(
      db,
      { userId: users.supplier, organizationId: orgs.s1 },
      async (tx) => ({
        runs: await tx.execute(
          sql`select 1 from agent_run where context_type = 'category_strategy' and context_id = ${strategyId}`,
        ),
        drafts: await tx.execute(
          sql`select 1 from ai_draft where object_type = 'material_group_strategy' and object_id = ${strategyId}`,
        ),
      }),
    );
    expect(rows.runs.rows).toHaveLength(0);
    expect(rows.drafts.rows).toHaveLength(0);
  });
});
