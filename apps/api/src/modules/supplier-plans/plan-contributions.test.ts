import { randomUUID } from 'node:crypto';
import { and, eq, schema, sql, type Database } from '@reziproq/db';
import {
  contributionDetailSchema,
  contributionSuggestionsResponseSchema,
  dueListSchema,
  supplierPlanResponseSchema,
  type OrgRole,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

describe('SPL-03: Beiträge der Funktionen', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const organizationId = randomUUID();
  const supplierOrgId = randomUUID();
  const relationshipId = randomUUID();
  const cycleId = randomUUID();
  const unitId = randomUUID();
  const otherUnitId = randomUUID();
  const groupId = randomUUID();
  const users = {
    admin: `spl03-admin-${run}`,
    sro: `spl03-sro-${run}`,
    anna: `spl03-anna-${run}`,
    ben: `spl03-ben-${run}`,
    viewer: `spl03-viewer-${run}`,
    supplier: `spl03-supplier-${run}`,
  };
  let planId: string;
  let ids: string[] = [];

  const call = async (user: string, method: string, path: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };

  const planPath = () => `/suppliers/${relationshipId}/plan`;
  const contributionPath = (id: string) => `${planPath()}/contributions/${id}`;
  const due = '2099-03-01';

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: organizationId, name: `SPL-03 Käufer ${run}` },
      { id: supplierOrgId, name: `SPL-03 Lieferant ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values({ organizationId, feature: 'buyer' });
    const person = (
      id: string,
      orgRole: OrgRole,
      extra: { defaultFunction?: 'programs' | 'purchasing'; locale?: 'de' | 'en' } = {},
      organization = organizationId,
    ) => ({
      id,
      name: id,
      givenName: 'Pat',
      email: `${id}@example.com`,
      organizationId: organization,
      orgRole,
      rolesImportedAt: new Date(),
      ...extra,
    });
    await db.insert(schema.appUser).values([
      person(users.admin, 'admin'),
      person(users.sro, 'member'),
      person(users.anna, 'member', { defaultFunction: 'programs', locale: 'de' }),
      person(users.ben, 'member', { defaultFunction: 'purchasing', locale: 'en' }),
      person(users.viewer, 'member'),
      person(users.supplier, 'member', {}, supplierOrgId),
    ]);
    await insertRelationships(db, [
      { id: relationshipId, buyer: organizationId, supplier: supplierOrgId },
    ]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId, orgId: organizationId, userId: users.sro, teamRole: 'sro' },
      { relationshipId, orgId: organizationId, userId: users.anna, teamRole: 'member' },
      { relationshipId, orgId: organizationId, userId: users.ben, teamRole: 'member' },
      { relationshipId, orgId: organizationId, userId: users.viewer, teamRole: 'viewer' },
    ]);
    await db.insert(schema.cycle).values({ id: cycleId, relationshipId, label: '2099', status: 'active' });
    await db.insert(schema.businessUnit).values([
      { id: unitId, orgId: organizationId, name: 'Werk Nord', code: `N-${run}` },
      { id: otherUnitId, orgId: organizationId, name: 'Werk Süd', code: `S-${run}` },
    ]);
    await db.insert(schema.materialGroup).values({
      id: groupId,
      orgId: organizationId,
      name: 'Stahl',
      code: `ST-${run}`,
    });
    await db.insert(schema.relationshipBusinessUnit).values([
      { relationshipId, businessUnitId: unitId },
      { relationshipId, businessUnitId: otherUnitId },
    ]);
    await db.insert(schema.relationshipMaterialGroup).values({
      relationshipId,
      materialGroupId: groupId,
      isPrimary: true,
    });
    const created = await call(users.sro, 'POST', planPath());
    planId = (created.body as { id: string }).id;
  });

  afterAll(async () => {
    await db
      .delete(schema.outboxEvent)
      .where(eq(schema.outboxEvent.orgId, organizationId));
    await db.delete(schema.supplierPlan).where(eq(schema.supplierPlan.id, planId));
    await db
      .delete(schema.objectiveCategory)
      .where(eq(schema.objectiveCategory.orgId, organizationId));
    await deleteRelationships(db, [organizationId, supplierOrgId]);
    await db
      .delete(schema.materialGroup)
      .where(eq(schema.materialGroup.orgId, organizationId));
    await db
      .delete(schema.businessUnit)
      .where(eq(schema.businessUnit.orgId, organizationId));
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${[organizationId, supplierOrgId]}`);
    await testApp.close();
  });

  it('schlägt je Business Unit und Warengruppe eine Person nach Funktion vor', async () => {
    const response = await call(users.sro, 'GET', `${planPath()}/${planId}/contribution-suggestions`);
    expect(response.status).toBe(200);
    const parsed = contributionSuggestionsResponseSchema.parse(response.body);
    expect(parsed.rows).toHaveLength(3);
    const byName = new Map(
      parsed.rows.map((row) => [(row.businessUnit ?? row.materialGroup)?.name, row.suggestedUserId]),
    );
    expect(byName.get('Werk Nord')).toBe(users.anna);
    expect(byName.get('Stahl')).toBe(users.ben);
    expect(parsed.teamCandidates.map((person) => person.userId)).not.toContain(users.viewer);
  });

  it('fordert alle Beiträge in einem Schritt an; jede Person bekommt genau eine Mail', async () => {
    const response = await call(users.admin, 'POST', `${planPath()}/${planId}/contributions`, {
      contributions: [
        { businessUnitId: unitId, materialGroupId: null, assigneeUserId: users.anna, dueDate: due },
        { businessUnitId: otherUnitId, materialGroupId: null, assigneeUserId: users.anna, dueDate: '2099-04-01' },
        { businessUnitId: null, materialGroupId: groupId, assigneeUserId: users.ben, dueDate: due },
      ],
    });
    expect(response.status).toBe(201);
    ids = (response.body as { ids: string[] }).ids;
    expect(ids).toHaveLength(3);

    const mails = await db
      .select({
        recipient: schema.outboxEvent.emailRecipient,
        link: schema.outboxEvent.emailLink,
        deadline: schema.outboxEvent.emailDeadline,
        title: schema.outboxEvent.emailTitle,
      })
      .from(schema.outboxEvent)
      .where(and(eq(schema.outboxEvent.orgId, organizationId), sql`${schema.outboxEvent.emailRecipient} is not null`));
    const recipients = mails.map((mail) => mail.recipient).sort();
    expect(recipients).toEqual([`${users.anna}@example.com`, `${users.ben}@example.com`]);
    const ben = mails.find((mail) => mail.recipient === `${users.ben}@example.com`);
    expect(ben?.link).toBe(`/lieferanten/${relationshipId}/strategie/lieferantenplan/beitrag/${ids[2]}`);
    expect(ben?.title).toContain('Supplier plan contribution');
    const anna = mails.find((mail) => mail.recipient === `${users.anna}@example.com`);
    expect(anna?.deadline).toBe(due);
    expect(anna?.link).not.toContain('/beitrag/');

    const again = await call(users.sro, 'POST', `${planPath()}/${planId}/contributions`, {
      contributions: [
        { businessUnitId: unitId, materialGroupId: null, assigneeUserId: users.anna, dueDate: due },
      ],
    });
    expect(again.status).toBe(409);
  });

  it('zeigt die Anfrage bei der Person unter "Fällig bei mir"', async () => {
    const response = await call(users.ben, 'GET', '/start/due');
    expect(response.status).toBe(200);
    const items = dueListSchema.parse(response.body).items.filter((item) => item.kind === 'contribution');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: ids[2],
      detail: 'Stahl',
      dueDate: due,
      href: `/lieferanten/${relationshipId}/strategie/lieferantenplan/beitrag/${ids[2]}`,
    });
    const annaItems = dueListSchema
      .parse((await call(users.anna, 'GET', '/start/due')).body)
      .items.filter((item) => item.kind === 'contribution');
    expect(annaItems).toHaveLength(2);
    const none = dueListSchema.parse((await call(users.sro, 'GET', '/start/due')).body);
    expect(none.items.filter((item) => item.kind === 'contribution')).toHaveLength(0);
  });

  it('legt Ziele sofort im Plan an, mit dem Bezug des Beitrags', async () => {
    const created = await call(users.ben, 'POST', `${contributionPath(ids[2] ?? '')}/objectives`, {
      categoryKey: 'cost',
      text: 'Stahlpreis stabil halten',
      targetYear: 2099,
      // Fremde Felder werden ignoriert, der Bezug kommt aus dem Beitrag.
      businessUnitId: unitId,
      ownerUserId: users.anna,
    });
    expect(created).toMatchObject({ status: 201 });
    const plan = supplierPlanResponseSchema.parse((await call(users.sro, 'GET', planPath())).body);
    const objective = plan.plan?.objectives.find((item) => item.text === 'Stahlpreis stabil halten');
    expect(objective?.materialGroup?.name).toBe('Stahl');
    expect(objective?.businessUnit).toBeNull();
    expect(objective?.owner.userId).toBe(users.ben);
  });

  it('zeigt der Person Soll-Typ, Zusammenfassung und eigene Ziele', async () => {
    const response = await call(users.ben, 'GET', contributionPath(ids[2] ?? ''));
    expect(response.status).toBe(200);
    const detail = contributionDetailSchema.parse(response.body);
    expect(detail.materialGroup?.name).toBe('Stahl');
    expect(detail.objectives).toHaveLength(1);
    expect(detail.canEdit).toBe(true);
  });

  it('lässt nur die zuständige Person Ziele anlegen und abschließen', async () => {
    const body = { categoryKey: 'cost', text: 'Fremdes Ziel', targetYear: 2099 };
    for (const user of [users.anna, users.sro, users.admin, users.viewer, users.supplier]) {
      expect(
        (await call(user, 'POST', `${contributionPath(ids[2] ?? '')}/objectives`, body)).status,
      ).toBe(403);
      expect((await call(user, 'POST', `${contributionPath(ids[2] ?? '')}/complete`)).status).toBe(
        403,
      );
    }
    expect((await call(users.supplier, 'GET', contributionPath(ids[2] ?? ''))).status).toBe(403);
    expect((await call(users.viewer, 'GET', contributionPath(ids[2] ?? ''))).status).toBe(403);
    expect(
      (await call(users.ben, 'POST', `${contributionPath(ids[2] ?? '')}/objectives`, { ...body, categoryKey: 'gibt-es-nicht' })).status,
    ).toBe(409);
  });

  it('weist Anfragen ohne Recht ab', async () => {
    for (const user of [users.anna, users.viewer, users.supplier]) {
      expect(
        (await call(user, 'GET', `${planPath()}/${planId}/contribution-suggestions`)).status,
      ).toBe(403);
      expect(
        (
          await call(user, 'POST', `${planPath()}/${planId}/contributions`, {
            contributions: [
              { businessUnitId: unitId, materialGroupId: null, assigneeUserId: users.anna, dueDate: due },
            ],
          })
        ).status,
      ).toBe(403);
    }
  });

  it('rechnet den Fortschritt und listet offene Beiträge im Plan', async () => {
    const before = supplierPlanResponseSchema.parse((await call(users.sro, 'GET', planPath())).body);
    expect(before.plan?.contributions).toMatchObject({ done: 0, total: 3 });

    const done = await call(users.ben, 'POST', `${contributionPath(ids[2] ?? '')}/complete`);
    expect(done.status).toBe(201);
    expect((await call(users.ben, 'POST', `${contributionPath(ids[2] ?? '')}/complete`)).status).toBe(409);
    expect(
      (
        await call(users.ben, 'POST', `${contributionPath(ids[2] ?? '')}/objectives`, {
          categoryKey: 'cost',
          text: 'Zu spät',
          targetYear: 2099,
        })
      ).status,
    ).toBe(409);

    const after = supplierPlanResponseSchema.parse((await call(users.sro, 'GET', planPath())).body);
    const contributions = after.plan?.contributions;
    expect(contributions).toMatchObject({ done: 1, total: 3 });
    const open = contributions?.items.filter((item) => item.status === 'open') ?? [];
    expect(open.map((item) => item.assignee.userId)).toEqual([users.anna, users.anna]);
    expect(open.every((item) => item.dueDate)).toBe(true);

    const benDue = dueListSchema.parse((await call(users.ben, 'GET', '/start/due')).body);
    expect(benDue.items.filter((item) => item.kind === 'contribution')).toHaveLength(0);
    const rows = await db
      .select({ id: schema.planContribution.id })
      .from(schema.planContribution)
      .where(and(eq(schema.planContribution.planId, planId), eq(schema.planContribution.status, 'done')));
    expect(rows).toHaveLength(1);
  });
});
