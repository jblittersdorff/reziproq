import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  dueListSchema,
  goalDimensions,
  kpiListSchema,
  questionListSchema,
  strategyContextResponseSchema,
  strategyOverviewSchema,
  strategyStepSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/WG-04.md (Strategie und Ablauf) und WG-06.md (Ziele der Warengruppe).
describe('WG-04 Strategie und Ablauf, WG-06 Ziele der Warengruppe', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), b: randomUUID(), supplier: randomUUID() };
  const group = randomUUID();
  const users = {
    admin: `wg04-admin-${run}`,
    lead: `wg04-lead-${run}`,
    buyer: `wg04-buyer-${run}`,
    fn: `wg04-fn-${run}`,
    reader: `wg04-reader-${run}`,
    adminB: `wg04-admin-b-${run}`,
    supplier: `wg04-sup-${run}`,
  };
  const year = 2031;
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
  const context = async (user = users.lead) =>
    strategyContextResponseSchema.parse(
      (await call(user, 'GET', `/warengruppen/${group}/strategie?jahr=${year}`)).body,
    );
  const states = async () => (await context()).context?.strategy.steps ?? [];
  const step = async (n: number, user = users.lead) =>
    strategyStepSchema.parse(
      (await call(user, 'GET', `/warengruppen/strategien/${strategyId}/schritte/${n}`)).body,
    );

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `WG04-A ${run}` },
      { id: orgs.b, name: `WG04-B ${run}` },
      { id: orgs.supplier, name: `WG04-Lieferant ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.a, feature: 'buyer' },
      { organizationId: orgs.b, feature: 'buyer' },
    ]);
    const person = (
      id: string,
      organizationId: string,
      orgRole: 'admin' | 'member' | 'viewer',
    ) => ({
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
        person(users.fn, orgs.a, 'member'),
        person(users.reader, orgs.a, 'member'),
        person(users.adminB, orgs.b, 'admin'),
        person(users.supplier, orgs.supplier, 'admin'),
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
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
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

  describe('WG-04', () => {
    it('Eine zweite Strategie für dieselbe Warengruppe und dasselbe Jahr wird abgelehnt', async () => {
      expect((await context()).canCreate).toBe(true);
      // Nur Lead und Commodity Manager legen an.
      expect(
        (await call(users.buyer, 'POST', `/warengruppen/${group}/strategie`, { year })).status,
      ).toBe(403);
      const created = await call(users.lead, 'POST', `/warengruppen/${group}/strategie`, { year });
      expect(created.status).toBe(201);
      strategyId = strategyContextResponseSchema.parse(created.body).context?.strategy.id as string;
      const again = await call(users.lead, 'POST', `/warengruppen/${group}/strategie`, { year });
      expect(again.status).toBe(409);
      expect(again.body).toMatchObject({ code: 'strategy_exists' });
    });

    it('Der Stand jedes Schritts wechselt allein durch Dateneingabe auf fertig', async () => {
      // Lead gesetzt, aber keine Produktgruppe: Aufsetzen läuft.
      expect((await states())[0]).toBe('in_progress');
      await call(users.lead, 'POST', `/warengruppen/${group}/produktgruppen`, {
        name: 'Mehrlagen',
      });
      expect((await states())[0]).toBe('done');
      expect((await states())[2]).toBe('open');
      await call(users.buyer, 'PUT', `/warengruppen/strategien/${strategyId}/schritte/3/notiz`, {
        text: 'Mehrlagen tragen zwei Drittel des Umsatzes.',
      });
      expect((await states())[2]).toBe('done');
      // Start zeigt den nächsten offenen Schritt in derselben Liste wie alle Aufgaben.
      const due = dueListSchema.parse((await call(users.lead, 'GET', '/start/due')).body);
      expect(due.items).toContainEqual(
        expect.objectContaining({ kind: 'strategy', href: `/warengruppen/${group}/strategie/2` }),
      );
    });

    it('Jeder Schritt ist per Adresse erreichbar, auch wenn frühere Schritte offen sind', async () => {
      for (let n = 1; n <= 10; n += 1) {
        const content = await step(n);
        expect(content.step).toBe(n);
      }
      expect((await step(5)).questions.length).toBeGreaterThan(0);
      expect(
        (await call(users.lead, 'GET', `/warengruppen/strategien/${strategyId}/schritte/11`))
          .status,
      ).toBe(400);
      // Einkauf bearbeitet die Schritte 2 bis 9, nicht das Aufsetzen; Funktion nichts.
      expect(
        (
          await call(
            users.buyer,
            'PUT',
            `/warengruppen/strategien/${strategyId}/schritte/1/notiz`,
            { text: 'x' },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await call(users.fn, 'PUT', `/warengruppen/strategien/${strategyId}/schritte/4/notiz`, {
            text: 'x',
          })
        ).status,
      ).toBe(403);
      // Nicht zutreffend nur mit Begründung
      expect(
        (
          await call(
            users.buyer,
            'PUT',
            `/warengruppen/strategien/${strategyId}/schritte/4/notiz`,
            {
              text: '',
              notApplicable: true,
            },
          )
        ).status,
      ).toBe(400);
    });

    it('Ein Entwurf ist für Nutzer außerhalb des Teams nicht lesbar, eine freigegebene Strategie schon', async () => {
      const outside = await context(users.reader);
      expect(outside.context).toBeNull();
      expect(outside.hidden).toBe(true);
      expect(
        (await call(users.reader, 'GET', `/warengruppen/strategien/${strategyId}/schritte/1`))
          .status,
      ).toBe(404);
      // Team (auch Funktion) und Admin lesen den Entwurf.
      expect((await context(users.fn)).context?.role).toBe('function');
      expect((await context(users.admin)).context?.role).toBe('admin');
      await db.execute(
        sql`update material_group_strategy set status = 'approved' where id = ${strategyId}`,
      );
      expect((await context(users.reader)).context?.strategy.status).toBe('approved');
      expect(
        (await call(users.reader, 'GET', `/warengruppen/strategien/${strategyId}/schritte/1`))
          .status,
      ).toBe(200);
      // Freigegeben ist gesperrt, auch für den Lead.
      expect((await context(users.lead)).context?.editableSteps).toEqual([]);
      await db.execute(
        sql`update material_group_strategy set status = 'draft' where id = ${strategyId}`,
      );
      const overview = strategyOverviewSchema.parse(
        (await call(users.reader, 'GET', `/warengruppen/strategien?jahr=${year}`)).body,
      );
      expect(overview.groups.find((entry) => entry.id === group)).toMatchObject({
        hidden: true,
        strategy: null,
      });
    });

    it('Eine geänderte Leitfrage bei Kunde A ändert nichts bei Kunde B', async () => {
      const listA = questionListSchema.parse(
        (await call(users.admin, 'GET', '/warengruppen/leitfragen')).body,
      );
      const first = listA.questions.find((question) => question.step === 1);
      expect(first).toBeDefined();
      expect(
        (await call(users.lead, 'PATCH', `/warengruppen/leitfragen/${first?.id}`, { text: 'Neu' }))
          .status,
      ).toBe(403);
      await call(users.admin, 'PATCH', `/warengruppen/leitfragen/${first?.id}`, {
        text: 'Wer kauft was bei uns?',
      });
      const changed = questionListSchema.parse(
        (await call(users.admin, 'GET', '/warengruppen/leitfragen')).body,
      );
      expect(changed.questions.find((question) => question.id === first?.id)?.text).toBe(
        'Wer kauft was bei uns?',
      );
      const listB = questionListSchema.parse(
        (await call(users.adminB, 'GET', '/warengruppen/leitfragen')).body,
      );
      expect(listB.questions.find((question) => question.step === 1)?.text).toBe(first?.text);
      expect(listB.questions.some((question) => question.text === 'Wer kauft was bei uns?')).toBe(
        false,
      );
    });

    it('Der Test-Lieferant sieht keine Strategie', async () => {
      expect((await call(users.supplier, 'GET', `/warengruppen/${group}/strategie`)).status).toBe(
        403,
      );
      expect(
        (await call(users.supplier, 'GET', `/warengruppen/strategien/${strategyId}/schritte/1`))
          .status,
      ).toBe(403);
      expect(
        (await call(users.adminB, 'GET', `/warengruppen/strategien/${strategyId}/schritte/1`))
          .status,
      ).toBe(404);
    });
  });

  describe('WG-06', () => {
    const kpiOf = async (dimension: string) => {
      const list = kpiListSchema.parse(
        (await call(users.lead, 'GET', '/warengruppen/kennzahlen')).body,
      );
      return list.kpis.find((kpi) => kpi.dimension === dimension)?.id as string;
    };

    it('Ein Ziel ohne Kennzahl wird abgelehnt', async () => {
      const response = await call(
        users.buyer,
        'POST',
        `/warengruppen/strategien/${strategyId}/ziele`,
        {
          text: 'Kosten senken',
        },
      );
      expect(response.status).toBe(400);
      const unknownKpi = await call(
        users.buyer,
        'POST',
        `/warengruppen/strategien/${strategyId}/ziele`,
        {
          kpiId: randomUUID(),
          text: 'Kosten senken',
        },
      );
      expect(unknownKpi.status).toBe(400);
    });

    it('Zurückstellen ohne Begründung wird abgelehnt', async () => {
      const response = await call(
        users.buyer,
        'POST',
        `/warengruppen/strategien/${strategyId}/ziele`,
        {
          kpiId: await kpiOf('sustainability'),
          deferred: true,
        },
      );
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'reason_required' });
    });

    it('Schritt 2 ist fertig, wenn jede Dimension ein Ziel hat oder zurückgestellt ist und die Begründung steht', async () => {
      for (const [index, dimension] of goalDimensions.entries()) {
        const kpiId = await kpiOf(dimension);
        const body =
          index === 4
            ? { kpiId, deferred: true, deferredReason: 'Daten noch nicht belastbar' }
            : {
                kpiId,
                text: `Ziel ${dimension}`,
                actual: 82,
                targetNextYear: 90,
                targetFinal: 100,
                targetQuarter: 4,
                targetYear: 2028,
              };
        expect(
          (await call(users.buyer, 'POST', `/warengruppen/strategien/${strategyId}/ziele`, body))
            .status,
        ).toBe(201);
        if (index < 4) expect((await states())[1]).toBe('in_progress');
      }
      expect((await states())[1]).toBe('in_progress');
      await call(users.buyer, 'PUT', `/warengruppen/strategien/${strategyId}/schritte/2/notiz`, {
        text: 'Versorgung und Kosten stehen im Fokus.',
      });
      expect((await states())[1]).toBe('done');
      const goals = (await step(2)).goals;
      expect(goals).toHaveLength(5);
      expect(goals.find((goal) => goal.deferred)?.deferredReason).toBe(
        'Daten noch nicht belastbar',
      );
      expect(goals.find((goal) => goal.dimension === 'supply')).toMatchObject({
        actual: 82,
        targetFinal: 100,
      });
    });

    it('Eine neue Kennzahl bei Kunde A erscheint nicht bei Kunde B', async () => {
      expect(
        (
          await call(users.lead, 'POST', '/warengruppen/kennzahlen', {
            dimension: 'cost',
            name: 'Werkzeugkosten',
          })
        ).status,
      ).toBe(403);
      const created = kpiListSchema.parse(
        (
          await call(users.admin, 'POST', '/warengruppen/kennzahlen', {
            dimension: 'cost',
            name: 'Werkzeugkosten',
            unit: '€',
          })
        ).body,
      );
      expect(created.kpis.some((kpi) => kpi.name === 'Werkzeugkosten')).toBe(true);
      expect(created.kpis.filter((kpi) => kpi.dimension === 'cost')).toHaveLength(3);
      const other = kpiListSchema.parse(
        (await call(users.adminB, 'GET', '/warengruppen/kennzahlen')).body,
      );
      expect(other.kpis.some((kpi) => kpi.name === 'Werkzeugkosten')).toBe(false);
      expect(other.kpis).toHaveLength(10);
    });

    it('Der Test-Lieferant sieht keine Ziele der Warengruppe', async () => {
      expect((await call(users.supplier, 'GET', '/warengruppen/kennzahlen')).status).toBe(403);
      expect(
        (
          await call(users.supplier, 'POST', `/warengruppen/strategien/${strategyId}/ziele`, {
            kpiId: randomUUID(),
            text: 'x',
          })
        ).status,
      ).toBe(403);
    });
  });
});
