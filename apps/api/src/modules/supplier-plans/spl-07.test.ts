import { randomUUID } from 'node:crypto';
import { type Database, eq, schema, sql, withTenant } from '@reziproq/db';
import {
  type OrgRole,
  planVersionsSchema,
  startSchema,
  supplierOverviewSchema,
  supplierPlanResponseSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/SPL-07.md: Freigabe durch SRO und Sponsor, Zurückgeben mit Begründung,
// gesperrte Versionen und neue Version, Vergleich, Zyklus-Schritt, und der Lieferant sieht nichts
// vom Plan (SPL-09).
describe('SPL-07 Freigabe und Versionen des Lieferantenplans', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const buyerOrg = randomUUID();
  const supplierOrg = randomUUID();
  const rel = randomUUID();
  const cycleId = randomUUID();
  const businessUnitId = randomUUID();
  const users = {
    sro: `spl07-sro-${run}`,
    sponsor: `spl07-sponsor-${run}`,
    member: `spl07-member-${run}`,
    supplier: `spl07-supplier-${run}`,
  };
  const path = `/suppliers/${rel}/plan`;
  let planId = '';
  let secondId = '';

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
  const plan = async (user = users.sro) => {
    const response = supplierPlanResponseSchema.parse((await call(user, 'GET', path)).body);
    if (!response.plan) throw new Error('Kein Plan');
    return response.plan;
  };
  const decide = (
    user: string,
    id: string,
    decision: 'approved' | 'returned',
    comment: string | null,
  ) => call(user, 'POST', `${path}/${id}/decision`, { decision, comment });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: buyerOrg, name: `SPL-07 Käufer ${run}` },
      { id: supplierOrg, name: `SPL-07 Lieferant ${run}` },
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
        person(users.sro, 'Sara Ost', 'member'),
        person(users.sponsor, 'Paul Sponsor', 'member'),
        person(users.member, 'Mia Mitglied', 'member'),
        person(users.supplier, 'Kim Kaiser', 'admin', supplierOrg),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: buyerOrg, supplier: supplierOrg }]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel, orgId: buyerOrg, userId: users.sro, teamRole: 'sro' },
      { relationshipId: rel, orgId: buyerOrg, userId: users.sponsor, teamRole: 'sponsor' },
      { relationshipId: rel, orgId: buyerOrg, userId: users.member, teamRole: 'member' },
    ]);
    // Fokuslieferant mit aktivem Zyklus, damit der Überblick die Zyklus-Leiste zeigt.
    await db
      .insert(schema.relationshipSide)
      .values({ relationshipId: rel, orgId: buyerOrg, isFocus: true, focusReason: 'Test' });
    await db
      .insert(schema.cycle)
      .values({ id: cycleId, relationshipId: rel, label: '2026', status: 'active' });
    await db
      .insert(schema.businessUnit)
      .values({ id: businessUnitId, orgId: buyerOrg, name: 'Elektronik', code: `E-${run}` });
    await db
      .insert(schema.relationshipBusinessUnit)
      .values({ relationshipId: rel, businessUnitId });

    // Die Standardkategorien entstehen beim ersten Lesen, wie in der Oberfläche.
    await call(users.sro, 'GET', '/objective-categories');
    planId = ((await call(users.sro, 'POST', path)).body as { id: string }).id;
    await call(users.sro, 'PATCH', `${path}/${planId}/summary`, {
      summary: 'Partner für die neue Plattform.',
    });
    const objective = await call(users.sro, 'POST', `${path}/${planId}/objectives`, {
      categoryKey: 'cost',
      businessUnitId,
      materialGroupId: null,
      text: 'Kosten je Baugruppe um 5 % senken',
      ownerUserId: users.sro,
      targetYear: 2027,
    });
    const objectiveId = (objective.body as { id: string }).id;
    await call(users.sro, 'POST', `${path}/${planId}/topics`, {
      title: 'Plattform 2027',
      reason: 'Neue Steuergeräte',
      objectiveIds: [objectiveId],
    });
  });

  afterAll(async () => {
    await db.delete(schema.supplierPlan).where(eq(schema.supplierPlan.relationshipId, rel));
    await db.delete(schema.objectiveCategory).where(eq(schema.objectiveCategory.orgId, buyerOrg));
    await deleteRelationships(db, [buyerOrg, supplierOrg]);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${buyerOrg}`);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${[buyerOrg, supplierOrg]}`);
    await testApp.close();
  });

  it('nur der SRO reicht ein; Freigebende bekommen Mail und Aufgabe, der Plan ist gesperrt', async () => {
    const draft = await plan();
    expect(draft.approval).toMatchObject({
      canSubmit: true,
      hasSponsor: true,
      hints: { noTopics: false },
    });
    expect((await call(users.member, 'POST', `${path}/${planId}/submit`)).status).toBe(403);
    expect((await call(users.sro, 'POST', `${path}/${planId}/submit`)).status).toBe(201);
    expect((await plan()).status).toBe('in_review');

    const mails = await db.execute<{ recipient: string }>(sql`
      select email_recipient as recipient from outbox_event
      where object_type = 'plan_approval_request' and object_id like ${`${planId}:%`}
      order by email_recipient
    `);
    expect(mails.rows.map((row) => row.recipient)).toEqual(
      [`${users.sponsor}@example.com`, `${users.sro}@example.com`].sort(),
    );
    const start = startSchema.parse((await call(users.sponsor, 'GET', '/start')).body);
    expect(start.due.items).toContainEqual(
      expect.objectContaining({
        kind: 'approval',
        href: `/lieferanten/${rel}/strategie/lieferantenplan/freigabe`,
      }),
    );
    const edit = await call(users.sro, 'PATCH', `${path}/${planId}/summary`, { summary: 'Anders' });
    expect(edit.status).toBe(409);
  });

  it('Zurückgeben verlangt eine Begründung und setzt den Plan auf Entwurf', async () => {
    expect((await decide(users.sponsor, planId, 'returned', null)).status).toBe(400);
    expect((await decide(users.sponsor, planId, 'returned', 'Ziele zu vage')).status).toBe(201);
    const back = await plan();
    expect(back.status).toBe('draft');
    expect(back.approval.decisions[0]).toMatchObject({
      userName: 'Paul Sponsor',
      role: 'sponsor',
      decision: 'returned',
      comment: 'Ziele zu vage',
    });
  });

  it('freigegeben erst mit SRO und Sponsor; danach ist der Zyklus-Schritt erledigt', async () => {
    await call(users.sro, 'POST', `${path}/${planId}/submit`);
    expect((await decide(users.sro, planId, 'approved', null)).status).toBe(201);
    expect((await plan()).status).toBe('in_review');
    expect((await decide(users.sro, planId, 'approved', null)).status).toBe(409);
    expect((await decide(users.sponsor, planId, 'approved', null)).status).toBe(201);
    const approved = await plan();
    expect(approved.status).toBe('approved');
    expect(approved.approval.approvedAt).not.toBeNull();
    const overview = supplierOverviewSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel}/overview`)).body,
    );
    expect(overview.cycle?.steps.find((step) => step.key === 'supplierPlan')).toMatchObject({
      status: 'completed',
      href: `/lieferanten/${rel}/strategie/lieferantenplan`,
    });
  });

  it('eine freigegebene Version lässt sich nicht ändern; Bearbeiten erzeugt eine neue Version', async () => {
    expect(
      (await call(users.sro, 'PATCH', `${path}/${planId}/summary`, { summary: 'x' })).status,
    ).toBe(409);
    await expect(
      db.execute(sql`update supplier_plan set summary = 'x' where id = ${planId}`),
    ).rejects.toMatchObject({ cause: { message: 'plan_locked' } });
    await expect(
      db.execute(sql`update plan_objective set text = 'x' where plan_id = ${planId}`),
    ).rejects.toMatchObject({ cause: { message: 'plan_locked' } });

    const created = await call(users.sro, 'POST', `${path}/${planId}/new-version`);
    expect(created.status).toBe(201);
    secondId = (created.body as { id: string }).id;
    const second = await plan();
    expect(second).toMatchObject({ id: secondId, version: 2, status: 'draft' });
    expect(second.objectives.map((entry) => entry.text)).toEqual([
      'Kosten je Baugruppe um 5 % senken',
    ]);
    expect(second.topics[0]?.objectives).toHaveLength(1);
    await call(users.sro, 'PATCH', `${path}/${secondId}/summary`, {
      summary: 'Partner für Plattform und Service.',
    });
  });

  it('die Versionen lassen sich vergleichen: Zusammenfassung, Ziele und Themen je Version', async () => {
    const { versions } = planVersionsSchema.parse(
      (await call(users.sro, 'GET', `${path}/versions`)).body,
    );
    expect(versions.map((entry) => [entry.version, entry.status])).toEqual([
      [2, 'draft'],
      [1, 'superseded'],
    ]);
    expect(versions[1]?.summary).toBe('Partner für die neue Plattform.');
    expect(versions[0]?.summary).toBe('Partner für Plattform und Service.');
    expect(versions[1]?.objectives[0]).toMatchObject({
      categoryName: 'Kosten',
      reference: 'Elektronik',
    });
    expect(versions[0]?.topics).toEqual(versions[1]?.topics);
  });

  it('ohne Sponsor im Team genügt der SRO', async () => {
    await db.execute(sql`delete from relationship_member where user_id = ${users.sponsor}`);
    expect((await plan()).approval.hasSponsor).toBe(false);
    await call(users.sro, 'POST', `${path}/${secondId}/submit`);
    expect((await decide(users.sro, secondId, 'approved', null)).status).toBe(201);
    expect((await plan()).status).toBe('approved');
  });

  it('der Lieferant sieht keine Zeile aus den Tabellen des Lieferantenplans (SPL-09)', async () => {
    for (const table of [
      'supplier_plan',
      'plan_objective',
      'plan_contribution',
      'strategic_topic',
      'strategic_topic_objective',
      'plan_approval',
    ]) {
      const rows = await withTenant(
        db,
        { userId: users.supplier, organizationId: supplierOrg, customerOrganizationId: buyerOrg },
        (tx) =>
          tx.execute<{ count: number }>(
            sql`select count(*)::int as count from ${sql.identifier(table)} where relationship_id = ${rel}`,
          ),
      );
      expect(rows.rows[0]?.count, table).toBe(0);
    }
    // Zur Gegenprobe sieht der Käufer seine Zeilen.
    const own = await withTenant(db, { userId: users.sro, organizationId: buyerOrg }, (tx) =>
      tx.execute<{ count: number }>(
        sql`select count(*)::int as count from supplier_plan where relationship_id = ${rel}`,
      ),
    );
    expect(own.rows[0]?.count).toBe(2);
  });
});
