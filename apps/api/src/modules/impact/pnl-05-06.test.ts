import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import {
  dueListSchema,
  impactDetailSchema,
  impactImportPreviewSchema,
  validationDetailSchema,
  validationListSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PNL-05.md und PNL-06.md: Monatswerte mit Import, Beträge nur aus der Rechnung
// (je Hebel), der Lieferant sieht weder Mengen noch Preise; Freigabe nur durch Controlling, sperrt
// den Zeitraum und erlaubt R5; Zurückweisen mit Begründung benachrichtigt den SRO.
describe('PNL-05 und PNL-06 Monatswerte und Freigabe', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = {
    sro: `pnl05-sro-${run}`,
    admin: `pnl05-admin-${run}`,
    controller: `pnl05-ctl-${run}`,
    kam: `pnl05-kam-${run}`,
  };
  const impact = `/suppliers/${rel}/wirkung`;
  let price = '';
  let validationId = '';

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
  const upload = async (url: string, csv: string) => {
    const form = new FormData();
    form.append('file', new Blob([csv], { type: 'text/csv' }), 'monate.csv');
    const response = await fetch(`${testApp.baseUrl}/api${url}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: users.sro })}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as unknown };
  };
  /** Initiative mit Wirkung und eingefrorener Baseline. */
  const prepare = async (title: string, lever: string, effectType: string, baseline: object) => {
    const id = (
      (
        await call(users.sro, 'POST', `/suppliers/${rel}/jbp/initiativen`, {
          title,
          goal: 'Ziel',
          benefitBuyer: 'A',
          benefitSupplier: 'B',
          ownerBuyerName: 'Sara Ost',
          ownerSupplierName: 'Kim Kaiser',
          startsOn: '2099-01-01',
          endsOn: '2099-12-31',
        })
      ).body as { initiative: { id: string } }
    ).initiative.id;
    await call(users.sro, 'PUT', `${impact}/initiativen/${id}/einrichten`, {
      lever,
      pnlLineKey: 'material',
      effectType,
      effectiveFrom: null,
    });
    await call(users.sro, 'POST', `${impact}/initiativen/${id}/baseline`, {
      inputs: baseline,
      changeReason: null,
    });
    return id;
  };
  const detail = async (id: string) =>
    impactDetailSchema.parse((await call(users.sro, 'GET', `${impact}/initiativen/${id}`)).body);

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `PNL5-OEM ${run}` },
      { id: orgs.supplier, name: `PNL5-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const person = (
      id: string,
      name: string,
      organizationId: string,
      orgRole: 'admin' | 'member' | 'viewer',
      isControlling = false,
    ) => ({
      id,
      name,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      isControlling,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.sro, 'Sara Ost', orgs.oem, 'member'),
        person(users.admin, 'Ada Admin', orgs.oem, 'admin'),
        person(users.controller, 'Carla Controlling', orgs.oem, 'viewer', true),
        person(users.kam, 'Kim Kaiser', orgs.supplier, 'admin'),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db
      .insert(schema.relationshipMember)
      .values({ relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' });
    const plan = (
      await call(users.sro, 'POST', `/suppliers/${rel}/jbp`, {
        startsAt: '2099-01-15T09:00:00Z',
        location: null,
        locale: 'de',
      })
    ).body as { meeting: { id: string } };
    await db.insert(schema.meetingDecision).values({
      meetingId: plan.meeting.id,
      relationshipId: rel,
      ownerOrgId: orgs.oem,
      visibility: 'shared',
      text: 'Preis senken',
      position: 1,
    });
    price = await prepare('Preis Leiterplatten', 'price', 'ebit', { price_old: '1234' });
  });

  afterAll(async () => {
    await db.execute(sql`delete from jbp where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting where relationship_id = ${rel}`);
    await db.execute(sql`delete from pnl_line where org_id = ${orgs.oem}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  describe('PNL-05 Monatswerte', () => {
    it('zwölf Monatswerte lassen sich in einem Schritt importieren', async () => {
      const header = 'Monat;Art;price_new;quantity';
      const rows = Array.from(
        { length: 12 },
        (_, index) => `2099-${String(index + 1).padStart(2, '0')};Ist;12,00;${100 + index}`,
      );
      const bad = [
        header,
        ...rows,
        '2099-13;Ist;12,00;1',
        '2099-01;Prognose;12,00;1',
        '2099-02;Plan;zwölf;1',
      ].join('\n');
      const preview = impactImportPreviewSchema.parse(
        (await upload(`${impact}/initiativen/${price}/import/vorschau`, bad)).body,
      );
      expect(preview).toMatchObject({ valid: 12, invalid: 3 });
      expect(preview.rows.slice(12).map((row) => row.errors)).toEqual([
        ['monat_ungueltig'],
        ['art_ungueltig'],
        ['eingabe_ungueltig'],
      ]);
      expect((await upload(`${impact}/initiativen/${price}/import`, bad)).status).toBe(400);
      const applied = await upload(
        `${impact}/initiativen/${price}/import`,
        [header, ...rows].join('\n'),
      );
      expect(applied.status).toBe(201);
      const result = await detail(price);
      expect(result.months).toHaveLength(12);
      // (12,34 € − 12,00 €) × 100 = 34,00 €; Summe über 100 bis 111 Stück.
      expect(result.months[0]?.actual?.amountCents).toBe(3400);
      expect(result.totals.actual).toBe(34 * (100 + 111) * 6);
    });

    it('jeder Betrag entspricht der Rechenregel mit Baseline und Eingaben, je Hebel', async () => {
      const cases = [
        [
          'cost_avoidance',
          'cost_avoidance',
          { price_requested: '5000' },
          { price_agreed: '4800', quantity: '10' },
          2000,
        ],
        [
          'quality',
          'ebit',
          { defects_before: '40', cost_per_defect: '12550' },
          { defects_after: '12.5' },
          345_125,
        ],
        [
          'logistics',
          'ebit',
          { unit_cost_before: '310' },
          { unit_cost_after: '285', quantity: '1200' },
          30_000,
        ],
        [
          'working_capital',
          'cash',
          { inventory_before: '50000000' },
          { inventory_after: '42000000' },
          8_000_000,
        ],
        [
          'innovation',
          'ebit',
          { margin_rate: '0.235' },
          { additional_revenue: '1000001' },
          235_000,
        ],
        ['risk', 'strategic', { probability: '0.15' }, { avoided_damage: '3333333' }, 500_000],
      ] as const;
      for (const [lever, effect, baseline, month, expected] of cases) {
        const id = await prepare(`Hebel ${lever}`, lever, effect, baseline);
        const saved = impactDetailSchema.parse(
          (
            await call(users.sro, 'POST', `${impact}/initiativen/${id}/monate`, {
              month: '2099-03',
              kind: 'plan',
              inputs: month,
            })
          ).body,
        );
        expect(saved.months[0]?.plan?.amountCents, lever).toBe(expected);
        expect(saved.totals.plan, lever).toBe(expected);
      }
    });

    it('initiative_value lässt sich nicht direkt schreiben, nur durch die Rechnung', async () => {
      const write = await withTenant(db, { userId: users.sro, organizationId: orgs.oem }, (tx) =>
        tx.execute(
          sql`insert into initiative_value (relationship_id, owner_org_id, initiative_id, month, kind, value_cents, effect_type)
              values (${rel}, ${orgs.oem}, ${price}, '2099-01-01', 'actual', 999999, 'ebit')`,
        ),
      ).catch((error: unknown) => error);
      expect(write).toBeInstanceOf(Error);
      const update = await withTenant(db, { userId: users.sro, organizationId: orgs.oem }, (tx) =>
        tx.execute(sql`update initiative_value set value_cents = 1 where initiative_id = ${price}`),
      ).catch((error: unknown) => error);
      expect(update).toBeInstanceOf(Error);
      // Auch der Lieferant kann die Rechnung nicht auslösen.
      const foreign = await withTenant(
        db,
        { userId: users.kam, organizationId: orgs.supplier, customerOrganizationId: orgs.oem },
        (tx) => tx.execute(sql`select app_initiative_recompute(${price})`),
      ).catch((error: unknown) => error);
      expect(foreign).toBeInstanceOf(Error);
    });

    it('der Lieferant sieht weder Mengen noch Preise', async () => {
      const seen = await withTenant(
        db,
        { userId: users.kam, organizationId: orgs.supplier, customerOrganizationId: orgs.oem },
        async (tx) => ({
          inputs: (
            await tx.execute<{ count: number }>(
              sql`select count(*)::int as count from initiative_input_month where relationship_id = ${rel}`,
            )
          ).rows[0]?.count,
          values: (
            await tx.execute<{ count: number }>(
              sql`select count(*)::int as count from initiative_value where relationship_id = ${rel}`,
            )
          ).rows[0]?.count,
        }),
      );
      expect(seen).toEqual({ inputs: 0, values: 0 });
      expect((await call(users.kam, 'GET', `${impact}/initiativen/${price}`)).status).toBe(403);
    });
  });

  describe('PNL-06 Freigabe durch Controlling', () => {
    it('ohne Freigabe gibt es kein R5; anfordern erst ab R4 mit Ist-Werten', async () => {
      const raise = (body: object) =>
        call(users.sro, 'POST', `${impact}/initiativen/${price}/reifegrad`, {
          decisionId: null,
          implementedOn: null,
          evidence: null,
          evidenceLink: null,
          ...body,
        });
      const request = { periodFrom: '2099-01', periodTo: '2099-03' };
      expect(
        (await call(users.sro, 'POST', `${impact}/initiativen/${price}/freigabe`, request)).body,
      ).toMatchObject({ code: 'erst_ab_r4' });
      await raise({ toLevel: 2 });
      const decisions = (await detail(price)).next?.decisions ?? [];
      await raise({ toLevel: 3, decisionId: decisions[0]?.id });
      await raise({ toLevel: 4, implementedOn: '2099-01-01', evidence: 'Neuer Preis' });
      expect((await raise({ toLevel: 5 })).body).toMatchObject({ code: 'nur_ueber_freigabe' });
      expect(
        (
          await call(users.sro, 'POST', `${impact}/initiativen/${price}/freigabe`, {
            periodFrom: '2098-01',
            periodTo: '2098-03',
          })
        ).body,
      ).toMatchObject({ code: 'keine_ist_werte' });
      const requested = impactDetailSchema.parse(
        (await call(users.sro, 'POST', `${impact}/initiativen/${price}/freigabe`, request)).body,
      );
      validationId = requested.validations[0]?.id as string;
      expect(requested.validations[0]).toMatchObject({
        status: 'requested',
        periodFrom: '2099-01-01',
      });
      expect(requested.maturity.level).toBe(4);
      // Controlling bekommt Mail und Aufgabe auf Start.
      const due = dueListSchema.parse((await call(users.controller, 'GET', '/start/due')).body);
      expect(due.items.find((item) => item.kind === 'validation')?.href).toBe(
        `/wirkung/freigaben/${validationId}`,
      );
      const mails = await db.execute<{ count: number }>(
        sql`select count(*)::int as count from outbox_event where email_recipient = ${`${users.controller}@example.com`}`,
      );
      expect(mails.rows[0]?.count).toBe(1);
    });

    it('die Prüfseite zeigt den vollständigen Rechenweg', async () => {
      const review = validationDetailSchema.parse(
        (await call(users.controller, 'GET', `/wirkung/freigaben/${validationId}`)).body,
      );
      expect(review.impact).toMatchObject({
        lever: 'price',
        leverTemplateVersion: 1,
        effectType: 'ebit',
      });
      expect(review.baseline?.inputs).toEqual({ price_old: '1234' });
      expect(
        review.months.map((month) => [
          month.month,
          month.actual?.inputs.quantity,
          month.actual?.amountCents,
        ]),
      ).toEqual([
        ['2099-01-01', '100', 3400],
        ['2099-02-01', '101', 3434],
        ['2099-03-01', '102', 3468],
      ]);
      expect(review.totals.actual).toBe(3400 + 3434 + 3468);
      expect(review.maturity.steps.map((step) => step.toLevel)).toEqual([2, 3, 4]);
      expect(review.canDecide).toBe(true);
      const list = validationListSchema.parse(
        (await call(users.sro, 'GET', '/wirkung/freigaben')).body,
      );
      expect(list).toMatchObject({ canDecide: false });
      expect(list.validations.map((entry) => entry.id)).toContain(validationId);
    });

    it('nur Nutzer mit Zusatzrolle Controlling geben frei, alle anderen bekommen 403', async () => {
      for (const user of [users.sro, users.admin, users.kam]) {
        const denied = await call(user, 'POST', `/wirkung/freigaben/${validationId}/entscheiden`, {
          decision: 'approved',
          comment: null,
        });
        expect(denied.status, user).toBe(403);
      }
    });

    it('die Freigabe sperrt die Monatswerte des Zeitraums und gibt R5', async () => {
      const approved = validationDetailSchema.parse(
        (
          await call(users.controller, 'POST', `/wirkung/freigaben/${validationId}/entscheiden`, {
            decision: 'approved',
            comment: null,
          })
        ).body,
      );
      expect(approved.validation.status).toBe('approved');
      expect(approved.maturity.level).toBe(5);
      expect(approved.months.every((month) => month.locked)).toBe(true);
      const locked = await call(users.sro, 'POST', `${impact}/initiativen/${price}/monate`, {
        month: '2099-02',
        kind: 'actual',
        inputs: { price_new: '1000', quantity: '1' },
      });
      expect(locked).toMatchObject({ status: 409, body: { code: 'monat_gesperrt' } });
      // Eine neue Baseline ändert gesperrte Monate nicht, offene schon.
      const after = impactDetailSchema.parse(
        (
          await call(users.sro, 'POST', `${impact}/initiativen/${price}/baseline`, {
            inputs: { price_old: '1300' },
            changeReason: 'Korrektur',
          })
        ).body,
      );
      expect(after.months[0]?.actual?.amountCents).toBe(3400);
      expect(after.months[3]?.actual?.amountCents).toBe((1300 - 1200) * 103);
      // Der Lieferant sieht nur „realisiert und bestätigt“, keine Details der Prüfung.
      const shared = (await call(users.kam, 'GET', `/kunden/${rel}/jbp/initiativen/${price}`))
        .body as {
        maturity: { level: number; steps: { evidence: string }[] };
      };
      expect(shared.maturity.level).toBe(5);
      expect(shared.maturity.steps.at(-1)?.evidence).toBe(
        'Realisiert und durch Controlling bestätigt',
      );
      expect(JSON.stringify(shared)).not.toContain('2099-01 – 2099-03');
    });

    it('Zurückweisen verlangt eine Begründung und benachrichtigt den SRO', async () => {
      const id = await prepare('Logistik Kanban', 'logistics', 'ebit', { unit_cost_before: '310' });
      await call(users.sro, 'POST', `${impact}/initiativen/${id}/monate`, {
        month: '2099-05',
        kind: 'actual',
        inputs: { unit_cost_after: '290', quantity: '100' },
      });
      await db.insert(schema.maturityStep).values(
        [1, 2, 3].map((level) => ({
          relationshipId: rel,
          ownerOrgId: orgs.oem,
          visibility: 'shared' as const,
          initiativeId: id,
          fromLevel: level,
          toLevel: level + 1,
          evidence: 'Test',
          decidedBy: users.sro,
          decidedByName: 'Sara Ost',
          decidedAt: new Date(Date.now() + level * 1000),
        })),
      );
      const requested = impactDetailSchema.parse(
        (
          await call(users.sro, 'POST', `${impact}/initiativen/${id}/freigabe`, {
            periodFrom: '2099-05',
            periodTo: '2099-05',
          })
        ).body,
      );
      const open = requested.validations[0]?.id as string;
      const without = await call(
        users.controller,
        'POST',
        `/wirkung/freigaben/${open}/entscheiden`,
        {
          decision: 'rejected',
          comment: ' ',
        },
      );
      expect(without.status).toBe(400);
      const rejected = validationDetailSchema.parse(
        (
          await call(users.controller, 'POST', `/wirkung/freigaben/${open}/entscheiden`, {
            decision: 'rejected',
            comment: 'Menge nicht belegt',
          })
        ).body,
      );
      expect(rejected.validation).toMatchObject({
        status: 'rejected',
        comment: 'Menge nicht belegt',
      });
      expect(rejected.maturity.level).toBe(4);
      const mails = await db.execute<{ title: string }>(
        sql`select email_title as title from outbox_event where email_recipient = ${`${users.sro}@example.com`}`,
      );
      expect(mails.rows.map((row) => row.title)).toContain(
        'Wirkung zurückgewiesen: Logistik Kanban',
      );
    });
  });
});
