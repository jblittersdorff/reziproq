import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  and,
  currentTime,
  desc,
  eq,
  gte,
  inArray,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  defaultNotificationModes,
  defaultQuietHours,
  type NotificationAction,
  type NotificationActionResult,
  type NotificationChannel,
  type NotificationKind,
  type NotificationMode,
  type NotificationPrefs,
  notificationKinds,
  notificationPrefsSchema,
  type QuietHours,
  quietHoursSchema,
  type SaveNotificationOrg,
  type SaveNotificationPrefs,
  saveNotificationOrgSchema,
  saveNotificationPrefsSchema,
} from '@reziproq/shared';
import { AccountStore, TenantDatabase } from '../../common/database.module.js';
import { NotificationBus, type NotificationEvent } from '../../common/notification-bus.js';
import { env } from '../../config/env.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { CalendarIntakeService } from '../calendar/calendar.service.js';
import { EmailService } from '../email/email.service.js';
import { actorIn } from '../integrations/actor.js';
import { JbpService } from '../jbp/jbp.service.js';
import { JbpCommitmentsService } from '../jbp/jbp-commitments.service.js';
import { MeetingBriefService } from '../meetings/meeting-brief.service.js';
import { TEAMS_CLIENT, type TeamsCard, type TeamsClient } from './teams-client.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const systemUser = 'system:benachrichtigungen';
/** Anlässe derselben Art innerhalb dieser Zeit teilen sich eine Karte */
export const bundleWindowMs = 15 * 60 * 1000;
/** Höchstens so viele Sofort-Nachrichten je Person und Tag; danach in die Zusammenfassung */
export const maxNowPerDay = 6;
const zone = 'Europe/Berlin';

type Row = typeof schema.notification.$inferSelect;
type EventKind = NotificationEvent['kind'];

/** Uhrzeit, Wochentag und Tag in Berlin */
function local(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return {
    time: `${parts.hour}:${parts.minute}`,
    weekend: parts.weekday === 'Sat' || parts.weekday === 'Sun',
    day: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** In den Ruhezeiten? Von–bis über Mitternacht (19:00–07:00) oder am selben Tag */
export function inQuietHours(quiet: QuietHours, now: Date): boolean {
  const { time, weekend } = local(now);
  if (quiet.weekend && weekend) return true;
  if (quiet.from === quiet.to) return false;
  return quiet.from < quiet.to
    ? time >= quiet.from && time < quiet.to
    : time >= quiet.from || time < quiet.to;
}

/** Beginn des heutigen Tages in Berlin als Zeitpunkt (für die Tagesgrenze) */
function startOfLocalDay(now: Date) {
  const { day } = local(now);
  // Mitternacht in Berlin: 00:00 Ortszeit; der Versatz ist 1 oder 2 Stunden
  for (const offset of [1, 2]) {
    const candidate = new Date(`${day}T00:00:00Z`);
    candidate.setUTCHours(candidate.getUTCHours() - offset);
    if (local(candidate).time === '00:00') return candidate;
  }
  return new Date(`${day}T00:00:00Z`);
}

const titles: Record<
  'de' | 'en',
  Record<EventKind, (count: number) => string> & {
    open: string;
    buttons: Record<string, string>;
    digest: (count: number) => string;
  }
> = {
  de: {
    hint_high: (n) => `${n} Hinweise mit hoher Schwere`,
    brief_ready: (n) => `${n} Briefings stehen`,
    results_ready: (n) => `Ergebnisse aus ${n} Terminen sind fertig`,
    commitment_due: (n) => `${n} Zusagen sind fällig`,
    inbound_review: (n) => `${n} Eingänge warten auf eine Zuordnung`,
    meeting_reminder: (n) => `${n} Termine beginnen gleich`,
    open: 'In Reziproq öffnen',
    buttons: {
      agenda_uebernehmen: 'Agenda übernehmen',
      erledigt: 'Erledigt',
      zuordnen: 'Zuordnen',
    },
    digest: (n) =>
      n === 1 ? 'Heute wartet 1 Punkt auf dich.' : `Heute warten ${n} Punkte auf dich.`,
  },
  en: {
    hint_high: (n) => `${n} high-severity hints`,
    brief_ready: (n) => `${n} briefings are ready`,
    results_ready: (n) => `Results from ${n} meetings are ready`,
    commitment_due: (n) => `${n} commitments are due`,
    inbound_review: (n) => `${n} items wait for an assignment`,
    meeting_reminder: (n) => `${n} meetings start soon`,
    open: 'Open in Reziproq',
    buttons: { agenda_uebernehmen: 'Adopt agenda', erledigt: 'Done', zuordnen: 'Assign' },
    digest: (n) => (n === 1 ? '1 item waits for you today.' : `${n} items wait for you today.`),
  },
};

/** Welcher Knopf zu welchem Anlass gehört (höchstens einer plus „In Reziproq öffnen“) */
const buttonFor: Partial<Record<EventKind, NotificationAction['action']>> = {
  brief_ready: 'agenda_uebernehmen',
  commitment_due: 'erledigt',
  inbound_review: 'zuordnen',
};

interface Person {
  id: string;
  email: string;
  locale: 'de' | 'en';
  firstName: string | null;
}

interface Settings {
  modes: Record<NotificationKind, Record<NotificationChannel, NotificationMode>>;
  quietHours: QuietHours;
}

/**
 * IN-06 Benachrichtigungen in Teams und per Mail. Wenig, aber das Richtige: je Anlass und Person
 * ein Kanal nach den Einstellungen, Bündel innerhalb von 15 Minuten, höchstens sechs Sofort-
 * Nachrichten am Tag, nichts in den Ruhezeiten (außer Erinnerungen zu Terminen). Ohne Teams-App
 * fällt alles auf Mail zurück. Inhalte nur Titel, eine Zeile Kontext und Link.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(AccountStore) private readonly accounts: AccountStore,
    @Inject(NotificationBus) private readonly bus: NotificationBus,
    @Inject(TEAMS_CLIENT) private readonly teams: TeamsClient,
    @Inject(EmailService) private readonly emails: EmailService,
    @Inject(MeetingBriefService) private readonly briefs: MeetingBriefService,
    @Inject(JbpService) private readonly jbp: JbpService,
    @Inject(JbpCommitmentsService) private readonly commitments: JbpCommitmentsService,
    @Inject(CalendarIntakeService) private readonly intake: CalendarIntakeService,
  ) {
    this.bus.listen((event) => this.notify(event));
  }

  /** Für Tests: feste Uhrzeit */
  clock: () => Date = () => currentTime();

  private system(orgId: string) {
    return { userId: systemUser, organizationId: orgId };
  }

  // ------------------------------------------------------------- Organisation und Person

  private async orgSettings(tx: TenantTransaction, orgId: string) {
    const rows = await tx
      .select({ key: schema.orgSetting.key, value: schema.orgSetting.value })
      .from(schema.orgSetting)
      .where(
        and(
          eq(schema.orgSetting.orgId, orgId),
          inArray(schema.orgSetting.key, ['notify_teams_app', 'notify_mail']),
        ),
      );
    const value = (key: string, fallback: boolean) => {
      const found = rows.find((row) => row.key === key)?.value;
      return typeof found === 'boolean' ? found : fallback;
    };
    return { teamsApp: value('notify_teams_app', false), mail: value('notify_mail', true) };
  }

  /** Nur Käufer bekommen Benachrichtigungen; der Lieferant nie */
  private async isBuyer(tx: TenantTransaction, orgId: string) {
    const [row] = await tx
      .select({ feature: schema.organizationFeature.feature })
      .from(schema.organizationFeature)
      .where(
        and(
          eq(schema.organizationFeature.organizationId, orgId),
          eq(schema.organizationFeature.feature, 'buyer'),
        ),
      );
    return Boolean(row);
  }

  private async person(
    tx: TenantTransaction,
    orgId: string,
    userId: string,
  ): Promise<Person | null> {
    const [row] = await tx
      .select({
        id: schema.appUser.id,
        email: schema.appUser.email,
        locale: schema.appUser.locale,
        name: schema.appUser.name,
        givenName: schema.appUser.givenName,
      })
      .from(schema.appUser)
      .where(and(eq(schema.appUser.id, userId), eq(schema.appUser.organizationId, orgId)));
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      locale: row.locale === 'en' ? 'en' : 'de',
      firstName: row.givenName ?? row.name.split(' ')[0] ?? null,
    };
  }

  /** Einstellungen der Person; nur sie selbst liest sie (Policy notification_pref_self) */
  private async settingsOf(
    orgId: string,
    userId: string,
  ): Promise<Settings & { teamsRef: string | null }> {
    return this.tenant.run(
      { userId, organizationId: orgId },
      async (tx) => {
        const rows = await tx
          .select()
          .from(schema.notificationPref)
          .where(eq(schema.notificationPref.userId, userId));
        const modes = structuredClone(defaultNotificationModes);
        let quietHours = defaultQuietHours;
        for (const row of rows) {
          if ((notificationKinds as readonly string[]).includes(row.kind)) {
            modes[row.kind as NotificationKind][row.channel] = row.mode;
          }
          const parsed = quietHoursSchema.safeParse(row.quietHours);
          if (parsed.success) quietHours = parsed.data;
        }
        const [channel] = await tx
          .select({ ref: schema.notificationChannel.conversationRef })
          .from(schema.notificationChannel)
          .where(
            and(
              eq(schema.notificationChannel.userId, userId),
              eq(schema.notificationChannel.channel, 'teams'),
            ),
          );
        return { modes, quietHours, teamsRef: channel?.ref ?? null };
      },
      { readOnly: true },
    );
  }

  // ------------------------------------------------------------- Zustellen

  /** Ein Anlass für mehrere Personen; jede bekommt ihn nach ihren Einstellungen */
  async notify(event: NotificationEvent): Promise<void> {
    const prepared = await this.tenant.run(this.system(event.orgId), async (tx) => {
      if (!(await this.isBuyer(tx, event.orgId))) return null;
      const people: Person[] = [];
      for (const userId of [...new Set(event.userIds)]) {
        const person = await this.person(tx, event.orgId, userId);
        if (person) people.push(person);
      }
      return { org: await this.orgSettings(tx, event.orgId), people };
    });
    if (!prepared) return;
    for (const person of prepared.people) {
      // Nur, wer den Lieferanten sieht (Zeilensicherheit der Person)
      if (
        event.relationshipId &&
        !(await this.sees(event.orgId, person.id, event.relationshipId))
      ) {
        continue;
      }
      const settings = await this.settingsOf(event.orgId, person.id);
      const teamsActive = prepared.org.teamsApp && settings.teamsRef !== null;
      const modes = settings.modes[event.kind];
      const teamsMode = teamsActive ? modes.teams : 'off';
      // Ohne Teams gilt für Mail dieselbe Regel wie für Teams (sofern Teams nicht aus ist)
      const mailMode = !prepared.org.mail
        ? 'off'
        : teamsActive
          ? modes.mail
          : modes.teams !== 'off'
            ? modes.teams
            : modes.mail;
      if (teamsMode !== 'off' && settings.teamsRef) {
        await this.deliver(event, person, 'teams', teamsMode, settings, settings.teamsRef);
      }
      if (mailMode !== 'off') {
        await this.deliver(event, person, 'mail', mailMode, settings, null);
      }
    }
  }

  private async sees(orgId: string, userId: string, relationshipId: string) {
    return this.tenant.run(
      { userId, organizationId: orgId },
      async (tx) => {
        const [row] = await tx
          .select({ id: schema.relationship.id })
          .from(schema.relationship)
          .where(
            and(
              eq(schema.relationship.id, relationshipId),
              eq(schema.relationship.buyerOrgId, orgId),
            ),
          );
        return Boolean(row);
      },
      { readOnly: true },
    );
  }

  private async deliver(
    event: NotificationEvent,
    person: Person,
    channel: NotificationChannel,
    mode: 'now' | 'digest',
    settings: Settings,
    teamsRef: string | null,
  ) {
    const now = this.clock();
    const bundleKey = `${person.id}:${channel}:${event.kind}`;
    const base = {
      orgId: event.orgId,
      userId: person.id,
      channel,
      kind: event.kind,
      objectType: event.objectType,
      objectId: event.objectId,
      bundleKey,
      title: event.title.slice(0, 200),
      line: event.line?.slice(0, 300) ?? null,
      href: event.href,
    };
    await this.tenant.run(this.system(event.orgId), async (tx) => {
      const insert = (values: Partial<typeof schema.notification.$inferInsert>) =>
        tx
          .insert(schema.notification)
          .values({ ...base, delivery: 'now', status: 'queued', createdAt: now, ...values })
          .returning({ id: schema.notification.id });
      if (mode === 'digest') {
        await insert({ delivery: 'digest', status: 'queued' });
        return;
      }
      // Ruhezeiten: alles in die Zusammenfassung, außer Erinnerungen zu Terminen
      if (event.kind !== 'meeting_reminder' && inQuietHours(settings.quietHours, now)) {
        await insert({ delivery: 'digest', status: 'queued', reason: 'ruhezeit' });
        return;
      }
      // Bündeln: dieselbe Art innerhalb von 15 Minuten → dieselbe Karte
      const recent = await tx
        .select()
        .from(schema.notification)
        .where(
          and(
            eq(schema.notification.bundleKey, bundleKey),
            eq(schema.notification.status, 'sent'),
            eq(schema.notification.delivery, 'now'),
            gte(schema.notification.createdAt, new Date(now.getTime() - bundleWindowMs)),
          ),
        )
        .orderBy(desc(schema.notification.createdAt));
      const first = recent.find((row) => row.messageRef !== null);
      if (recent.length > 0) {
        if (channel === 'teams' && first?.messageRef && teamsRef) {
          const [row] = await insert({
            status: 'sent',
            sentAt: now,
            messageRef: first.messageRef,
            reason: 'gebuendelt',
          });
          await this.teams.update(
            teamsRef,
            first.messageRef,
            this.card(person, event.kind, [...recent.reverse(), { ...base, id: row?.id ?? '' }]),
          );
        } else {
          // Eine Mail lässt sich nicht ändern: weitere Anlässe kommen in die Zusammenfassung
          await insert({ delivery: 'digest', status: 'queued', reason: 'gebuendelt' });
        }
        return;
      }
      // Höchstens sechs Sofort-Nachrichten am Tag (gebündelte zählen nicht extra)
      const [count] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.notification)
        .where(
          and(
            eq(schema.notification.userId, person.id),
            eq(schema.notification.delivery, 'now'),
            eq(schema.notification.status, 'sent'),
            sql`${schema.notification.reason} is null`,
            sql`${schema.notification.kind} <> 'digest'`,
            gte(schema.notification.createdAt, startOfLocalDay(now)),
          ),
        );
      if ((count?.n ?? 0) >= maxNowPerDay) {
        await insert({ delivery: 'digest', status: 'queued', reason: 'tageslimit' });
        return;
      }
      const [row] = await insert({ status: 'sent', sentAt: now });
      if (!row) return;
      if (channel === 'teams' && teamsRef) {
        const messageRef = await this.teams.send(
          teamsRef,
          this.card(person, event.kind, [{ ...base, id: row.id }]),
        );
        await tx
          .update(schema.notification)
          .set({ messageRef })
          .where(eq(schema.notification.id, row.id));
      } else {
        await this.mail(tx, event.orgId, person, row.id, 'notification', {
          title: base.title,
          message: base.line,
          link: base.href,
        });
      }
    });
  }

  /** Karte zu einem Anlass oder einem Bündel: Titel als Aussage, Zeile, ein Knopf, Öffnen */
  private card(
    person: Person,
    kind: EventKind,
    rows: { id: string; title: string; line: string | null; href: string }[],
  ): TeamsCard {
    const text = titles[person.locale];
    const latest = rows[rows.length - 1] ?? rows[0];
    const single = rows.length === 1 && latest;
    const action = buttonFor[kind];
    return {
      title: single ? latest.title : text[kind](rows.length),
      line: single
        ? latest.line
        : rows
            .map((row) => row.title)
            .slice(0, 3)
            .join(' · '),
      buttons:
        single && action
          ? [{ action, label: text.buttons[action] ?? action, notificationId: latest.id }]
          : [],
      openUrl: `${env.WEB_APP_URL}${single ? latest.href : '/mein-tag'}`,
      openLabel: text.open,
    };
  }

  /** Mail über die Outbox: nur Titel, eine Zeile und Link; Verlaufseintrag wie bei Erinnerungen */
  private async mail(
    tx: TenantTransaction,
    orgId: string,
    person: Person,
    notificationId: string,
    template: 'notification' | 'digest',
    content: { title: string; message: string | null; link: string },
  ) {
    const [event] = await tx
      .insert(schema.auditEvent)
      .values({
        actorUserId: systemUser,
        actorName: 'Reziproq',
        ownerOrgId: orgId,
        visibility: 'internal',
        objectType: 'notification',
        objectId: notificationId,
        action: 'created',
        changes: { template: { from: null, to: template } },
      })
      .returning({ id: schema.auditEvent.id });
    if (!event) throw new Error('Verlaufseintrag für Benachrichtigung fehlt');
    // Links ohne Abfrage und Anker (Regel der Outbox)
    const link = content.link.split(/[?#]/)[0] || '/mein-tag';
    const email = this.emails.prepare({
      template,
      locale: person.locale,
      recipient: person.email,
      ...(person.firstName ? { firstName: person.firstName } : {}),
      title: content.title.slice(0, 140),
      ...(content.message ? { message: content.message.slice(0, 500) } : {}),
      link,
    });
    await tx.insert(schema.outboxEvent).values({
      eventType: `email.${template}`,
      objectType: 'notification',
      objectId: notificationId,
      auditEventId: event.id,
      orgId,
      emailTemplate: email.template,
      emailLocale: email.locale,
      emailRecipient: email.recipient,
      emailFirstName: email.firstName ?? null,
      emailTitle: email.title,
      emailDeadline: null,
      emailLink: email.link,
      emailMessage: email.message ?? null,
    });
  }

  // ------------------------------------------------------------- Zusammenfassung des Tages

  /**
   * Um 08:00: je Person eine Aussage in einem Satz, dann höchstens fünf Punkte. In Teams, wenn
   * verbunden und an; per Mail nur, wenn Teams aus ist. Ohne wartende Punkte nichts.
   */
  async runDigest(orgId: string): Promise<number> {
    const now = this.clock();
    const prepared = await this.tenant.run(this.system(orgId), async (tx) => {
      if (!(await this.isBuyer(tx, orgId))) return null;
      const queued = await tx
        .select()
        .from(schema.notification)
        .where(
          and(
            eq(schema.notification.orgId, orgId),
            eq(schema.notification.status, 'queued'),
            eq(schema.notification.delivery, 'digest'),
          ),
        )
        .orderBy(schema.notification.createdAt);
      return { org: await this.orgSettings(tx, orgId), queued };
    });
    if (!prepared) return 0;
    const byUser = new Map<string, Row[]>();
    for (const row of prepared.queued)
      byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);
    let sent = 0;
    for (const [userId, rows] of byUser) {
      const person = await this.tenant.run(this.system(orgId), (tx) =>
        this.person(tx, orgId, userId),
      );
      if (!person) continue;
      const settings = await this.settingsOf(orgId, userId);
      const teamsActive = prepared.org.teamsApp && settings.teamsRef !== null;
      const digest = settings.modes.digest;
      const channel: NotificationChannel | null =
        teamsActive && digest.teams !== 'off'
          ? 'teams'
          : prepared.org.mail && digest.mail !== 'off'
            ? 'mail'
            : null;
      // Je Anlass nur einmal (Teams und Mail können denselben Anlass vorgemerkt haben)
      const unique = rows.filter(
        (row, index) =>
          rows.findIndex(
            (other) => other.objectType === row.objectType && other.objectId === row.objectId,
          ) === index,
      );
      const text = titles[person.locale];
      const title = text.digest(unique.length);
      const items = unique.slice(0, 5);
      await this.tenant.run(this.system(orgId), async (tx) => {
        await tx
          .update(schema.notification)
          .set({ status: channel ? 'sent' : 'suppressed', sentAt: now, reason: 'zusammenfassung' })
          .where(
            inArray(
              schema.notification.id,
              rows.map((row) => row.id),
            ),
          );
        if (!channel) return;
        const [row] = await tx
          .insert(schema.notification)
          .values({
            orgId,
            userId,
            channel,
            kind: 'digest',
            objectType: 'digest',
            objectId: local(now).day,
            bundleKey: `${userId}:${channel}:digest`,
            delivery: 'now',
            status: 'sent',
            title,
            line: items
              .map((item) => item.title)
              .join(' · ')
              .slice(0, 300),
            href: '/mein-tag',
            sentAt: now,
          })
          .returning({ id: schema.notification.id });
        if (!row) return;
        if (channel === 'teams' && settings.teamsRef) {
          const messageRef = await this.teams.send(settings.teamsRef, {
            title,
            line: items.map((item) => `• ${item.title}`).join('\n'),
            buttons: [],
            openUrl: `${env.WEB_APP_URL}/mein-tag`,
            openLabel: text.open,
          });
          await tx
            .update(schema.notification)
            .set({ messageRef })
            .where(eq(schema.notification.id, row.id));
        } else {
          await this.mail(tx, orgId, person, row.id, 'digest', {
            title,
            message: items.map((item) => `• ${item.title}`).join('\n'),
            link: '/mein-tag',
          });
        }
      });
      sent += 1;
    }
    return sent;
  }

  /** Täglich: Zusagen, die in zwei Tagen fällig oder überfällig sind, an die verantwortliche Person */
  async runCommitmentsDue(orgId: string): Promise<number> {
    const today = local(this.clock()).day;
    const limit = new Date(`${today}T00:00:00Z`);
    limit.setUTCDate(limit.getUTCDate() + 2);
    const until = limit.toISOString().slice(0, 10);
    const users = await this.tenant.run(this.system(orgId), async (tx) =>
      (await this.isBuyer(tx, orgId))
        ? tx
            .select({ id: schema.appUser.id })
            .from(schema.appUser)
            .where(eq(schema.appUser.organizationId, orgId))
        : [],
    );
    let count = 0;
    for (const { id } of users) {
      const actor = await this.tenant.run({ userId: id, organizationId: orgId }, (tx) =>
        actorIn(tx, orgId, id),
      );
      if (!actor) continue;
      const due = (await this.commitments.dueItems(actor).catch(() => [])).filter(
        (item) => item.kind === 'commitment' && item.dueDate !== null && item.dueDate <= until,
      );
      for (const item of due) {
        await this.notify({
          orgId,
          userIds: [id],
          kind: 'commitment_due',
          objectType: 'commitment',
          objectId: item.id,
          title:
            `${item.dueDate && item.dueDate < today ? 'Überfällig' : 'Fällig'}: ${item.detail ?? ''}`.slice(
              0,
              200,
            ),
          line: item.supplier || null,
          href: item.href,
        });
        count += 1;
      }
    }
    return count;
  }

  // ------------------------------------------------------------- Knöpfe in Teams

  /**
   * Knopf auf einer Karte: läuft mit den Rechten der Person über den Domänendienst. Ohne Recht
   * scheitert er mit einem Hinweis auf der Karte, statt still nichts zu tun.
   */
  async act(
    auth: AuthContext,
    notificationId: string,
    input: NotificationAction,
  ): Promise<NotificationActionResult> {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    const de = (await this.localeOf(organization.id, auth.userId)) === 'de';
    const row = await this.tenant.run(this.system(organization.id), async (tx) => {
      const [found] = await tx
        .select()
        .from(schema.notification)
        .where(
          and(
            eq(schema.notification.id, notificationId),
            eq(schema.notification.userId, auth.userId),
          ),
        );
      return found;
    });
    if (!row || buttonFor[row.kind as EventKind] !== input.action) throw notFound();
    const noRight = {
      ok: false,
      message: de
        ? 'Dafür fehlt dir das Recht in Reziproq.'
        : 'You lack the permission in Reziproq.',
    };
    let result: NotificationActionResult;
    try {
      if (input.action === 'agenda_uebernehmen') {
        result = await this.adoptAgenda(auth, row.objectId, de);
      } else if (input.action === 'erledigt') {
        result = await this.commitmentDone(auth, row.objectId, de);
      } else {
        result = await this.assignInbound(auth, row.objectId, de);
      }
    } catch (error) {
      if (error instanceof ForbiddenException) result = noRight;
      else if (error instanceof NotFoundException) {
        result = { ok: false, message: de ? 'Nicht mehr offen.' : 'No longer open.' };
      } else throw error;
    }
    await this.tenant.run(this.system(organization.id), (tx) =>
      tx
        .update(schema.notification)
        .set({ actionTaken: result.ok ? input.action : `${input.action}:abgelehnt` })
        .where(eq(schema.notification.id, notificationId)),
    );
    return result;
  }

  private async meetingRelationship(auth: AuthContext, meetingId: string) {
    const organization = auth.organization as NonNullable<AuthContext['organization']>;
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const [row] = await tx
        .select({ relationshipId: schema.meeting.relationshipId })
        .from(schema.meeting)
        .where(eq(schema.meeting.id, meetingId));
      if (!row) throw notFound();
      return row.relationshipId;
    });
  }

  private async adoptAgenda(auth: AuthContext, meetingId: string, de: boolean) {
    if (!can(auth, 'termine.bearbeiten')) throw forbidden();
    const relationshipId = await this.meetingRelationship(auth, meetingId);
    const brief = await this.briefs.get(auth, relationshipId, meetingId);
    const agenda = brief.parts.agenda.draft;
    if (!agenda || agenda.status !== 'draft') throw notFound();
    await this.briefs.decide(auth, relationshipId, meetingId, agenda.id, { status: 'accepted' });
    return { ok: true, message: de ? 'Agenda übernommen.' : 'Agenda adopted.' };
  }

  private async commitmentDone(auth: AuthContext, commitmentId: string, de: boolean) {
    if (!can(auth, 'jbp.bearbeiten')) throw forbidden();
    const organization = auth.organization as NonNullable<AuthContext['organization']>;
    const relationshipId = await this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => {
        const [row] = await tx
          .select({ relationshipId: schema.commitment.relationshipId })
          .from(schema.commitment)
          .where(eq(schema.commitment.id, commitmentId));
        if (!row) throw notFound();
        return row.relationshipId;
      },
    );
    await this.jbp.buyer(auth, relationshipId, (scope) =>
      this.commitments.setStatus(scope, commitmentId, 'kept'),
    );
    return { ok: true, message: de ? 'Als erledigt markiert.' : 'Marked as done.' };
  }

  private async assignInbound(auth: AuthContext, inboundId: string, de: boolean) {
    const inbox = await this.intake.inbox(auth);
    const item = inbox.open.find((entry) => entry.id === inboundId);
    const target = item?.suggestions[0];
    if (!item || !target || item.suggestionKind !== 'supplier') throw notFound();
    await this.intake.decide(auth, inboundId, {
      action: 'assign',
      relationshipIds: [target.relationshipId],
      type: item.suggestedType,
    });
    return {
      ok: true,
      message: de ? `${target.name} zugeordnet.` : `Assigned to ${target.name}.`,
    };
  }

  // ------------------------------------------------------------- Einstellungen

  private personal(auth: AuthContext) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return { userId: auth.userId, organizationId: organization.id };
  }

  async prefs(auth: AuthContext): Promise<NotificationPrefs> {
    const session = this.personal(auth);
    const settings = await this.settingsOf(session.organizationId, auth.userId);
    return this.tenant.run(
      this.system(session.organizationId),
      async (tx) => {
        const org = await this.orgSettings(tx, session.organizationId);
        const recent = await tx
          .select()
          .from(schema.notification)
          .where(eq(schema.notification.userId, auth.userId))
          .orderBy(desc(schema.notification.createdAt))
          .limit(10);
        return notificationPrefsSchema.parse({
          modes: settings.modes,
          quietHours: settings.quietHours,
          teamsAvailable: org.teamsApp,
          teamsLinked: settings.teamsRef !== null,
          mailEnabled: org.mail,
          canManageOrganization: auth.orgRole === 'admin',
          recent: recent
            .filter((row) => (notificationKinds as readonly string[]).includes(row.kind))
            .map((row) => ({
              id: row.id,
              channel: row.channel,
              kind: row.kind,
              title: row.title,
              status: row.status,
              delivery: row.delivery,
              createdAt: row.createdAt.toISOString(),
            })),
        });
      },
      { readOnly: true },
    );
  }

  async savePrefs(auth: AuthContext, input: SaveNotificationPrefs): Promise<NotificationPrefs> {
    const data = saveNotificationPrefsSchema.parse(input);
    const session = this.personal(auth);
    const current = await this.settingsOf(session.organizationId, auth.userId);
    const modes = { ...current.modes, ...(data.modes ?? {}) };
    const quietHours = data.quietHours ?? current.quietHours;
    await this.tenant.run(session, async (tx) => {
      for (const kind of notificationKinds) {
        for (const channel of ['teams', 'mail'] as const) {
          await tx
            .insert(schema.notificationPref)
            .values({
              orgId: session.organizationId,
              userId: auth.userId,
              channel,
              kind,
              mode: modes[kind][channel],
              quietHours,
            })
            .onConflictDoUpdate({
              target: [
                schema.notificationPref.userId,
                schema.notificationPref.channel,
                schema.notificationPref.kind,
              ],
              set: { mode: modes[kind][channel], quietHours, updatedAt: currentTime() },
            });
        }
      }
    });
    return this.prefs(auth);
  }

  /**
   * „Teams verbinden“: Im Betrieb meldet sich der Bot nach der Installation mit dem Gesprächsverweis;
   * mit dem Testanbieter entsteht der Verweis sofort. Der Bot stellt sich mit einer Karte vor.
   */
  async linkTeams(auth: AuthContext): Promise<NotificationPrefs> {
    const session = this.personal(auth);
    const org = await this.tenant.run(this.system(session.organizationId), (tx) =>
      this.orgSettings(tx, session.organizationId),
    );
    if (!org.teamsApp) {
      throw new ForbiddenException({ statusCode: 403, code: 'teams_nicht_freigeschaltet' });
    }
    const ref = `fake:${auth.userId}`;
    await this.tenant.run(session, (tx) =>
      tx
        .insert(schema.notificationChannel)
        .values({
          orgId: session.organizationId,
          userId: auth.userId,
          channel: 'teams',
          conversationRef: ref,
        })
        .onConflictDoNothing(),
    );
    const de = (await this.localeOf(session.organizationId, auth.userId)) === 'de';
    await this.teams.send(ref, {
      title: de ? 'Hallo, hier ist Reziproq.' : 'Hello, this is Reziproq.',
      line: de
        ? 'Hier bekommst du, was in Mein Tag wichtig ist. Was und wann, stellst du selbst ein.'
        : 'You get what matters in My day here. You choose what and when.',
      buttons: [],
      openUrl: `${env.WEB_APP_URL}/profil/benachrichtigungen`,
      openLabel: de ? 'Einstellungen öffnen' : 'Open settings',
    });
    return this.prefs(auth);
  }

  async unlinkTeams(auth: AuthContext): Promise<NotificationPrefs> {
    const session = this.personal(auth);
    await this.tenant.run(session, (tx) =>
      tx
        .delete(schema.notificationChannel)
        .where(
          and(
            eq(schema.notificationChannel.userId, auth.userId),
            eq(schema.notificationChannel.channel, 'teams'),
          ),
        ),
    );
    return this.prefs(auth);
  }

  /** Admin: Teams-App (in Microsoft 365 freigeschaltet) und Mailversand für die Organisation */
  async saveOrganization(
    auth: AuthContext,
    input: SaveNotificationOrg,
  ): Promise<NotificationPrefs> {
    const data = saveNotificationOrgSchema.parse(input);
    const session = this.personal(auth);
    if (auth.orgRole !== 'admin' || !can(auth, 'einstellungen.verwalten')) throw forbidden();
    await this.tenant.run(session, async (tx) => {
      for (const [key, value] of [
        ['notify_teams_app', data.teamsApp],
        ['notify_mail', data.mail],
      ] as const) {
        if (value === undefined) continue;
        await tx
          .insert(schema.orgSetting)
          .values({ orgId: session.organizationId, key, value, updatedBy: auth.userId })
          .onConflictDoUpdate({
            target: [schema.orgSetting.orgId, schema.orgSetting.key],
            set: { value, updatedBy: auth.userId, updatedAt: currentTime() },
          });
      }
    });
    return this.prefs(auth);
  }

  /** Organisationen mit Käuferseite, für die täglichen Läufe */
  async buyerOrganizations(): Promise<string[]> {
    return (await this.accounts.customers()).map((customer) => customer.id);
  }

  /** Sprache der Person für Texte auf Karten */
  private async localeOf(orgId: string, userId: string): Promise<'de' | 'en'> {
    const person = await this.tenant.run(this.system(orgId), (tx) =>
      this.person(tx, orgId, userId),
    );
    return person?.locale ?? 'de';
  }
}
