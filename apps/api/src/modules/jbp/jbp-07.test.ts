import { createHash, randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  calculateCycleDeadlines,
  defaultCycleSettings,
  dueListSchema,
  offsetCycleDate,
  scorecardViewSchema,
  supplierOverviewSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { CycleReminderService } from '../email/cycle-reminder.service.js';

// Tests zu docs/specs/JBP-07.md: höchstens zehn Kennzahlen, jede vollständig; gültig erst mit
// beiden Unterschriften, danach gesperrt; Erinnerung an die Seite, die noch fehlt; Zyklus-Schritt.
describe('JBP-07 Scorecard und Unterschrift', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const cycleId = randomUUID();
  const users = { sro: `jbp07-sro-${run}`, kam: `jbp07-kam-${run}` };
  const buyer = `/suppliers/${rel}/jbp/scorecard`;
  const supplier = `/kunden/${rel}/jbp/scorecard`;
  const supplierMail = `kim-${run}@lieferant.example`;
  const jbpDate = offsetCycleDate(new Date().toISOString().slice(0, 10), 120);

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
  const view = async (user: string, base: string) =>
    scorecardViewSchema.parse((await call(user, 'GET', base)).body);
  const kpi = (name: string, ownerUserId: string) => ({
    name,
    unit: '%',
    direction: 'higher',
    baseline: '91.5',
    target: '98',
    targetDate: '2099-12-31',
    ownerUserId,
    benefitFor: 'both',
    initiativeId: null,
  });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `JBP7-OEM ${run}` },
      { id: orgs.supplier, name: `JBP7-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    await db.insert(schema.appUser).values([
      {
        id: users.sro,
        name: 'Sara Ost',
        email: `${users.sro}@example.com`,
        organizationId: orgs.oem,
        orgRole: 'member',
        rolesImportedAt: new Date(),
      },
      {
        id: users.kam,
        name: 'Kim Kaiser',
        email: `${users.kam}@example.com`,
        organizationId: orgs.supplier,
        orgRole: 'admin',
        rolesImportedAt: new Date(),
      },
    ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db
      .insert(schema.relationshipMember)
      .values({ relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' });
    await db
      .insert(schema.relationshipSide)
      .values({ relationshipId: rel, orgId: orgs.oem, isFocus: true, focusReason: 'Test' });
    await db.insert(schema.invitation).values({
      relationshipId: rel,
      orgId: orgs.oem,
      email: supplierMail,
      tokenHash: createHash('sha256').update(`jbp07-${run}`).digest('hex'),
      invitedBy: users.sro,
      expiresAt: new Date(Date.now() + 86_400_000),
      acceptedAt: new Date(),
      acceptedUserId: users.kam,
    });
    await db
      .insert(schema.cycle)
      .values({ id: cycleId, relationshipId: rel, label: '2099', status: 'active', jbpDate });
    await call(users.sro, 'POST', `/suppliers/${rel}/jbp`, {
      startsAt: `${jbpDate}T09:00:00Z`,
      location: null,
      locale: 'de',
    });
  });

  afterAll(async () => {
    await db.execute(sql`delete from jbp where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting where relationship_id = ${rel}`);
    await db.execute(sql`delete from invitation where relationship_id = ${rel}`);
    await db.execute(sql`delete from cycle_reminder_sent where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('jede Kennzahl braucht Ziel, Termin, Verantwortliche und „Nutzen für“', async () => {
    for (const missing of ['target', 'targetDate', 'ownerUserId', 'benefitFor'] as const) {
      const { [missing]: _, ...rest } = kpi('Liefertreue', users.sro);
      expect((await call(users.sro, 'POST', `${buyer}/kennzahlen`, rest)).status).toBe(400);
    }
    // Eine Person der anderen Seite ist nicht wählbar.
    expect(
      (await call(users.sro, 'POST', `${buyer}/kennzahlen`, kpi('Liefertreue', users.kam))).status,
    ).toBe(400);
  });

  it('eine elfte Kennzahl wird abgelehnt', async () => {
    for (let index = 1; index <= 6; index += 1) {
      expect(
        (await call(users.sro, 'POST', `${buyer}/kennzahlen`, kpi(`Käufer ${index}`, users.sro)))
          .status,
      ).toBe(201);
    }
    for (let index = 1; index <= 4; index += 1) {
      expect(
        (
          await call(
            users.kam,
            'POST',
            `${supplier}/kennzahlen`,
            kpi(`Lieferant ${index}`, users.kam),
          )
        ).status,
      ).toBe(201);
    }
    const eleventh = await call(users.kam, 'POST', `${supplier}/kennzahlen`, kpi('Elf', users.kam));
    expect(eleventh).toMatchObject({ status: 409, body: { code: 'zu_viele_kennzahlen' } });
    const own = await view(users.kam, supplier);
    expect(own.kpis).toHaveLength(10);
    expect(own.kpis.filter((entry) => entry.own)).toHaveLength(4);
  });

  it('vor Fristende geht die Erinnerung an die Seite, die noch nicht unterschrieben hat', async () => {
    expect((await call(users.sro, 'POST', `${buyer}/unterschreiben`)).status).toBe(201);
    const step = calculateCycleDeadlines(jbpDate, defaultCycleSettings).find(
      (entry) => entry.step === 'scorecard',
    );
    const today = offsetCycleDate(step?.dueDate as string, -(step?.reminderDaysBefore ?? 0));
    await testApp.app.get(CycleReminderService).processOrganization(orgs.oem, today);
    const reminders = await db.execute<{ recipient: string; link: string }>(
      sql`select email_recipient as recipient, email_link as link from outbox_event
          where event_type = 'email.reminder' and email_recipient in (${supplierMail}, ${`${users.sro}@example.com`})`,
    );
    expect(reminders.rows).toEqual([
      { recipient: supplierMail, link: `/kunden/${rel}/plan/scorecard/unterschreiben` },
    ]);
  });

  it('die Scorecard gilt erst mit beiden Unterschriften; danach ist die Version gesperrt', async () => {
    const half = await view(users.sro, buyer);
    expect(half).toMatchObject({ status: 'draft', canSign: false });
    expect(half.signatures.map((entry) => entry.side)).toEqual(['buyer']);
    // Der Lieferant hat die Aufgabe auf Start.
    const due = dueListSchema.parse((await call(users.kam, 'GET', '/start/due')).body);
    expect(due.items.find((item) => item.kind === 'signature')?.href).toBe(
      `/kunden/${rel}/plan/scorecard/unterschreiben`,
    );
    const signed = scorecardViewSchema.parse(
      (await call(users.kam, 'POST', `${supplier}/unterschreiben`)).body,
    );
    expect(signed.status).toBe('signed');
    const own = signed.kpis.find((entry) => entry.own) as { id: string };
    expect(
      (await call(users.kam, 'PUT', `${supplier}/kennzahlen/${own.id}`, kpi('Neu', users.kam)))
        .status,
    ).toBe(409);
    expect(
      (await call(users.sro, 'POST', `${buyer}/kennzahlen`, kpi('Spät', users.sro))).status,
    ).toBe(409);
  });

  it('beide Unterschriften erledigen den Zyklus-Schritt Scorecard', async () => {
    const overview = supplierOverviewSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel}/overview`)).body,
    );
    expect(overview.cycle?.steps.find((step) => step.key === 'scorecard')).toMatchObject({
      status: 'completed',
      href: `/lieferanten/${rel}/plan/scorecard`,
    });
  });

  it('eine Änderung nach einer Unterschrift ergibt eine neue Version mit neuer Unterschrift', async () => {
    const next = scorecardViewSchema.parse(
      (await call(users.sro, 'POST', `${buyer}/neue-version`)).body,
    );
    expect(next).toMatchObject({ status: 'draft', version: 2, signatures: [] });
    await call(users.sro, 'POST', `${buyer}/unterschreiben`);
    const own = (await view(users.kam, supplier)).kpis.find((entry) => entry.own) as {
      id: string;
    };
    // Der Lieferant ändert eine Kennzahl: Die Unterschrift des Käufers gilt nicht mehr.
    await call(users.kam, 'PUT', `${supplier}/kennzahlen/${own.id}`, kpi('Geändert', users.kam));
    const revised = await view(users.sro, buyer);
    expect(revised).toMatchObject({ version: 3, signatures: [], canSign: true });
  });
});
