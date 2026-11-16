import { randomUUID } from 'node:crypto';
import { type Database, eq, schema, sql } from '@reziproq/db';
import {
  cycleSchema,
  cycleSettingsResponseSchema,
  defaultCycleSettings,
  dueListSchema,
  type OrgRole,
  offsetCycleDate,
  supplierOverviewSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { CycleReminderService } from '../email/cycle-reminder.service.js';

describe('ZYK-02: Termine, Fälligkeiten und Erinnerungen', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgId = randomUUID();
  const supplierOrgId = randomUUID();
  const relationshipId = randomUUID();
  const users = {
    admin: `zyk02-admin-${run}`,
    sro: `zyk02-sro-${run}`,
    member: `zyk02-member-${run}`,
  };

  const call = async (user: string, method: string, path: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: response.status,
      body: (await response.json().catch(() => null)) as unknown,
    };
  };

  const setDate = async (user: string, jbpDate: string) =>
    call(user, 'PUT', `/suppliers/${relationshipId}/cycle/jbp-date`, { jbpDate });

  const ensureCycle = async () => {
    const response = await call(users.sro, 'POST', `/suppliers/${relationshipId}/cycle`);
    expect([200, 201]).toContain(response.status);
    return cycleSchema.parse(response.body);
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgId, name: `ZYK-02 Käufer ${run}` },
      { id: supplierOrgId, name: `ZYK-02 Lieferant ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values({ organizationId: orgId, feature: 'buyer' });
    const person = (id: string, orgRole: OrgRole, locale: 'de' | 'en' = 'de') => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId: orgId,
      orgRole,
      locale,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.admin, 'admin'),
        person(users.sro, 'member', 'en'),
        person(users.member, 'member'),
      ]);
    await insertRelationships(db, [{ id: relationshipId, buyer: orgId, supplier: supplierOrgId }]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId, orgId, userId: users.sro, teamRole: 'sro' },
      { relationshipId, orgId, userId: users.member, teamRole: 'member' },
    ]);
    await db.insert(schema.relationshipSide).values({ relationshipId, orgId, isFocus: true });
  });

  afterAll(async () => {
    await db
      .delete(schema.cycleReminderSent)
      .where(eq(schema.cycleReminderSent.relationshipId, relationshipId));
    await db.delete(schema.cycle).where(eq(schema.cycle.relationshipId, relationshipId));
    await db.delete(schema.cycleSetting).where(eq(schema.cycleSetting.orgId, orgId));
    await db.delete(schema.outboxEvent).where(eq(schema.outboxEvent.orgId, orgId));
    await deleteRelationships(db, [orgId, supplierOrgId]);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${[orgId, supplierOrgId]}`);
    await testApp.close();
  });

  it('berechnet alle Fristen aus dem JBP-Termin und verschiebt sie ohne Fristspeicherung', async () => {
    await ensureCycle();
    const first = cycleSchema.parse((await setDate(users.sro, '2027-06-30')).body);
    expect(first.schedule.map(({ step, dueDate }) => [step, dueDate])).toEqual([
      ['feedback', '2027-05-05'],
      ['touchpoints', '2027-05-19'],
      ['supplierPlan', '2027-06-16'],
      ['jbp', '2027-06-30'],
      ['scorecard', '2027-07-21'],
    ]);

    const shifted = cycleSchema.parse((await setDate(users.sro, '2027-07-14')).body);
    expect(shifted.schedule.map(({ dueDate }) => dueDate)).toEqual([
      '2027-05-19',
      '2027-06-02',
      '2027-06-30',
      '2027-07-14',
      '2027-08-04',
    ]);
    const stored = await db
      .select({ jbpDate: schema.cycle.jbpDate })
      .from(schema.cycle)
      .where(eq(schema.cycle.relationshipId, relationshipId));
    expect(stored).toEqual([{ jbpDate: '2027-07-14' }]);
  });

  it('sendet am Erinnerungstag genau eine Mail mit Titel und internem Link an den SRO', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await ensureCycle();
    await setDate(users.sro, offsetCycleDate(today, 63));
    const reminders = testApp.app.get(CycleReminderService);

    expect(await reminders.processOrganization(orgId, today)).toBe(1);
    expect(await reminders.processOrganization(orgId, today)).toBe(0);

    const events = await db
      .select()
      .from(schema.outboxEvent)
      .where(
        sql`${schema.outboxEvent.orgId} = ${orgId} and ${schema.outboxEvent.eventType} = 'email.reminder'`,
      );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      emailLocale: 'en',
      emailRecipient: `${users.sro}@example.com`,
      emailTitle: 'Feedback',
      emailLink: `/lieferanten/${relationshipId}`,
      emailDeadline: null,
      emailFirstName: null,
    });
  });

  it('zeigt überfällige Schritte in der Zyklus-Leiste und auf Start', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await ensureCycle();
    await setDate(users.sro, offsetCycleDate(today, -56));

    const overviewResponse = await call(users.sro, 'GET', `/suppliers/${relationshipId}/overview`);
    const overview = supplierOverviewSchema.parse(overviewResponse.body);
    expect(overview.cycle?.steps.filter((step) => step.status === 'overdue')).toHaveLength(5);

    const dueResponse = await call(users.sro, 'GET', '/start/due');
    const overdue = dueListSchema
      .parse(dueResponse.body)
      .items.filter((item) => item.kind === 'cycle');
    expect(overdue).toHaveLength(5);
    expect(overdue.every((item) => item.href === `/lieferanten/${relationshipId}`)).toBe(true);
  });

  it('liefert Defaults aus und erlaubt nur Admins, Vorlaufzeiten zu ändern', async () => {
    const defaults = cycleSettingsResponseSchema.parse(
      (await call(users.admin, 'GET', '/cycle/settings')).body,
    );
    expect(defaults.settings).toEqual(defaultCycleSettings);
    expect((await call(users.sro, 'GET', '/cycle/settings')).status).toBe(403);

    const settings = structuredClone(defaultCycleSettings);
    settings[0] = { step: 'feedback', weeksRelativeToJbp: -9, reminderDaysBefore: 5 };
    const body = { settings };
    expect((await call(users.sro, 'PUT', '/cycle/settings', body)).status).toBe(403);
    const saved = await call(users.admin, 'PUT', '/cycle/settings', body);
    expect(cycleSettingsResponseSchema.parse(saved.body).settings[0]).toEqual(settings[0]);
  });

  it('lässt nur Admin und SRO den JBP-Termin setzen', async () => {
    await ensureCycle();
    expect((await setDate(users.member, '2027-06-30')).status).toBe(403);
    expect((await setDate(users.admin, '2027-06-30')).status).toBe(200);
  });
});
