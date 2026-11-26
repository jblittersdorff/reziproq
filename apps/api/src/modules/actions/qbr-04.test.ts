import { randomUUID } from 'node:crypto';
import { type Database, inArray, schema, sql } from '@reziproq/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { ActionReminderService } from '../email/action-reminder.service.js';
import { insertWorkItems } from '../../testing/work-items.js';

// Tests zu docs/specs/QBR-04.md: Erinnerung an den eingestellten Tagen vor der Frist, Eskalation
// genau am Tag danach, beides einmal; Erledigte und Abgebrochene lösen nichts aus; interne
// Maßnahmen nur an die eigene Seite. Das Datum ist vorgegeben, es gibt keine Wartezeit.
describe('QBR-04 Erinnerung und Eskalation', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  let reminders: ActionReminderService;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const today = '2099-06-10';
  const users = {
    sro: `qbr04-sro-${run}`,
    anna: `qbr04-anna-${run}`,
    kam: `qbr04-kam-${run}`,
    lea: `qbr04-lea-${run}`,
    admin: `qbr04-admin-${run}`,
  };
  const mail = (user: string) => `${user}@example.com`;

  const action = (
    title: string,
    dueDate: string,
    options: {
      side?: 'buyer' | 'supplier';
      owner?: string | null;
      status?: 'open' | 'in_progress' | 'done' | 'cancelled';
      visibility?: 'internal' | 'shared';
      ownerOrg?: string;
    } = {},
  ) => {
    const side = options.side ?? 'buyer';
    return {
      relationshipId: rel,
      ownerOrgId: options.ownerOrg ?? (side === 'buyer' ? orgs.oem : orgs.supplier),
      visibility: options.visibility ?? 'shared',
      title,
      ownerSide: side,
      ownerUserId:
        options.owner === undefined ? (side === 'buyer' ? users.anna : users.lea) : options.owner,
      ownerName: 'Person',
      dueDate,
      status: options.status ?? 'open',
      sourceType: 'manual' as const,
      createdBy: users.sro,
      createdByName: 'Sara Ost',
    };
  };

  const sent = async () =>
    (
      await db
        .select({
          to: schema.outboxEvent.emailRecipient,
          template: schema.outboxEvent.emailTemplate,
          title: schema.outboxEvent.emailTitle,
          deadline: schema.outboxEvent.emailDeadline,
          link: schema.outboxEvent.emailLink,
        })
        .from(schema.outboxEvent)
        .where(
          sql`${inArray(schema.outboxEvent.orgId, Object.values(orgs))} and ${schema.outboxEvent.emailTemplate} is not null`,
        )
    )
      .map((row) => `${row.template} ${row.title} → ${row.to}`)
      .sort();

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    reminders = testApp.app.get(ActionReminderService);
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `QBR4-OEM ${run}` },
      { id: orgs.supplier, name: `QBR4-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const user = (
      id: string,
      name: string,
      organizationId: string,
      orgRole: 'admin' | 'member',
    ) => ({
      id,
      name,
      email: mail(id),
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        user(users.sro, 'Sara Ost', orgs.oem, 'member'),
        user(users.anna, 'Anna Berg', orgs.oem, 'member'),
        user(users.kam, 'Kim Kaiser', orgs.supplier, 'member'),
        user(users.lea, 'Lea Lang', orgs.supplier, 'member'),
        user(users.admin, 'Ole Admin', orgs.supplier, 'admin'),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' },
      { relationshipId: rel, orgId: orgs.supplier, userId: users.kam, teamRole: 'sro' },
    ]);
    // ZQ-01 (K2-a.3): als Zusagen und Aufgaben, wie die Migration die Maßnahmen abbildet
    await insertWorkItems(db, [
      action('Erinnern', '2099-06-13'),
      action('Eskalieren', '2099-06-09'),
      action('Erledigt', '2099-06-13', { status: 'done' }),
      action('Abgebrochen', '2099-06-09', { status: 'cancelled' }),
      action('Zu früh eskaliert', '2099-06-08'),
      action('Lieferant eskaliert', '2099-06-09', { side: 'supplier' }),
      action('Lieferant erinnert', '2099-06-15', { side: 'supplier' }),
      action('Lieferant nicht erinnert', '2099-06-13', { side: 'supplier' }),
      action('Intern beim Käufer', '2099-06-09', { visibility: 'internal' }),
      // Interne Maßnahme des Käufers, die er dem Lieferanten zuschreibt: niemand beim Lieferanten
      // sieht sie, also schreibt ihm auch niemand. Seit ZQ-01 (K2-a.3) eine Aufgabe des Käufers.
      action('Intern für den Lieferanten', '2099-06-09', {
        side: 'supplier',
        owner: null,
        visibility: 'internal',
        ownerOrg: orgs.oem,
      }),
    ]);
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    await db.delete(schema.outboxEvent).where(inArray(schema.outboxEvent.orgId, orgIds));
    await db.execute(sql`delete from reminder_sent where org_id in ${orgIds}`);
    await db.execute(sql`delete from org_setting where org_id in ${orgIds}`);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('Admins beider Seiten stellen die Erinnerungstage ihrer Organisation ein', async () => {
    const put = async (user: string, reminderDays: number) =>
      fetch(`${testApp.baseUrl}/api/massnahmen/einstellungen`, {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ reminderDays }),
      });
    expect((await put(users.lea, 5)).status).toBe(403);
    expect((await put(users.admin, 0)).status).toBe(400);
    const response = await put(users.admin, 5);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reminderDays: 5 });
  });

  it('der Job schreibt die richtigen Mails an die richtigen Personen', async () => {
    await reminders.runDaily(today);
    expect(await sent()).toEqual(
      [
        // Käufer, Standard drei Tage vorher: an die verantwortliche Person.
        `reminder Erinnern → ${mail(users.anna)}`,
        // Am Tag nach der Frist: SRO, die verantwortliche Person in Kopie.
        `escalation Eskalieren → ${mail(users.sro)}`,
        `escalation Eskalieren → ${mail(users.anna)}`,
        `escalation Intern beim Käufer → ${mail(users.sro)}`,
        `escalation Intern beim Käufer → ${mail(users.anna)}`,
        // Aufgabe des Käufers ohne eigene verantwortliche Person: nur an den SRO des Käufers
        `escalation Intern für den Lieferanten → ${mail(users.sro)}`,
        // Lieferant mit fünf Tagen: Key Account Manager und verantwortliche Person.
        `reminder Lieferant erinnert → ${mail(users.lea)}`,
        `escalation Lieferant eskaliert → ${mail(users.kam)}`,
        `escalation Lieferant eskaliert → ${mail(users.lea)}`,
      ].sort(),
    );
  });

  it('jede Mail kommt genau einmal, auch wenn der Job erneut läuft', async () => {
    const before = await sent();
    expect(await reminders.runDaily(today)).toBeGreaterThanOrEqual(0);
    expect(await sent()).toEqual(before);
  });

  it('am Folgetag eskaliert nichts mehr, und die Mail enthält nur Titel, Frist und Link', async () => {
    const before = await sent();
    await reminders.runDaily('2099-06-11');
    expect(await sent()).toEqual(before);
    const [row] = await db
      .select()
      .from(schema.outboxEvent)
      .where(
        sql`${schema.outboxEvent.orgId} = ${orgs.supplier} and ${schema.outboxEvent.emailTemplate} = 'escalation' and ${schema.outboxEvent.emailRecipient} = ${mail(users.kam)}`,
      );
    expect(row).toMatchObject({
      emailTitle: 'Lieferant eskaliert',
      emailDeadline: '9. Juni 2099',
      emailLink: `/kunden/${rel}/umsetzung/massnahmen`,
      emailMessage: null,
      emailSender: null,
    });
  });
});
