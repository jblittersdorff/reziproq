import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import { awardPlanSchema, strategyContextResponseSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/WG-14.md (Vergabeplan), je Kriterium aus „Fertig, wenn“.
describe('WG-14 Vergabeplan', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = {
    a: randomUUID(),
    good: randomUUID(),
    weak: randomUUID(),
    shaky: randomUUID(),
    leaving: randomUUID(),
  };
  const group = randomUUID();
  const rel = {
    good: randomUUID(),
    weak: randomUUID(),
    shaky: randomUUID(),
    leaving: randomUUID(),
  };
  const users = {
    lead: `wg14-lead-${run}`,
    admin: `wg14-admin-${run}`,
    supplier: `wg14-sup-${run}`,
  };
  let strategyId = '';
  let candidateId = '';

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
  const base = () => `/warengruppen/strategien/${strategyId}/vergaben`;
  const plan = async () => awardPlanSchema.parse((await call(users.lead, 'GET', base())).body);
  const inMonths = (months: number) => {
    const date = new Date();
    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString().slice(0, 10);
  };
  const award = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    volumeCents: 360_000_000,
    requestFrom: inMonths(1),
    requestTo: inMonths(2),
    awardDate: inMonths(3),
    bundleKey: null,
    suppliers: [{ kind: 'relationship', id: rel.good, note: null }],
    ...extra,
  });
  const stepState = async () =>
    strategyContextResponseSchema.parse(
      (await call(users.lead, 'GET', `/warengruppen/${group}/strategie?jahr=2031`)).body,
    ).context?.strategy.steps[7];

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `WG14-A ${run}` },
      { id: orgs.good, name: `WG14-Rheintal ${run}` },
      { id: orgs.weak, name: `WG14-Donau ${run}` },
      { id: orgs.shaky, name: `WG14-Moldau ${run}` },
      { id: orgs.leaving, name: `WG14-Saar ${run}` },
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
        person(users.admin, orgs.a, 'admin'),
        person(users.supplier, orgs.good, 'admin'),
      ]);
    await insertRelationships(db, [
      { id: rel.good, buyer: orgs.a, supplier: orgs.good },
      { id: rel.weak, buyer: orgs.a, supplier: orgs.weak },
      { id: rel.shaky, buyer: orgs.a, supplier: orgs.shaky },
      { id: rel.leaving, buyer: orgs.a, supplier: orgs.leaving },
    ]);
    await db.insert(schema.materialGroup).values({
      id: group,
      orgId: orgs.a,
      name: 'Leiterplatten',
      code: `LP-${run}`,
      leadUserId: users.lead,
    });
    await db
      .insert(schema.materialGroupMember)
      .values({ orgId: orgs.a, materialGroupId: group, userId: users.lead, role: 'lead' });
    await db.insert(schema.relationshipMaterialGroup).values(
      Object.values(rel).map((relationshipId) => ({
        relationshipId,
        materialGroupId: group,
        isPrimary: true,
      })),
    );
    strategyId = strategyContextResponseSchema.parse(
      (await call(users.lead, 'POST', `/warengruppen/${group}/strategie`, { year: 2031 })).body,
    ).context?.strategy.id as string;
    // WG-07: Qualitätsbewertung C und kritische Lieferkettenstabilität; WG-15: Soll „beenden“
    await db.insert(schema.materialGroupAnalysis).values([
      {
        orgId: orgs.a,
        strategyId,
        view: 'quality',
        data: { ratings: [{ relationshipId: rel.weak, rating: 'C' }] },
        updatedBy: users.lead,
      },
      {
        orgId: orgs.a,
        strategyId,
        view: 'revenue_finance',
        data: { stability: [{ relationshipId: rel.shaky, rating: 'critical' }] },
        updatedBy: users.lead,
      },
    ]);
    await db.insert(schema.materialGroupSupplierMapRow).values({
      orgId: orgs.a,
      strategyId,
      relationshipId: rel.leaving,
      targetYear: 2032,
      shareTarget: 0,
      ended: true,
    });
    const [candidate] = await db
      .insert(schema.materialGroupCandidate)
      .values({ orgId: orgs.a, strategyId, name: 'Laminat Nord' })
      .returning({ id: schema.materialGroupCandidate.id });
    candidateId = candidate?.id as string;
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    await db.execute(sql`delete from material_group_strategy where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_kpi where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_question where org_id in ${orgIds}`);
    await db.execute(sql`delete from org_setting where org_id in ${orgIds}`);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from objective_category where org_id in ${orgIds}`);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('ein nicht vergabefähiger Lieferant lässt sich keiner Vergabe zuordnen', async () => {
    const options = (await plan()).options;
    expect(options.find((entry) => entry.id === rel.weak)).toMatchObject({
      eligible: false,
      reasons: ['quality_critical'],
    });
    expect(options.find((entry) => entry.id === rel.shaky)).toMatchObject({
      eligible: false,
      reasons: ['stability_critical'],
    });
    expect(options.find((entry) => entry.id === candidateId)).toMatchObject({
      kind: 'candidate',
      eligible: true,
    });
    const weak = await call(
      users.lead,
      'POST',
      base(),
      award('Mehrlagen', { suppliers: [{ kind: 'relationship', id: rel.weak, note: null }] }),
    );
    expect(weak).toMatchObject({
      status: 400,
      body: { code: 'supplier_not_eligible', reasons: ['quality_critical'] },
    });
    // Nur Admins stellen die Bedingungen ein
    const denied = await call(users.lead, 'PUT', '/warengruppen/vergabefaehigkeit', {
      qualityNotCritical: false,
      stabilityNotCritical: true,
    });
    expect(denied.status).toBe(403);
    const saved = await call(users.admin, 'PUT', '/warengruppen/vergabefaehigkeit', {
      qualityNotCritical: false,
      stabilityNotCritical: true,
    });
    expect(saved).toMatchObject({ status: 200, body: { qualityNotCritical: false } });
    expect((await plan()).options.find((entry) => entry.id === rel.weak)?.eligible).toBe(true);
    expect((await plan()).options.find((entry) => entry.id === rel.shaky)?.eligible).toBe(false);
    // Ein Kandidat ohne Beziehung ist wählbar
    const withCandidate = await call(
      users.lead,
      'POST',
      base(),
      award('Laminat direkt', {
        suppliers: [{ kind: 'candidate', id: candidateId, note: 'Stufe 2' }],
      }),
    );
    expect(withCandidate.status).toBe(201);
    await call(users.admin, 'PUT', '/warengruppen/vergabefaehigkeit', {
      qualityNotCritical: true,
      stabilityNotCritical: true,
    });
  });

  it('Schritt 8 ist fertig, wenn jede Vergabe einen möglichen Lieferanten und ein Volumen hat', async () => {
    expect(await stepState()).toBe('done');
    const created = awardPlanSchema.parse(
      (
        await call(
          users.lead,
          'POST',
          base(),
          award('Ultra-HDI Vorserie', { volumeCents: null, suppliers: [] }),
        )
      ).body,
    );
    expect(created.complete).toBe(false);
    expect(await stepState()).toBe('in_progress');
    const id = created.awards.find((entry) => entry.name === 'Ultra-HDI Vorserie')?.id;
    const updated = await call(users.lead, 'PATCH', `${base()}/${id}`, award('Ultra-HDI Vorserie'));
    expect(updated.status).toBe(200);
    expect(awardPlanSchema.parse(updated.body).complete).toBe(true);
    expect(await stepState()).toBe('done');
  });

  it('zwei Vergaben mit demselben Bündel erscheinen als gebündelt', async () => {
    await call(users.lead, 'POST', base(), award('Starrflex Antriebe', { bundleKey: 'starrflex' }));
    const second = await call(
      users.lead,
      'POST',
      base(),
      award('Starrflex Steuerungen', { bundleKey: 'starrflex' }),
    );
    const awards = awardPlanSchema.parse(second.body).awards;
    const bundled = (name: string) => awards.find((entry) => entry.name === name)?.bundled;
    expect(bundled('Starrflex Antriebe')).toBe(true);
    expect(bundled('Starrflex Steuerungen')).toBe(true);
    expect(bundled('Ultra-HDI Vorserie')).toBe(false);
  });

  it('ein Lieferant mit Soll „beendet“ als möglicher Lieferant löst die Warnung aus', async () => {
    const saved = await call(
      users.lead,
      'POST',
      base(),
      award('Rahmenvertrag Mehrlagen', {
        suppliers: [
          { kind: 'relationship', id: rel.good, note: null },
          { kind: 'relationship', id: rel.leaving, note: null },
        ],
      }),
    );
    expect(saved.status).toBe(201);
    const entry = awardPlanSchema
      .parse(saved.body)
      .awards.find((item) => item.name === 'Rahmenvertrag Mehrlagen');
    expect(entry?.endedSuppliers).toEqual([`WG14-Saar ${run}`]);
    expect(entry?.suppliers.find((item) => item.id === rel.leaving)?.ended).toBe(true);
    const other = (await plan()).awards.find((item) => item.name === 'Ultra-HDI Vorserie');
    expect(other?.endedSuppliers).toEqual([]);
  });

  it('der Test-Lieferant sieht keinen Vergabeplan und keinen Hinweis darauf', async () => {
    const supplierPlan = await call(users.supplier, 'GET', base());
    expect([403, 404]).toContain(supplierPlan.status);
    expect(JSON.stringify(supplierPlan.body)).not.toContain('Mehrlagen');
    const overview = await call(users.supplier, 'GET', `/suppliers/${rel.good}/overview`);
    expect([403, 404]).toContain(overview.status);
    expect(JSON.stringify(overview.body)).not.toContain('upcomingAwards');
    // Der Käufer sieht im Überblick die Zahl der Vergaben der nächsten sechs Monate
    const buyer = await call(users.lead, 'GET', `/suppliers/${rel.good}/overview`);
    expect(buyer.body).toMatchObject({ upcomingAwards: 4 });
    // Die Tabellen sind für die Lieferantenseite auch direkt leer (RLS)
    const visible = await withTenant(
      db,
      { userId: users.supplier, organizationId: orgs.good },
      async (tx) => ({
        awards: await tx.execute(sql`select 1 from material_group_award`),
        links: await tx.execute(sql`select 1 from material_group_award_supplier`),
      }),
    );
    expect(visible.awards.rows).toHaveLength(0);
    expect(visible.links.rows).toHaveLength(0);
  });
});
