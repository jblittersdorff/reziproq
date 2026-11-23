import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { notificationActionResultSchema, notificationPrefsSchema } from '@reziproq/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NotificationBus, type NotificationEvent } from '../../common/notification-bus.js';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { inQuietHours, NotificationsService } from './notifications.service.js';
import { FakeTeamsClient } from './teams-client.js';

// Tests zu docs/specs/IN-06.md mit Anbieter fake: eine Teams-Karte je Hinweis, Bündel in 15
// Minuten, Tageslimit, Ruhezeiten, Knopf mit den Rechten der Person, keine privaten Inhalte in
// Mails, ohne Teams per Mail, nichts für den Lieferanten.
describe('IN-06 Benachrichtigungen in Teams und per Mail', () => {
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), b: randomUUID(), supplier: randomUUID() };
  const users = {
    admin: `in06-adm-${run}`,
    anna: `in06-anna-${run}`,
    vera: `in06-vera-${run}`,
    ben: `in06-ben-${run}`,
    supplier: `in06-sup-${run}`,
  };
  const rel = randomUUID();
  const secret = `Geheimziel-${run}`;
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  let bus: NotificationBus;
  let service: NotificationsService;
  let teams: FakeTeamsClient;
  // Mittwoch, 26.11.2026, 10:00 in Berlin
  let now = new Date('2026-11-26T09:00:00Z');

  async function call(user: string, method: string, path: string, body?: unknown) {
    const response = await fetch(`${app.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await app.signToken({ subject: user })}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  }
  const event = (input: Partial<NotificationEvent> = {}): NotificationEvent => ({
    orgId: orgs.a,
    userIds: [users.anna],
    kind: 'hint_high',
    objectType: 'hint',
    objectId: randomUUID(),
    title: 'Liefertreue unter 90 %',
    line: 'Rheintal Elektronik',
    href: '/hinweise',
    relationshipId: rel,
    ...input,
  });
  const cards = () =>
    teams.cardsFor(`fake:${users.anna}`).filter((entry) => !entry.card.title.startsWith('Hallo'));
  const rows = async (userId: string) =>
    (
      await db.execute<{
        channel: string;
        kind: string;
        delivery: string;
        status: string;
        reason: string | null;
      }>(
        sql`select channel, kind, delivery, status, reason from notification where user_id = ${userId} order by created_at`,
      )
    ).rows;
  const mails = async (recipient: string) =>
    (
      await db.execute<{
        email_template: string;
        email_title: string;
        email_message: string | null;
        email_link: string;
      }>(
        sql`select email_template, email_title, email_message, email_link from outbox_event where email_recipient = ${recipient}`,
      )
    ).rows;

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    bus = app.app.get(NotificationBus);
    service = app.app.get(NotificationsService);
    teams = app.app.get(FakeTeamsClient);
    service.clock = () => now;
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `Kunde A ${run}` },
      { id: orgs.b, name: `Kunde B ${run}` },
      { id: orgs.supplier, name: `IN06 Lieferant ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.a, feature: 'buyer' },
      { organizationId: orgs.b, feature: 'buyer' },
    ]);
    await db.insert(schema.appUser).values([
      ...(['admin', 'anna', 'vera'] as const).map((key) => ({
        id: users[key],
        name: key,
        email: `${key}-${run}@oem.example`,
        organizationId: orgs.a,
        orgRole:
          key === 'admin'
            ? ('admin' as const)
            : key === 'vera'
              ? ('viewer' as const)
              : ('member' as const),
        rolesImportedAt: new Date(),
      })),
      {
        id: users.ben,
        name: 'ben',
        email: `ben-${run}@b.example`,
        organizationId: orgs.b,
        orgRole: 'member' as const,
        rolesImportedAt: new Date(),
      },
      {
        id: users.supplier,
        name: 'Lieferant',
        email: `kam-${run}@lieferant.example`,
        organizationId: orgs.supplier,
        orgRole: 'admin' as const,
        rolesImportedAt: new Date(),
      },
    ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.a, supplier: orgs.supplier }]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel, orgId: orgs.a, userId: users.anna, teamRole: 'sro' },
      { relationshipId: rel, orgId: orgs.a, userId: users.vera, teamRole: 'member' },
    ]);
    // Eine „Nur ich“-Notiz mit Inhalt, der nie in einer Benachrichtigung stehen darf
    await db.insert(schema.note).values({
      orgId: orgs.a,
      relationshipId: rel,
      authorUserId: users.anna,
      visibility: 'private',
      kind: 'note',
      text: `${secret}: Zielkorridor 3 bis 5 Prozent`,
    });
    // Admin schaltet die Teams-App frei, Anna verbindet Teams
    const org = await call(users.admin, 'PUT', '/profil/benachrichtigungen/organisation', {
      teamsApp: true,
    });
    expect(org.status).toBe(200);
    const linked = notificationPrefsSchema.parse(
      (await call(users.anna, 'POST', '/profil/benachrichtigungen/teams')).body,
    );
    expect(linked).toMatchObject({ teamsAvailable: true, teamsLinked: true });
    // Der Bot stellt sich mit einer Karte vor
    expect(teams.cardsFor(`fake:${users.anna}`)[0]?.card.title).toBe('Hallo, hier ist Reziproq.');
  });

  beforeEach(async () => {
    await db.execute(sql`delete from notification where org_id in (${orgs.a}, ${orgs.b})`);
    teams.messages.clear();
    now = new Date('2026-11-26T09:00:00Z');
  });

  afterAll(async () => {
    await db.execute(
      sql`delete from notification where org_id in (${orgs.a}, ${orgs.b}, ${orgs.supplier})`,
    );
    await db.execute(sql`delete from notification_pref where org_id in (${orgs.a}, ${orgs.b})`);
    await db.execute(sql`delete from notification_channel where org_id in (${orgs.a}, ${orgs.b})`);
    await db.execute(sql`delete from outbox_event where org_id in (${orgs.a}, ${orgs.b})`);
    await db
      .execute(sql`delete from audit_event where owner_org_id in (${orgs.a}, ${orgs.b})`)
      .catch(() => undefined);
    await db.execute(sql`delete from org_setting where org_id in (${orgs.a}, ${orgs.b})`);
    await db.execute(sql`delete from inbound_item where org_id = ${orgs.a}`);
    await db.execute(sql`delete from meeting_attendee where org_id = ${orgs.a}`);
    await db.execute(sql`delete from meeting where relationship_id = ${rel}`);
    await db.execute(sql`delete from note where relationship_id = ${rel}`);
    await db.execute(sql`delete from relationship_member where relationship_id = ${rel}`);
    await deleteRelationships(db, [orgs.a]);
    await db.execute(sql`delete from app_user where id in ${Object.values(users)}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await app.close();
  });

  it('ein Hinweis mit Schwere hoch erzeugt genau eine Teams-Karte', async () => {
    await bus.emit(event());
    expect(cards()).toHaveLength(1);
    expect(cards()[0]?.card).toMatchObject({
      title: 'Liefertreue unter 90 %',
      line: 'Rheintal Elektronik',
      openLabel: 'In Reziproq öffnen',
    });
    expect(cards()[0]?.card.openUrl).toMatch(/\/hinweise$/);
    // Per Mail steht er zunächst nur in der Zusammenfassung (Startwert)
    expect(await rows(users.anna)).toEqual([
      expect.objectContaining({ channel: 'teams', delivery: 'now', status: 'sent' }),
      expect.objectContaining({ channel: 'mail', delivery: 'digest', status: 'queued' }),
    ]);
  });

  it('aus einer offenen Transaktion wird erst danach zugestellt (aufgeschoben)', async () => {
    bus.defer(event({ title: 'Aufgeschoben' }));
    expect(cards()).toHaveLength(0);
    await bus.settled();
    expect(cards().map((entry) => entry.card.title)).toEqual(['Aufgeschoben']);
  });

  it('drei Anlässe derselben Art innerhalb von 15 Minuten ergeben eine Karte', async () => {
    for (const minutes of [0, 5, 12]) {
      now = new Date(Date.parse('2026-11-26T09:00:00Z') + minutes * 60_000);
      await bus.emit(event({ title: `Hinweis ${minutes}` }));
    }
    expect(cards()).toHaveLength(1);
    expect(cards()[0]?.updates).toBe(2);
    expect(cards()[0]?.card.title).toBe('3 Hinweise mit hoher Schwere');
    // Nach 15 Minuten wieder eine eigene Karte
    now = new Date(Date.parse('2026-11-26T09:00:00Z') + 40 * 60_000);
    await bus.emit(event({ title: 'Später' }));
    expect(cards()).toHaveLength(2);
  });

  it('ab der siebten Sofort-Nachricht eines Tages geht alles in die Zusammenfassung', async () => {
    for (let index = 0; index < 7; index += 1) {
      now = new Date(Date.parse('2026-11-26T09:00:00Z') + index * 20 * 60_000);
      await bus.emit(event({ title: `Hinweis ${index + 1}` }));
    }
    expect(cards()).toHaveLength(6);
    const teamsRows = (await rows(users.anna)).filter((row) => row.channel === 'teams');
    expect(teamsRows[6]).toMatchObject({
      delivery: 'digest',
      status: 'queued',
      reason: 'tageslimit',
    });
    // Die Zusammenfassung am nächsten Morgen nimmt sie auf
    now = new Date('2026-11-27T07:00:00Z');
    expect(await service.runDigest(orgs.a)).toBe(1);
    // Alle sieben Hinweise stehen darin (je Anlass einmal), höchstens fünf als Punkte
    const digest = cards().at(-1)?.card;
    expect(digest?.title).toBe('Heute warten 7 Punkte auf dich.');
    expect(digest?.line?.split('\n')).toHaveLength(5);
    expect(digest?.line).toContain('Hinweis 1');
  });

  it('in den Ruhezeiten wird nichts gesendet außer Erinnerungen zu Terminen', async () => {
    expect(
      inQuietHours({ from: '19:00', to: '07:00', weekend: true }, new Date('2026-11-26T21:30:00Z')),
    ).toBe(true);
    expect(
      inQuietHours({ from: '19:00', to: '07:00', weekend: true }, new Date('2026-11-28T10:00:00Z')),
    ).toBe(true);
    now = new Date('2026-11-26T21:30:00Z');
    await bus.emit(event());
    expect(cards()).toHaveLength(0);
    expect((await rows(users.anna))[0]).toMatchObject({ delivery: 'digest', reason: 'ruhezeit' });
    await bus.emit(
      event({
        kind: 'meeting_reminder',
        objectType: 'meeting',
        title: 'QBR beginnt in 10 Minuten',
        href: '/mein-tag',
      }),
    );
    expect(cards()).toHaveLength(1);
    expect(cards()[0]?.card.title).toBe('QBR beginnt in 10 Minuten');
  });

  it('ein Knopf führt die Aktion mit den Rechten der Person aus; ohne Recht scheitert er mit Hinweis', async () => {
    const inbound = async (assignee: string) => {
      const [row] = await db
        .insert(schema.inboundItem)
        .values({
          orgId: orgs.a,
          source: 'inbound_mail',
          subject: `Abstimmung ${assignee}`,
          details: {
            method: 'REQUEST',
            startsAt: '2026-12-03T09:00:00.000Z',
            endsAt: '2026-12-03T10:00:00.000Z',
            location: null,
            onlineMeetingUrl: null,
            organizerEmail: null,
            organizerName: null,
            attendees: [],
          },
          suggestedRelationshipIds: [rel],
          suggestionKind: 'supplier',
          suggestedType: 'other',
          status: 'needs_review',
          ownerUserId: assignee,
          assigneeUserId: assignee,
        })
        .returning({ id: schema.inboundItem.id });
      return row?.id ?? '';
    };
    const notificationFor = async (user: string, inboundId: string) => {
      await bus.emit(
        event({
          userIds: [user],
          kind: 'inbound_review',
          objectType: 'inbound_item',
          objectId: inboundId,
          title: 'Neu eingegangen: Abstimmung',
          href: '/mein-tag/eingang',
        }),
      );
      const [row] = (
        await db.execute<{ id: string }>(
          sql`select id from notification where user_id = ${user} and object_id = ${inboundId} order by created_at limit 1`,
        )
      ).rows;
      return row?.id ?? '';
    };
    // Vera (Leserin) darf keine Termine anlegen
    const forVera = await notificationFor(users.vera, await inbound(users.vera));
    const denied = notificationActionResultSchema.parse(
      (
        await call(users.vera, 'POST', `/benachrichtigungen/${forVera}/aktion`, {
          action: 'zuordnen',
        })
      ).body,
    );
    expect(denied).toEqual({ ok: false, message: 'Dafür fehlt dir das Recht in Reziproq.' });
    // Anna (SRO) ordnet zu: es entsteht ein interner Termin beim Lieferanten
    const annaItem = await inbound(users.anna);
    const forAnna = await notificationFor(users.anna, annaItem);
    const done = notificationActionResultSchema.parse(
      (
        await call(users.anna, 'POST', `/benachrichtigungen/${forAnna}/aktion`, {
          action: 'zuordnen',
        })
      ).body,
    );
    expect(done.ok).toBe(true);
    const [item] = (
      await db.execute<{ status: string }>(
        sql`select status from inbound_item where id = ${annaItem}`,
      )
    ).rows;
    expect(item?.status).toBe('assigned');
    // Fremde Benachrichtigung: nicht gefunden
    expect(
      (
        await call(users.vera, 'POST', `/benachrichtigungen/${forAnna}/aktion`, {
          action: 'zuordnen',
        })
      ).status,
    ).toBe(404);
  });

  it('eine Mail enthält keine privaten Inhalte (Ziele, Zielkorridor, „Nur ich“-Notizen)', async () => {
    // Vera hat kein Teams: alles per Mail, Briefing fertig sofort
    await bus.emit(
      event({
        userIds: [users.vera],
        kind: 'brief_ready',
        objectType: 'meeting',
        title: 'JBP Rheintal am 04.12.: Briefing steht',
        line: '3 Ziele, Agenda mit 7 Punkten, 9 offene Fragen',
        href: `/lieferanten/${rel}/umsetzung/termine/${randomUUID()}`,
      }),
    );
    await bus.emit(event({ userIds: [users.vera] }));
    now = new Date('2026-11-27T07:00:00Z');
    await service.runDigest(orgs.a);
    const sent = await mails(`vera-${run}@oem.example`);
    expect(sent.length).toBeGreaterThanOrEqual(1);
    for (const mail of sent) {
      const text = `${mail.email_title} ${mail.email_message ?? ''} ${mail.email_link}`;
      expect(text).not.toContain(secret);
      expect(text).not.toMatch(/Zielkorridor/);
      expect(text).not.toMatch(/€|EUR/);
      expect(mail.email_link).not.toMatch(/[?#]/);
    }
    expect(sent.map((mail) => mail.email_template)).toContain('notification');
  });

  it('ohne Teams-App gehen Nachrichten per Mail', async () => {
    await call(users.admin, 'PUT', '/profil/benachrichtigungen/organisation', { teamsApp: false });
    await bus.emit(event({ title: 'Ohne Teams' }));
    expect(cards()).toHaveLength(0);
    expect(await rows(users.anna)).toEqual([
      expect.objectContaining({ channel: 'mail', delivery: 'now', status: 'sent' }),
    ]);
    expect((await mails(`anna-${run}@oem.example`)).map((mail) => mail.email_title)).toContain(
      'Ohne Teams',
    );
    await call(users.admin, 'PUT', '/profil/benachrichtigungen/organisation', { teamsApp: true });
  });

  it('eigene Einstellungen: aus heißt nichts; nur die Person sieht und ändert sie', async () => {
    const saved = notificationPrefsSchema.parse(
      (
        await call(users.anna, 'PUT', '/profil/benachrichtigungen', {
          modes: { hint_high: { teams: 'off', mail: 'off' } },
          quietHours: { from: '20:00', to: '06:30', weekend: false },
        })
      ).body,
    );
    expect(saved.modes.hint_high).toEqual({ teams: 'off', mail: 'off' });
    expect(saved.quietHours).toEqual({ from: '20:00', to: '06:30', weekend: false });
    await bus.emit(event());
    expect(await rows(users.anna)).toEqual([]);
    // Vera sieht Annas Einstellungen nicht (Standardwerte)
    const vera = notificationPrefsSchema.parse(
      (await call(users.vera, 'GET', '/profil/benachrichtigungen')).body,
    );
    expect(vera.modes.hint_high).toEqual({ teams: 'now', mail: 'digest' });
    // Nur Admins schalten die Organisation
    expect(
      (await call(users.vera, 'PUT', '/profil/benachrichtigungen/organisation', { mail: false }))
        .status,
    ).toBe(403);
    await call(users.anna, 'PUT', '/profil/benachrichtigungen', {
      modes: { hint_high: { teams: 'now', mail: 'digest' } },
      quietHours: { from: '19:00', to: '07:00', weekend: true },
    });
  });

  it('der Test-Lieferant bekommt keine dieser Nachrichten', async () => {
    // Person einer anderen Organisation im Anlass: wird übergangen
    await bus.emit(event({ userIds: [users.supplier, users.ben] }));
    // Anlass in der Organisation des Lieferanten: keine Käuferseite, nichts
    await bus.emit(
      event({ orgId: orgs.supplier, userIds: [users.supplier], relationshipId: null }),
    );
    const count = await db.execute(
      sql`select 1 from notification where user_id in (${users.supplier}, ${users.ben})`,
    );
    expect(count.rows).toHaveLength(0);
    expect((await mails(`kam-${run}@lieferant.example`)).length).toBe(0);
    expect((await call(users.supplier, 'GET', '/profil/benachrichtigungen')).status).toBe(403);
  });
});
