import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { and, desc, eq, gte, inArray, or, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  type AddinDetect,
  type AddinRegister,
  type AddinRegistered,
  addinRegisterSchema,
  type DecideInbound,
  type InboundItemView,
  type Inbox,
  type MeetingType,
  meetingTypes,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { actorIn } from '../integrations/actor.js';
import type { ProviderItem } from '../integrations/fake-provider.js';
import { GRAPH_CLIENT, type GraphClient } from '../integrations/graph-client.js';
import { IntegrationsService } from '../integrations/integrations.service.js';
import { type ItemContext, ItemHandlers, type ItemOutcome } from '../integrations/item-handlers.js';
import { MeetingsService } from '../meetings/meetings.service.js';
import { sroOf } from '../suppliers/team.service.js';
import {
  domainOf,
  guessMeetingType,
  isPublicDomain,
  isReziproqAddress,
  replaceAgendaBlock,
  similarSubject,
} from './calendar-rules.js';
import { type IcsEvent, type IcsPerson, parseIcs } from './ics.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const systemUser = 'system:kalender';
/** So lange nach dem Speichern im Add-in wird die Einladung damit verknüpft */
const registrationWindowMs = 30 * 60 * 1000;
/** Mehr Lieferanten im Termin: eher ein Ereignis (Messe, Lieferantentag) */
const maxSuppliers = 5;

type InboundRow = typeof schema.inboundItem.$inferSelect;
type Source = InboundRow['source'];

interface Match {
  relationshipId: string;
  name: string;
  domains: string[];
}

export const defaultTranscriptNotice =
  'Hinweis: Mit Zustimmung aller Teilnehmenden wird das Transkript dieses Termins in Reziproq übernommen.';

/**
 * IN-03 Termine aus Outlook und Google. Einladungen an die Eingangsadresse, Termine aus dem
 * Kalenderabgleich und Registrierungen aus dem Outlook-Add-in werden über die Mail-Domains der
 * Teilnehmer einem Lieferanten zugeordnet. Eindeutige werden ein interner Termin (Entscheidung F6),
 * alles andere landet in „Neu eingegangen“. Termine legt nur an, wer bei dem Lieferanten Termine
 * anlegen darf; sonst geht der Eingang an den SRO.
 */
@Injectable()
export class CalendarIntakeService implements OnModuleInit {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(MeetingsService) private readonly meetings: MeetingsService,
    @Inject(IntegrationsService) private readonly integrations: IntegrationsService,
    @Inject(ItemHandlers) private readonly handlers: ItemHandlers,
    @Inject(GRAPH_CLIENT) private readonly graph: GraphClient,
  ) {}

  /** IN-04: weitergeleitete Mails in „Neu eingegangen“ legt der Mail-Dienst ab bzw. verwirft sie */
  mailDecider:
    | {
        assign: (
          auth: AuthContext,
          inboundId: string,
          relationshipId: string,
        ) => Promise<string | null>;
        discard: (orgId: string, inboundId: string) => Promise<void>;
      }
    | undefined;

  onModuleInit() {
    this.handlers.register('calendar_invite', (context, item) => this.fromMail(context, item));
    this.handlers.register('calendar_event', (context, item) => this.fromCalendar(context, item));
    this.meetings.agendaListener = async (input) => {
      await this.pushAgenda(input);
    };
  }

  private system(orgId: string) {
    return { userId: systemUser, organizationId: orgId };
  }

  // ------------------------------------------------------------- Weg 2: Eingangsadresse

  /**
   * Einladung an die Eingangsadresse: nur mit gültigem SPF und DKIM und von zugelassenen Absendern.
   * Gelesen wird nur der iCalendar-Teil.
   */
  async fromMail(context: ItemContext, item: ProviderItem): Promise<ItemOutcome> {
    const data = item.data ?? {};
    const from = typeof data.from === 'string' ? data.from.toLowerCase() : '';
    if (data.spf !== 'pass' || data.dkim !== 'pass') {
      return { status: 'rejected', reason: 'absender_nicht_geprueft' };
    }
    const allowed = Array.isArray(context.settings.allowedDomains)
      ? (context.settings.allowedDomains as string[])
      : [];
    if (!allowed.includes(domainOf(from))) {
      return { status: 'rejected', reason: 'absender_nicht_zugelassen' };
    }
    const calendar = parseIcs(typeof data.ics === 'string' ? data.ics : '');
    const event = calendar.events[0];
    if (!event) return { status: 'ignored', reason: 'kein_termin' };
    return this.ingest(context.orgId, 'inbound_mail', event, {
      cancel: calendar.method === 'CANCEL',
      fromEmail: from,
      ownerUserId: null,
    });
  }

  // ------------------------------------------------------------- Weg 3: Kalender abgleichen

  /** Termin aus dem Kalender einer Person: landet immer in „Neu eingegangen“, nie automatisch. */
  async fromCalendar(context: ItemContext, item: ProviderItem): Promise<ItemOutcome> {
    const data = item.data ?? {};
    const startsAt = typeof data.startsAt === 'string' ? new Date(data.startsAt) : null;
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return { status: 'ignored', reason: 'kein_termin' };
    }
    const people = Array.isArray(data.attendees) ? (data.attendees as IcsPerson[]) : [];
    const event: IcsEvent = {
      uid: typeof data.uid === 'string' ? data.uid : null,
      sequence: typeof data.sequence === 'number' ? data.sequence : 0,
      summary: typeof data.subject === 'string' ? data.subject : '',
      startsAt,
      endsAt: typeof data.endsAt === 'string' ? new Date(data.endsAt) : null,
      location: typeof data.location === 'string' ? data.location : null,
      onlineMeetingUrl: null,
      organizer: null,
      attendees: people.filter((entry) => typeof entry?.email === 'string'),
    };
    return this.ingest(context.orgId, 'calendar_sync', event, {
      cancel: data.cancelled === true,
      fromEmail: null,
      ownerUserId: context.userId,
      reviewOnly: true,
    });
  }

  // ------------------------------------------------------------- Zuordnung

  private async ownDomains(tx: TenantTransaction, orgId: string): Promise<Set<string>> {
    const rows = await tx.execute<{ domain: string }>(sql`
      select distinct lower(split_part(email, '@', 2)) as domain from app_user
      where organization_id = ${orgId}`);
    return new Set(rows.rows.map((row) => row.domain));
  }

  /** Lieferanten zu Domains: gepflegt oder gelernt (supplier_domain) und aus den Kontakten */
  private async matches(tx: TenantTransaction, orgId: string, domains: string[]): Promise<Match[]> {
    const wanted = domains.filter((domain) => domain && !isPublicDomain(domain));
    if (wanted.length === 0) return [];
    const rows = await tx.execute<{ relationship_id: string; name: string; domain: string }>(sql`
      with found as (
        select d.relationship_id, d.domain from supplier_domain d
        where d.org_id = ${orgId} and d.domain in ${wanted}
        union
        select c.relationship_id, lower(split_part(c.email, '@', 2)) from supplier_contact c
        join relationship r on r.id = c.relationship_id and r.buyer_org_id = ${orgId}
        where lower(split_part(c.email, '@', 2)) in ${wanted}
      )
      select f.relationship_id, coalesce(s.display_name, o.name) as name, f.domain
      from found f
      join relationship r on r.id = f.relationship_id and r.status <> 'ended'
      join organization o on o.id = r.supplier_org_id
      left join relationship_side s on s.relationship_id = r.id and s.org_id = ${orgId}
      order by name, f.domain`);
    const byId = new Map<string, Match>();
    for (const row of rows.rows) {
      const match = byId.get(row.relationship_id) ?? {
        relationshipId: row.relationship_id,
        name: row.name,
        domains: [],
      };
      match.domains.push(row.domain);
      byId.set(row.relationship_id, match);
    }
    return [...byId.values()];
  }

  private async userByEmail(tx: TenantTransaction, orgId: string, email: string | null) {
    if (!email) return null;
    const [row] = await tx
      .select({ id: schema.appUser.id })
      .from(schema.appUser)
      .where(
        and(
          eq(schema.appUser.organizationId, orgId),
          sql`lower(${schema.appUser.email}) = ${email.toLowerCase()}`,
        ),
      );
    return row?.id ?? null;
  }

  private durationOf(event: IcsEvent) {
    return event.endsAt
      ? Math.round((event.endsAt.getTime() - event.startsAt.getTime()) / 60_000)
      : 60;
  }

  /**
   * Ein Termin aus Einladung oder Kalender. Bekannte UID: aktualisieren oder absagen. Sonst über
   * die Domains zuordnen: eindeutig und mit Zugriff → interner Termin; alles andere → Eingang.
   */
  private async ingest(
    orgId: string,
    source: Source,
    event: IcsEvent,
    options: {
      cancel: boolean;
      fromEmail: string | null;
      ownerUserId: string | null;
      reviewOnly?: boolean;
    },
  ): Promise<ItemOutcome> {
    // 1. Schon bekannt: Termine mit dieser UID aktualisieren bzw. absagen
    if (event.uid) {
      const changed = await this.meetings.calendarUpdate(orgId, event.uid, {
        sequence: event.sequence,
        cancel: options.cancel,
        title: event.summary,
        startsAt: event.startsAt,
        durationMinutes: this.durationOf(event),
        location: event.location,
        onlineMeetingUrl: event.onlineMeetingUrl,
      });
      const pending = await this.tenant.run(this.system(orgId), async (tx) => {
        const [row] = await tx
          .select()
          .from(schema.inboundItem)
          .where(
            and(
              eq(schema.inboundItem.orgId, orgId),
              eq(schema.inboundItem.icalUid, event.uid as string),
            ),
          )
          .orderBy(desc(schema.inboundItem.receivedAt))
          .limit(1);
        if (row?.status === 'needs_review' && (options.cancel || event.sequence > row.sequence)) {
          await tx
            .update(schema.inboundItem)
            .set(
              options.cancel
                ? { status: 'ignored', suggestionReason: 'Abgesagt' }
                : {
                    subject: event.summary.slice(0, 500),
                    sequence: event.sequence,
                    details: { ...row.details, startsAt: event.startsAt.toISOString() },
                  },
            )
            .where(eq(schema.inboundItem.id, row.id));
        }
        return row ?? null;
      });
      if (changed.length > 0) {
        return { status: 'applied', objectType: 'meeting', objectId: changed[0] ?? null };
      }
      if (pending) return { status: 'ignored', reason: 'schon_bekannt' };
    }
    if (options.cancel) return { status: 'ignored', reason: 'unbekannt_abgesagt' };

    const prepared = await this.tenant.run(this.system(orgId), async (tx) => {
      const own = await this.ownDomains(tx, orgId);
      const people = [...(event.organizer ? [event.organizer] : []), ...event.attendees].filter(
        (entry) => !isReziproqAddress(entry.email),
      );
      const external = people.filter((entry) => !own.has(domainOf(entry.email)));
      const matches = await this.matches(tx, orgId, [
        ...new Set(external.map((entry) => domainOf(entry.email))),
      ]);
      const organizerUserId = await this.userByEmail(tx, orgId, event.organizer?.email ?? null);
      // Registrierung aus dem Add-in: gleicher Organisator, gleicher Beginn, ähnlicher Betreff
      const [registration] =
        source === 'inbound_mail' && event.organizer
          ? (
              await tx
                .select()
                .from(schema.addinRegistration)
                .where(
                  and(
                    eq(schema.addinRegistration.orgId, orgId),
                    sql`lower(${schema.addinRegistration.organizerEmail}) = ${event.organizer.email}`,
                    eq(schema.addinRegistration.startAt, event.startsAt),
                    sql`${schema.addinRegistration.matchedMeetingId} is null`,
                    gte(
                      schema.addinRegistration.createdAt,
                      new Date(Date.now() - registrationWindowMs),
                    ),
                  ),
                )
                .orderBy(desc(schema.addinRegistration.createdAt))
            ).filter((row) => similarSubject(row.subject, event.summary))
          : [];
      return { people, external, matches, organizerUserId, registration };
    });
    const { people, external, matches, organizerUserId, registration } = prepared;
    // 2. Nur eigene Teilnehmer: nichts speichern, auch nicht den Betreff
    if (external.length === 0 && !registration) {
      return { status: 'ignored', reason: 'nur_eigene_teilnehmer' };
    }
    // Kalenderabgleich ohne Lieferant: nichts speichern
    if (options.reviewOnly && matches.length === 0) {
      return { status: 'ignored', reason: 'kein_lieferant' };
    }
    const type: MeetingType =
      (registration && (meetingTypes as readonly string[]).includes(registration.meetingType)
        ? (registration.meetingType as MeetingType)
        : null) ?? guessMeetingType(event.summary);
    const relationshipIds = registration?.relationshipId
      ? [registration.relationshipId]
      : matches.map((match) => match.relationshipId);
    const ownDomain = (email: string) => !external.some((entry) => entry.email === email);
    const attendees = people.map((entry) => ({
      email: entry.email,
      name: entry.name,
      side: ownDomain(entry.email) ? ('buyer' as const) : ('supplier' as const),
      userId: null,
      response: entry.response,
    }));

    // 3. Eindeutig und mit Zugriff der einladenden Person: interner Termin
    const relationshipId = relationshipIds[0];
    if (!options.reviewOnly && relationshipIds.length === 1 && relationshipId && organizerUserId) {
      const meetingId = await this.createFor(orgId, organizerUserId, relationshipId, {
        source: registration ? 'outlook_addin' : source,
        event,
        type,
        attendees,
        registration: registration ?? null,
      });
      if (meetingId) {
        await this.tenant.run(this.system(orgId), async (tx) => {
          await tx.insert(schema.inboundItem).values({
            orgId,
            source: registration ? 'outlook_addin' : source,
            fromEmail: options.fromEmail,
            subject: event.summary.slice(0, 500) || '–',
            icalUid: event.uid,
            sequence: event.sequence,
            details: this.details(event, options.cancel),
            suggestedRelationshipIds: relationshipIds,
            suggestionKind: 'supplier',
            suggestionReason: this.reasonFor(matches, registration !== undefined),
            suggestedType: type,
            status: 'auto_assigned',
            ownerUserId: organizerUserId,
            assignedAt: new Date(),
            objectType: 'meeting',
            objectIds: [meetingId],
            registrationId: registration?.id ?? null,
          });
          if (registration) {
            await tx
              .update(schema.addinRegistration)
              .set({ matchedMeetingId: meetingId })
              .where(eq(schema.addinRegistration.id, registration.id));
          }
        });
        return { status: 'applied', objectType: 'meeting', objectId: meetingId };
      }
    }

    // 4. Sonst: Eingang zur Zuordnung; ohne Zugriff an den SRO des Lieferanten
    const kind =
      relationshipIds.length === 0
        ? ('none' as const)
        : relationshipIds.length > maxSuppliers
          ? ('event' as const)
          : relationshipIds.length > 1
            ? ('several' as const)
            : ('supplier' as const);
    const id = await this.tenant.run(this.system(orgId), async (tx) => {
      const owner = options.ownerUserId ?? organizerUserId;
      let assignee = owner;
      if (kind === 'supplier' && relationshipId && !options.reviewOnly) {
        const organization = await this.organizationOf(tx, orgId);
        assignee = (await sroOf(tx, organization, relationshipId))?.userId ?? owner;
      }
      const [row] = await tx
        .insert(schema.inboundItem)
        .values({
          orgId,
          source,
          fromEmail: options.fromEmail,
          subject: event.summary.slice(0, 500) || '–',
          icalUid: event.uid,
          sequence: event.sequence,
          details: this.details(event, false),
          suggestedRelationshipIds: kind === 'event' ? [] : relationshipIds.slice(0, maxSuppliers),
          suggestionKind: kind,
          suggestionReason:
            kind === 'none'
              ? `Teilnehmer von ${[...new Set(external.map((entry) => domainOf(entry.email)))].join(', ')} sind noch keinem Lieferanten zugeordnet.`
              : kind === 'event'
                ? `Teilnehmer von mehr als ${maxSuppliers} Lieferanten: eher ein Ereignis ohne Lieferant.`
                : kind === 'several'
                  ? this.reasonFor(matches, false)
                  : options.reviewOnly
                    ? `${this.reasonFor(matches, false)} Aus deinem Kalender, deshalb zur Bestätigung.`
                    : `${this.reasonFor(matches, false)} Die einladende Person darf bei diesem Lieferanten keine Termine anlegen.`,
          suggestedType: type,
          status: 'needs_review',
          ownerUserId: owner,
          assigneeUserId: assignee,
          registrationId: registration?.id ?? null,
        })
        .returning({ id: schema.inboundItem.id });
      return row?.id ?? null;
    });
    return { status: 'applied', objectType: 'inbound_item', objectId: id };
  }

  private reasonFor(matches: Match[], fromAddin: boolean) {
    if (fromAddin) return 'Im Outlook-Add-in so gespeichert.';
    return matches
      .map((match) => `${match.name}: Teilnehmer von ${match.domains.join(', ')}`)
      .join(' · ')
      .concat('.');
  }

  private details(event: IcsEvent, cancel: boolean) {
    return {
      method: cancel ? ('CANCEL' as const) : ('REQUEST' as const),
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      location: event.location,
      onlineMeetingUrl: event.onlineMeetingUrl,
      organizerEmail: event.organizer?.email ?? null,
      organizerName: event.organizer?.name ?? null,
      attendees: event.attendees.slice(0, 200),
    };
  }

  private async organizationOf(tx: TenantTransaction, orgId: string) {
    const [row] = await tx
      .select({ name: schema.organization.name, country: schema.organization.country })
      .from(schema.organization)
      .where(eq(schema.organization.id, orgId));
    return { id: orgId, name: row?.name ?? '', country: row?.country ?? null, buyer: true };
  }

  /** Termin über den Domänendienst mit den Rechten dieser Person; null ohne Zugriff */
  private async createFor(
    orgId: string,
    userId: string,
    relationshipId: string,
    input: {
      source: Source | 'outlook_addin';
      event: IcsEvent;
      type: MeetingType;
      attendees: Parameters<MeetingsService['createFromCalendar']>[1]['attendees'];
      registration: typeof schema.addinRegistration.$inferSelect | null;
    },
  ): Promise<string | null> {
    const actor = await this.tenant.run({ userId, organizationId: orgId }, (tx) =>
      actorIn(tx, orgId, userId),
    );
    if (!actor) return null;
    return this.createAs(actor, relationshipId, input).catch(() => null);
  }

  private createAs(
    auth: AuthContext,
    relationshipId: string,
    input: {
      source: Source | 'outlook_addin';
      event: IcsEvent;
      type: MeetingType;
      attendees: Parameters<MeetingsService['createFromCalendar']>[1]['attendees'];
      registration: typeof schema.addinRegistration.$inferSelect | null;
    },
  ): Promise<string | null> {
    const { event, registration } = input;
    return this.meetings.buyer(auth, relationshipId, async (scope) => {
      if (!scope.canEdit) return null;
      return this.meetings.createFromCalendar(scope, {
        type: input.type,
        title: event.summary || 'Termin',
        startsAt: event.startsAt,
        durationMinutes: this.durationOf(event),
        location: event.location,
        source: input.source,
        icalUid: event.uid,
        sequence: event.sequence,
        organizerEmail: event.organizer?.email ?? null,
        onlineMeetingUrl: event.onlineMeetingUrl,
        briefOptIn: registration?.briefOptIn ?? true,
        transcriptOptIn: registration?.transcriptOptIn ?? false,
        insertAgenda: registration?.insertAgenda ?? false,
        externalIds: registration?.eventId ? { outlook: registration.eventId } : {},
        attendees: input.attendees,
      });
    });
  }

  // ------------------------------------------------------------- Neu eingegangen

  private session(auth: AuthContext) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return { userId: auth.userId, organizationId: organization.id };
  }

  /** Eingänge der Person: eigene, als SRO zugewiesene; Admins sehen auch Eingänge ohne Person. */
  async inbox(auth: AuthContext): Promise<Inbox> {
    const session = this.session(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        const orgId = session.organizationId;
        const mine = or(
          eq(schema.inboundItem.assigneeUserId, auth.userId),
          eq(schema.inboundItem.ownerUserId, auth.userId),
          ...(auth.orgRole === 'admin' ? [sql`${schema.inboundItem.assigneeUserId} is null`] : []),
        );
        const open = await tx
          .select()
          .from(schema.inboundItem)
          .where(
            and(
              eq(schema.inboundItem.orgId, orgId),
              eq(schema.inboundItem.status, 'needs_review'),
              mine,
            ),
          )
          .orderBy(desc(schema.inboundItem.receivedAt))
          .limit(100);
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const today = await tx
          .select()
          .from(schema.inboundItem)
          .where(
            and(
              eq(schema.inboundItem.orgId, orgId),
              inArray(schema.inboundItem.status, ['auto_assigned', 'assigned']),
              gte(schema.inboundItem.assignedAt, startOfDay),
              mine,
            ),
          )
          .orderBy(desc(schema.inboundItem.assignedAt))
          .limit(50);
        const suppliers = await tx.execute<{ id: string; name: string }>(sql`
          select r.id, coalesce(s.display_name, o.name) as name from relationship r
          join organization o on o.id = r.supplier_org_id
          left join relationship_side s on s.relationship_id = r.id and s.org_id = ${orgId}
          where r.buyer_org_id = ${orgId} and r.status <> 'ended' order by name`);
        const names = new Map(suppliers.rows.map((row) => [row.id, row.name]));
        const meetingRows = await this.meetingsOf(
          tx,
          today.filter((row) => row.objectType === 'meeting').flatMap((row) => row.objectIds),
        );
        const mailIds = today
          .filter((row) => row.objectType === 'filed_mail')
          .flatMap((row) => row.objectIds);
        const mailRows = new Map(
          mailIds.length === 0
            ? []
            : (
                await tx
                  .select({
                    id: schema.filedMail.id,
                    relationshipId: schema.filedMail.relationshipId,
                  })
                  .from(schema.filedMail)
                  .where(inArray(schema.filedMail.id, mailIds))
              ).map((mail) => [mail.id, mail.relationshipId]),
        );
        const [active] = await tx
          .select({ id: schema.connection.id })
          .from(schema.connection)
          .where(
            and(
              eq(schema.connection.status, 'active'),
              inArray(schema.connection.connectorKey, [
                'inbound_mail',
                'microsoft365',
                'google_workspace',
              ]),
            ),
          )
          .limit(1);
        const view = (row: InboundRow): InboundItemView => ({
          id: row.id,
          kind: row.kind,
          source: row.source,
          receivedAt: row.receivedAt.toISOString(),
          subject: row.subject,
          startsAt: row.details.startsAt,
          organizer: row.details.organizerName ?? row.details.organizerEmail ?? row.fromEmail,
          attendees: row.details.attendees?.length ?? 0,
          suggestionKind: row.suggestionKind,
          suggestions: row.suggestedRelationshipIds
            .filter((id) => names.has(id))
            .map((id) => ({ relationshipId: id, name: names.get(id) ?? '' })),
          suggestionReason: row.suggestionReason,
          suggestedType: (meetingTypes as readonly string[]).includes(row.suggestedType)
            ? (row.suggestedType as MeetingType)
            : 'other',
          status: row.status,
          objectType: row.objectType,
          assigned: row.objectIds.flatMap((objectId): InboundItemView['assigned'] => {
            if (row.objectType === 'filed_mail') {
              const relationshipId = mailRows.get(objectId);
              return relationshipId
                ? [
                    {
                      relationshipId,
                      name: names.get(relationshipId) ?? '',
                      meetingId: null,
                      mailId: objectId,
                    },
                  ]
                : [];
            }
            const meeting = meetingRows.get(objectId);
            return meeting
              ? [
                  {
                    relationshipId: meeting,
                    name: names.get(meeting) ?? '',
                    meetingId: objectId,
                    mailId: null,
                  },
                ]
              : [];
          }),
        });
        return {
          open: open.map(view),
          today: today.map(view),
          suppliers: suppliers.rows.map((row) => ({ relationshipId: row.id, name: row.name })),
          active: Boolean(active) || open.length > 0,
        };
      },
      { readOnly: true },
    );
  }

  /** Termin-ID → Beziehung */
  private async meetingsOf(tx: TenantTransaction, ids: string[]) {
    if (ids.length === 0) return new Map<string, string>();
    const rows = await tx
      .select({ id: schema.meeting.id, relationshipId: schema.meeting.relationshipId })
      .from(schema.meeting)
      .where(inArray(schema.meeting.id, ids));
    return new Map(rows.map((row) => [row.id, row.relationshipId]));
  }

  /** Zuordnen, als Ereignis speichern oder ignorieren. Zuordnen lernt die Domains. */
  async decide(auth: AuthContext, id: string, input: DecideInbound): Promise<Inbox> {
    const session = this.session(auth);
    const orgId = session.organizationId;
    const row = await this.tenant.run(session, async (tx) => {
      const [found] = await tx
        .select()
        .from(schema.inboundItem)
        .where(and(eq(schema.inboundItem.id, id), eq(schema.inboundItem.orgId, orgId)));
      return found;
    });
    if (row?.status !== 'needs_review') throw notFound();
    const allowed =
      row.assigneeUserId === auth.userId ||
      row.ownerUserId === auth.userId ||
      auth.orgRole === 'admin';
    if (!allowed) throw forbidden();
    // IN-04: Eine weitergeleitete Mail gehört zu genau einem Lieferanten; kein Termin, kein Ereignis
    if (row.kind === 'mail') {
      if (!this.mailDecider) throw notFound();
      if (input.action === 'assign') {
        const [relationshipId, ...rest] = input.relationshipIds;
        if (!relationshipId || rest.length > 0) throw forbidden();
        const mailId = await this.mailDecider.assign(auth, id, relationshipId);
        await this.tenant.run(session, (tx) =>
          tx
            .update(schema.inboundItem)
            .set({
              status: 'assigned',
              assignedBy: auth.userId,
              assignedAt: new Date(),
              objectType: 'filed_mail',
              objectIds: mailId ? [mailId] : [],
            })
            .where(eq(schema.inboundItem.id, id)),
        );
      } else {
        await this.mailDecider.discard(orgId, id);
        await this.tenant.run(session, (tx) =>
          tx
            .update(schema.inboundItem)
            .set({ status: 'ignored', assignedBy: auth.userId, assignedAt: new Date() })
            .where(eq(schema.inboundItem.id, id)),
        );
      }
      return this.inbox(auth);
    }
    if (input.action === 'assign') {
      const event: IcsEvent = {
        uid: row.icalUid,
        sequence: row.sequence,
        summary: row.subject,
        startsAt: new Date(row.details.startsAt),
        endsAt: row.details.endsAt ? new Date(row.details.endsAt) : null,
        location: row.details.location,
        onlineMeetingUrl: row.details.onlineMeetingUrl,
        organizer: row.details.organizerEmail
          ? { email: row.details.organizerEmail, name: row.details.organizerName, response: null }
          : null,
        attendees: row.details.attendees ?? [],
      };
      const meetingIds: string[] = [];
      for (const relationshipId of [...new Set(input.relationshipIds)]) {
        // Mit den Rechten der entscheidenden Person; ohne Zugriff 403 vom Domänendienst
        const meetingId = await this.createAs(auth, relationshipId, {
          source: row.source,
          event,
          type: input.type,
          attendees: event.attendees.map((entry) => ({
            email: entry.email,
            name: entry.name,
            side: 'unknown' as const,
            userId: null,
            response: entry.response,
          })),
          registration: null,
        });
        if (!meetingId) throw forbidden();
        meetingIds.push(meetingId);
      }
      await this.tenant.run(session, async (tx) => {
        // Eine Entscheidung für genau einen Lieferanten lernt die fremden Domains
        const only = input.relationshipIds.length === 1 ? input.relationshipIds[0] : undefined;
        if (only) {
          const own = await this.ownDomains(tx, orgId);
          const domains = [
            ...new Set(
              [...event.attendees, ...(event.organizer ? [event.organizer] : [])]
                .map((entry) => domainOf(entry.email))
                .filter(
                  (domain) =>
                    domain &&
                    !own.has(domain) &&
                    !isPublicDomain(domain) &&
                    !domain.endsWith('reziproq.de'),
                ),
            ),
          ];
          if (domains.length > 0) {
            await tx
              .insert(schema.supplierDomain)
              .values(
                domains.map((domain) => ({
                  orgId,
                  relationshipId: only,
                  domain,
                  source: 'learned' as const,
                  createdBy: auth.userId,
                })),
              )
              .onConflictDoNothing();
          }
        }
        await tx
          .update(schema.inboundItem)
          .set({
            status: 'assigned',
            assignedBy: auth.userId,
            assignedAt: new Date(),
            objectType: 'meeting',
            objectIds: meetingIds,
          })
          .where(eq(schema.inboundItem.id, id));
      });
    } else {
      await this.tenant.run(session, (tx) =>
        tx
          .update(schema.inboundItem)
          .set(
            input.action === 'event'
              ? {
                  status: 'assigned',
                  assignedBy: auth.userId,
                  assignedAt: new Date(),
                  objectType: 'event',
                }
              : { status: 'ignored', assignedBy: auth.userId, assignedAt: new Date() },
          )
          .where(eq(schema.inboundItem.id, id)),
      );
    }
    return this.inbox(auth);
  }

  /** Zahl der offenen Eingänge der Person (Mein Tag) */
  async openCount(auth: AuthContext): Promise<number> {
    return (await this.inbox(auth)).open.length;
  }

  // ------------------------------------------------------------- Weg 1: Outlook-Add-in

  /** Erkannter Lieferant zu den Teilnehmern eines Termins in Bearbeitung */
  async detect(
    auth: AuthContext,
    input: { attendees: string[]; subject: string },
  ): Promise<AddinDetect> {
    const session = this.session(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        const own = await this.ownDomains(tx, session.organizationId);
        const domains = [
          ...new Set(
            input.attendees
              .filter((email) => !isReziproqAddress(email))
              .map(domainOf)
              .filter((domain) => !own.has(domain)),
          ),
        ];
        const matches = await this.matches(tx, session.organizationId, domains);
        const candidates = matches.map((match) => ({
          relationshipId: match.relationshipId,
          name: match.name,
        }));
        return {
          supplier: candidates.length === 1 ? (candidates[0] ?? null) : null,
          candidates,
          reason: matches.length > 0 ? this.reasonFor(matches, false) : null,
          suggestedType: guessMeetingType(input.subject),
        };
      },
      { readOnly: true },
    );
  }

  /**
   * „Als Aktivität speichern“ im Add-in: legt die Registrierung an. Die Einladung über die
   * Eingangsadresse wird später damit verknüpft; Termintyp und Schalter gelten dann.
   */
  async register(auth: AuthContext, input: AddinRegister): Promise<AddinRegistered> {
    const data = addinRegisterSchema.parse(input);
    const session = this.session(auth);
    const allowed = await this.meetings.buyer(
      auth,
      data.relationshipId,
      async (scope) => scope.canEdit,
    );
    if (!allowed || !can(auth, 'termine.bearbeiten')) throw forbidden();
    const id = await this.tenant.run(session, async (tx) => {
      const [row] = await tx
        .insert(schema.addinRegistration)
        .values({
          orgId: session.organizationId,
          userId: auth.userId,
          organizerEmail: data.organizerEmail.toLowerCase(),
          subject: data.subject,
          startAt: new Date(data.startAt),
          relationshipId: data.relationshipId,
          meetingType: data.type,
          briefOptIn: data.briefOptIn,
          transcriptOptIn: data.transcriptOptIn,
          insertAgenda: data.insertAgenda,
          eventId: data.eventId ?? null,
        })
        .returning({ id: schema.addinRegistration.id });
      return row?.id ?? '';
    });
    const inbound = await this.integrations.inboundMailOf(session.organizationId);
    return {
      registrationId: id,
      inboundAddress: inbound?.address ?? null,
      transcriptNotice: data.transcriptOptIn ? defaultTranscriptNotice : null,
    };
  }

  // ------------------------------------------------------------- Agenda einfügen

  /**
   * Nach „Agenda übernehmen“ (KI-07): Bei „Agenda einfügen“ schreibt Reziproq die Agenda über
   * Microsoft Graph mit den Rechten des Organisators in die Einladung, nur in den markierten Block.
   */
  async pushAgenda(input: {
    orgId: string;
    meetingId: string;
    items: { title: string; detail: string | null }[];
  }): Promise<boolean> {
    const meeting = await this.tenant.run(this.system(input.orgId), async (tx) => {
      const [row] = await tx
        .select()
        .from(schema.meeting)
        .where(
          and(eq(schema.meeting.id, input.meetingId), eq(schema.meeting.ownerOrgId, input.orgId)),
        );
      if (!row?.insertAgenda || !row.externalIds.outlook || !row.organizerEmail) return null;
      const userId = await this.userByEmail(tx, input.orgId, row.organizerEmail);
      return userId ? { eventId: row.externalIds.outlook, userId } : null;
    });
    if (!meeting) return false;
    const done = await this.integrations.withUserToken(
      input.orgId,
      meeting.userId,
      'microsoft365',
      async (token) => {
        const body = (await this.graph.getEventBody(token, meeting.eventId)) ?? '';
        await this.graph.updateEventBody(
          token,
          meeting.eventId,
          replaceAgendaBlock(body, input.items, 'Agenda'),
        );
        return true;
      },
    );
    return done ?? false;
  }
}
