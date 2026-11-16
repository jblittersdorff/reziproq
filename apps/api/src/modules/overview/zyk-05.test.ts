import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  cycleArchiveSchema,
  cycleSchema,
  nextCyclePreviewSchema,
  supplierOverviewSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/ZYK-05.md: neuer Zyklus auf Basis des freigegebenen Lieferantenplans und der
// laufenden Initiativen; der alte bleibt unverändert und im Archiv lesbar.
describe('ZYK-05 Neuer Zyklus', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const oldCycle = randomUUID();
  const planId = randomUUID();
  const unit = randomUUID();
  const users = { sro: `zyk5-sro-${run}`, member: `zyk5-member-${run}` };
  const base = `/suppliers/${rel}/cycle`;
  let jbpId = '';
  let snapshot: Record<string, unknown[]> = {};

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
  /** Alles, was am alten Zyklus hängt, so wie es in der Datenbank steht. */
  const oldState = async () => ({
    plans: await db.select().from(schema.supplierPlan).where(sql`cycle_id = ${oldCycle}`),
    objectives: await db.select().from(schema.planObjective).where(sql`plan_id = ${planId}`),
    topics: await db.select().from(schema.strategicTopic).where(sql`plan_id = ${planId}`),
    versions: await db.select().from(schema.jbpVersion).where(sql`jbp_id = ${jbpId}`),
    initiatives: await db.select().from(schema.initiative).where(sql`relationship_id = ${rel}`),
    commitments: await db.select().from(schema.commitment).where(sql`relationship_id = ${rel}`),
    actions: await db.select().from(schema.action).where(sql`relationship_id = ${rel}`),
  });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `ZYK5-OEM ${run}` },
      { id: orgs.supplier, name: `ZYK5-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const person = (id: string, name: string) => ({
      id,
      name,
      email: `${id}@example.com`,
      organizationId: orgs.oem,
      orgRole: 'member' as const,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([person(users.sro, 'Sara Ost'), person(users.member, 'Max Mitglied')]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db
      .insert(schema.relationshipSide)
      .values({ relationshipId: rel, orgId: orgs.oem, isFocus: true });
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' },
      { relationshipId: rel, orgId: orgs.oem, userId: users.member, teamRole: 'member' },
    ]);
    // Alter Zyklus: JBP vor einem Jahr, also fällig für den nächsten
    const yearAgo = new Date(Date.now() - 370 * 86_400_000);
    await db.insert(schema.cycle).values({
      id: oldCycle,
      relationshipId: rel,
      label: '2025',
      status: 'active',
      startedAt: new Date(Date.now() - 400 * 86_400_000),
      jbpDate: yearAgo.toISOString().slice(0, 10),
    });
    // Freigegebener Lieferantenplan mit Ziel und Thema
    await db
      .insert(schema.businessUnit)
      .values({ id: unit, orgId: orgs.oem, name: 'Antriebe', code: `A-${run}` });
    await db.insert(schema.supplierPlan).values({
      id: planId,
      relationshipId: rel,
      cycleId: oldCycle,
      version: 2,
      summary: `Strategie ${run}`,
    });
    await db.insert(schema.planObjective).values({
      relationshipId: rel,
      planId,
      categoryKey: 'quality',
      businessUnitId: unit,
      text: 'Reklamationen halbieren',
      ownerUserId: users.sro,
      targetYear: 2026,
    });
    await db.insert(schema.strategicTopic).values({
      relationshipId: rel,
      planId,
      title: 'Zweitquelle',
      reason: 'Abhängigkeit senken',
      priority: 1,
      createdBy: users.sro,
      createdByName: 'Sara Ost',
    } as never);
    // Erst mit Inhalt freigeben: Freigegebene Pläne sind gesperrt.
    await db.execute(sql`update supplier_plan set status = 'approved' where id = ${planId}`);
    // Gemeinsamer Plan, freigegeben, mit laufender Initiative, offener Zusage, offener Maßnahme
    await call(users.sro, 'POST', `/suppliers/${rel}/jbp`, {
      startsAt: yearAgo.toISOString(),
      location: null,
      locale: 'de',
    });
    const [plan] = await db.select().from(schema.jbp).where(sql`relationship_id = ${rel}`);
    jbpId = plan?.id ?? '';
    await db.insert(schema.initiative).values({
      relationshipId: rel,
      ownerOrgId: orgs.oem,
      jbpId,
      title: 'Preis Leiterplatten',
      goal: 'Kosten senken',
      benefitBuyer: 'Marge',
      benefitSupplier: 'Volumen',
      ownerBuyerName: 'Sara Ost',
      ownerSupplierName: 'Kim Kaiser',
      startsOn: '2025-01-01',
      endsOn: '2026-12-31',
      status: 'running',
      createdBy: users.sro,
      createdByName: 'Sara Ost',
    });
    await db.insert(schema.commitment).values({
      relationshipId: rel,
      ownerOrgId: orgs.oem,
      jbpId,
      title: 'Musterteile',
      side: 'buyer',
      ownerName: 'Sara Ost',
      dueOn: '2026-12-15',
      createdBy: users.sro,
      createdByName: 'Sara Ost',
    } as never);
    await db.insert(schema.action).values({
      relationshipId: rel,
      ownerOrgId: orgs.oem,
      title: 'Audit nachholen',
      ownerSide: 'buyer',
      ownerName: 'Sara Ost',
      dueDate: '2026-12-31',
      sourceType: 'manual',
      createdBy: users.sro,
      createdByName: 'Sara Ost',
    });
    await db.execute(sql`update jbp set status = 'approved' where id = ${jbpId}`);
    await db.insert(schema.jbpVersion).values({
      relationshipId: rel,
      ownerOrgId: orgs.oem,
      jbpId,
      version: 1,
      content: {
        topics: [],
        initiatives: [
          {
            title: 'Preis Leiterplatten',
            goal: 'Kosten senken',
            benefitBuyer: 'Marge',
            benefitSupplier: 'Volumen',
            ownerBuyerName: 'Sara Ost',
            ownerSupplierName: 'Kim Kaiser',
            startsOn: '2025-01-01',
            endsOn: '2026-12-31',
          },
        ],
        commitments: [],
      },
      approvedAt: new Date(Date.now() - 360 * 86_400_000),
    } as never);
  });

  afterAll(async () => {
    await db.execute(sql`delete from jbp_cycle_link where relationship_id = ${rel}`);
    // Wie SPL-07: Der Plan nimmt Ziele und Themen mit.
    await db.execute(sql`delete from supplier_plan where relationship_id = ${rel}`);
    await db.execute(sql`delete from action where relationship_id = ${rel}`);
    await db.execute(sql`delete from commitment where relationship_id = ${rel}`);
    await db.execute(sql`delete from initiative where relationship_id = ${rel}`);
    await db.execute(sql`delete from jbp_version where relationship_id = ${rel}`);
    await db.execute(sql`delete from jbp where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting where relationship_id = ${rel}`);
    await db.execute(sql`delete from cycle where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from business_unit where org_id = ${orgs.oem}`);
    await db.execute(sql`delete from objective_category where org_id = ${orgs.oem}`);
    await db.execute(sql`delete from app_user where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('Der Überblick bietet den nächsten Zyklus elf Monate nach dem JBP an; nur SRO oder Admin starten', async () => {
    const overview = supplierOverviewSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel}/overview`)).body,
    );
    expect(overview.canStartNextCycle).toBe(true);
    const preview = nextCyclePreviewSchema.parse(
      (await call(users.sro, 'GET', `${base}/next`)).body,
    );
    expect(preview).toMatchObject({
      nextLabel: '2026',
      approvedPlan: { version: 2, objectives: 1 },
      jointPlan: { approved: true },
      runningInitiatives: 1,
      openCommitments: 1,
      openActions: 1,
      canStart: true,
    });
    const refused = await call(users.member, 'POST', `${base}/next`, {
      jbpDate: '2027-03-15',
      label: '2026',
    });
    expect(refused.status).toBe(403);
  });

  it('Der Start eines neuen Zyklus verändert keine Daten des alten', async () => {
    snapshot = await oldState();
    const started = await call(users.sro, 'POST', `${base}/next`, {
      jbpDate: '2027-03-15',
      label: '2026',
    });
    expect(started.status).toBe(201);
    const cycle = cycleSchema.parse(started.body);
    expect(cycle).toMatchObject({ label: '2026', jbpDate: '2027-03-15' });
    const after = await oldState();
    expect(after.plans).toEqual(snapshot.plans);
    expect(after.objectives).toEqual(snapshot.objectives);
    expect(after.topics).toEqual(snapshot.topics);
    expect(after.versions).toEqual(snapshot.versions);
    const [old] = await db.select().from(schema.cycle).where(sql`id = ${oldCycle}`);
    expect(old).toMatchObject({ status: 'closed', label: '2025' });
    expect(old?.closedAt).toBeInstanceOf(Date);
  });

  it('Der neue Lieferantenplan entspricht inhaltlich dem letzten freigegebenen und ist ein Entwurf', async () => {
    const [newCycle] = await db
      .select()
      .from(schema.cycle)
      .where(sql`relationship_id = ${rel} and status = 'active'`);
    const [copy] = await db
      .select()
      .from(schema.supplierPlan)
      .where(sql`cycle_id = ${newCycle?.id}`);
    expect(copy).toMatchObject({ status: 'draft', version: 1, summary: `Strategie ${run}` });
    const objectives = await db
      .select({ text: schema.planObjective.text, categoryKey: schema.planObjective.categoryKey })
      .from(schema.planObjective)
      .where(sql`plan_id = ${copy?.id}`);
    expect(objectives).toEqual([{ text: 'Reklamationen halbieren', categoryKey: 'quality' }]);
    const topics = await db
      .select({ title: schema.strategicTopic.title })
      .from(schema.strategicTopic)
      .where(sql`plan_id = ${copy?.id}`);
    expect(topics).toEqual([{ title: 'Zweitquelle' }]);
  });

  it('Laufende Initiativen und offene Maßnahmen bleiben unverändert und erscheinen im neuen Zyklus', async () => {
    const after = await oldState();
    expect(after.initiatives).toEqual(snapshot.initiatives);
    expect(after.commitments).toEqual(snapshot.commitments);
    expect(after.actions).toEqual(snapshot.actions);
    // Der Gemeinsame Plan läuft als neue Version weiter und ist mit dem neuen Zyklus verbunden.
    const [plan] = await db.select().from(schema.jbp).where(sql`id = ${jbpId}`);
    expect(plan).toMatchObject({ version: 2, status: 'draft' });
    const initiatives = (await call(users.sro, 'GET', `/suppliers/${rel}/jbp/initiativen`))
      .body as { initiatives: { title: string }[] };
    expect(initiatives.initiatives.map((entry) => entry.title)).toEqual(['Preis Leiterplatten']);
    const actions = (await call(users.sro, 'GET', `/suppliers/${rel}/massnahmen`)).body as {
      actions: { title: string }[];
    };
    expect(actions.actions.map((entry) => entry.title)).toEqual(['Audit nachholen']);
    // Im neuen Zyklus ist der Plan noch nicht freigegeben: Der Schritt ist nicht erledigt.
    const overview = supplierOverviewSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel}/overview`)).body,
    );
    expect(overview.cycle?.label).toBe('2026');
    expect(overview.cycle?.steps.find((step) => step.key === 'jbp')?.status).not.toBe('completed');
    expect(overview.canStartNextCycle).toBe(false);
  });

  it('Das Archiv zeigt jeden alten Zyklus vollständig und nur lesend', async () => {
    const archive = cycleArchiveSchema.parse(
      (await call(users.member, 'GET', `${base}/archive`)).body,
    );
    expect(archive.cycles.map((cycle) => cycle.label)).toEqual(['2025']);
    const [old] = archive.cycles;
    expect(old?.supplierPlans).toMatchObject([
      { version: 2, status: 'approved', summary: `Strategie ${run}`, topics: ['Zweitquelle'] },
    ]);
    expect(old?.supplierPlans[0]?.objectives.map((objective) => objective.text)).toEqual([
      'Reklamationen halbieren',
    ]);
    expect(old?.jointPlans.map((plan) => plan.initiatives.map((entry) => entry.title))).toEqual([
      ['Preis Leiterplatten'],
    ]);
    // Nur lesend: Es gibt keinen Weg, das Archiv zu ändern.
    for (const method of ['POST', 'PUT', 'DELETE']) {
      expect((await call(users.sro, method, `${base}/archive`, {})).status).toBe(404);
    }
  });
});
