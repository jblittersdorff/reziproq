import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type ConfirmWorksAgreement,
  confirmWorksAgreementSchema,
  defaultInviteNotice,
  type MeetingTranscriptState,
  maxCaptureChars,
  type SaveTranscriptSettings,
  saveTranscriptSettingsSchema,
  type TranscriptEntry,
  type TranscriptSettings,
  type TranscriptText,
  transcriptEntrySchema,
  transcriptSettingsSchema,
} from '@reziproq/shared';
import { z } from 'zod';
import { TenantDatabase } from '../../common/database.module.js';
import { FILE_STORE, type FileStore } from '../../common/file-store.js';
import { NotificationBus } from '../../common/notification-bus.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { actorIn } from '../integrations/actor.js';
import { IntegrationsService } from '../integrations/integrations.service.js';
import { MeetingCaptureService } from '../meetings/meeting-capture.service.js';
import { type MeetingScope, MeetingsService } from '../meetings/meetings.service.js';
import {
  TRANSCRIPT_CLIENT,
  type TranscriptClient,
  type TranscriptResult,
} from './transcript-client.js';
import { asNotes, parseUpload } from './transcript-text.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const conflict = (code: string) => new ConflictException({ statusCode: 409, code });
const systemUser = 'system:transkripte';
/** Meet: so lange nach dem Ende wird der Abruf wiederholt */
export const meetRetryWindowMs = 48 * 60 * 60 * 1000;

type MeetingRow = typeof schema.meeting.$inferSelect;
type TranscriptRow = typeof schema.meetingTranscript.$inferSelect;
type Provider = 'teams' | 'meet';

/** Ein Satz je Grund, warum es kein Transkript gibt */
export const unavailableReasons: Record<string, string> = {
  mandant_gesperrt: 'Euer Microsoft-365-Mandant erlaubt den Zugriff auf Transkripte nicht.',
  keine_transkription: 'In der Besprechung lief keine Transkription.',
  nicht_gefunden: 'Zu diesem Termin gibt es beim Dienst keine Besprechung.',
  nicht_verfuegbar_48h: 'Innerhalb von 48 Stunden nach dem Termin kam kein Transkript.',
  keine_verbindung:
    'Die organisierende Person hat ihr Konto nicht unter Meine Verbindungen mit Reziproq verbunden.',
};

const settingKeys = [
  'transcripts_enabled',
  'works_agreement_confirmed_at',
  'works_agreement_confirmed_by',
  'works_agreement_file_key',
  'transcript_retention_days',
  'teams_transcript_mode',
  'invite_notice_text',
] as const;
type SettingKey = (typeof settingKeys)[number];

/** Welcher Dienst zu einem Besprechungslink gehört */
export function providerOf(url: string | null): Provider | null {
  if (!url) return null;
  if (/teams\.microsoft\.com|teams\.live\.com/i.test(url)) return 'teams';
  if (/meet\.google\.com/i.test(url)) return 'meet';
  return null;
}

const endOf = (meeting: Pick<MeetingRow, 'startsAt' | 'durationMinutes'>) =>
  new Date(meeting.startsAt.getTime() + meeting.durationMinutes * 60_000);

/**
 * IN-05 Transkripte aus Teams und Meet. Abgerufen wird nur, wenn die Organisation Transkripte
 * eingeschaltet hat (mit Betriebsvereinbarung), der Termin einen Lieferanten hat, Opt-in an ist und
 * er vorbei ist. Nur Text, nie Audio, Video oder Aufzeichnungen. Der Text gilt als Freitext beider
 * Seiten: Die Auswertung (KI-17) legt alle Punkte intern an; teilen entscheidet der SRO.
 */
@Injectable()
export class TranscriptsService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(MeetingsService) private readonly meetings: MeetingsService,
    @Inject(MeetingCaptureService) private readonly capture: MeetingCaptureService,
    @Inject(IntegrationsService) private readonly integrations: IntegrationsService,
    @Inject(TRANSCRIPT_CLIENT) private readonly client: TranscriptClient,
    @Inject(FILE_STORE) private readonly files: FileStore,
    @Inject(NotificationBus) private readonly bus: NotificationBus,
  ) {}

  /** Für Tests: feste Uhrzeit */
  clock: () => Date = () => new Date();

  private system(orgId: string) {
    return { userId: systemUser, organizationId: orgId };
  }

  // ------------------------------------------------------------- Einstellungen (Admin)

  private async readSettings(tx: TenantTransaction, orgId: string) {
    const rows = await tx
      .select({ key: schema.orgSetting.key, value: schema.orgSetting.value })
      .from(schema.orgSetting)
      .where(
        and(eq(schema.orgSetting.orgId, orgId), inArray(schema.orgSetting.key, [...settingKeys])),
      );
    const value = (key: SettingKey) => rows.find((row) => row.key === key)?.value;
    const retention = Number(value('transcript_retention_days'));
    const confirmedAt = value('works_agreement_confirmed_at');
    return {
      enabled: value('transcripts_enabled') === true,
      confirmedAt: typeof confirmedAt === 'string' ? confirmedAt : null,
      confirmedBy: String(value('works_agreement_confirmed_by') ?? ''),
      fileKey:
        typeof value('works_agreement_file_key') === 'string'
          ? String(value('works_agreement_file_key'))
          : null,
      retentionDays: ([30, 90, 180] as const).find((days) => days === retention) ?? 90,
      teamsMode: value('teams_transcript_mode') === 'org' ? ('org' as const) : ('meeting' as const),
      inviteNotice:
        typeof value('invite_notice_text') === 'string'
          ? String(value('invite_notice_text'))
          : defaultInviteNotice,
    };
  }

  private async write(
    tx: TenantTransaction,
    orgId: string,
    userId: string,
    key: SettingKey,
    value: unknown,
  ) {
    await tx
      .insert(schema.orgSetting)
      .values({ orgId, key, value, updatedBy: userId })
      .onConflictDoUpdate({
        target: [schema.orgSetting.orgId, schema.orgSetting.key],
        set: { value, updatedBy: userId, updatedAt: new Date() },
      });
  }

  private admin(auth: AuthContext) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return { userId: auth.userId, organizationId: organization.id };
  }

  async settings(auth: AuthContext): Promise<TranscriptSettings> {
    const session = this.admin(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        const current = await this.readSettings(tx, session.organizationId);
        return transcriptSettingsSchema.parse({
          enabled: current.enabled && current.confirmedAt !== null,
          worksAgreement: current.confirmedAt
            ? {
                confirmedAt: current.confirmedAt,
                confirmedBy: current.confirmedBy,
                hasFile: current.fileKey !== null,
              }
            : null,
          retentionDays: current.retentionDays,
          teamsMode: current.teamsMode,
          inviteNotice: current.inviteNotice,
          canManage: auth.orgRole === 'admin' && can(auth, 'einstellungen.verwalten'),
        });
      },
      { readOnly: true },
    );
  }

  /** Einschalten nur mit bestätigter Betriebsvereinbarung */
  async saveSettings(
    auth: AuthContext,
    input: SaveTranscriptSettings,
  ): Promise<TranscriptSettings> {
    const data = saveTranscriptSettingsSchema.parse(input);
    const session = this.admin(auth);
    if (auth.orgRole !== 'admin' || !can(auth, 'einstellungen.verwalten')) throw forbidden();
    await this.tenant.run(session, async (tx) => {
      const current = await this.readSettings(tx, session.organizationId);
      if (data.enabled && !current.confirmedAt) throw conflict('betriebsvereinbarung_fehlt');
      const orgId = session.organizationId;
      if (data.enabled !== undefined)
        await this.write(tx, orgId, auth.userId, 'transcripts_enabled', data.enabled);
      if (data.retentionDays !== undefined)
        await this.write(tx, orgId, auth.userId, 'transcript_retention_days', data.retentionDays);
      if (data.teamsMode !== undefined)
        await this.write(tx, orgId, auth.userId, 'teams_transcript_mode', data.teamsMode);
      if (data.inviteNotice !== undefined)
        await this.write(tx, orgId, auth.userId, 'invite_notice_text', data.inviteNotice);
    });
    return this.settings(auth);
  }

  /** Betriebsvereinbarung bestätigen: Datum, wer, optional die Datei */
  async confirmAgreement(
    auth: AuthContext,
    input: ConfirmWorksAgreement,
    file: { originalname: string; buffer: Buffer } | undefined,
  ): Promise<TranscriptSettings> {
    const data = confirmWorksAgreementSchema.parse(input);
    const session = this.admin(auth);
    if (auth.orgRole !== 'admin' || !can(auth, 'einstellungen.verwalten')) throw forbidden();
    let fileKey: string | null = null;
    if (file) {
      if (file.buffer.length > 10 * 1024 * 1024) throw conflict('datei_zu_gross');
      fileKey = `${session.organizationId}/betriebsvereinbarung/${randomUUID()}`;
      await this.files.put(fileKey, file.buffer);
    }
    await this.tenant.run(session, async (tx) => {
      const [me] = await tx
        .select({ name: schema.appUser.name })
        .from(schema.appUser)
        .where(eq(schema.appUser.id, auth.userId));
      const orgId = session.organizationId;
      await this.write(tx, orgId, auth.userId, 'works_agreement_confirmed_at', data.confirmedAt);
      await this.write(
        tx,
        orgId,
        auth.userId,
        'works_agreement_confirmed_by',
        me?.name ?? auth.userId,
      );
      if (fileKey) await this.write(tx, orgId, auth.userId, 'works_agreement_file_key', fileKey);
    });
    return this.settings(auth);
  }

  async inviteNotice(orgId: string): Promise<string> {
    return this.tenant.run(
      this.system(orgId),
      async (tx) => (await this.readSettings(tx, orgId)).inviteNotice,
    );
  }

  // ------------------------------------------------------------- Termin

  private async meetingIn(scope: MeetingScope, meetingId: string) {
    const [row] = await scope.tx
      .select()
      .from(schema.meeting)
      .where(
        and(
          eq(schema.meeting.id, meetingId),
          eq(schema.meeting.relationshipId, scope.relationshipId),
        ),
      );
    if (!row || row.ownerOrgId !== scope.orgId) throw notFound();
    return row;
  }

  /** SRO, Admin oder die organisierende Person */
  private async isManager(scope: MeetingScope, meeting: MeetingRow) {
    if (scope.auth.orgRole === 'admin' || scope.teamRole === 'sro') return true;
    if (!meeting.organizerEmail) return false;
    const [me] = await scope.tx
      .select({ email: schema.appUser.email })
      .from(schema.appUser)
      .where(eq(schema.appUser.id, scope.auth.userId));
    return me?.email.toLowerCase() === meeting.organizerEmail.toLowerCase();
  }

  private async latest(tx: TenantTransaction, meetingId: string) {
    const [row] = await tx
      .select()
      .from(schema.meetingTranscript)
      .where(eq(schema.meetingTranscript.meetingId, meetingId))
      .orderBy(desc(schema.meetingTranscript.createdAt))
      .limit(1);
    return row ?? null;
  }

  private view(row: TranscriptRow | null): MeetingTranscriptState['transcript'] {
    if (!row) return null;
    return {
      id: row.id,
      source: row.source,
      status: row.status,
      unavailableReason: row.unavailableReason
        ? (unavailableReasons[row.unavailableReason] ?? row.unavailableReason)
        : null,
      durationS: row.durationS,
      speakers: row.speakers,
      fetchedAt: row.fetchedAt?.toISOString() ?? null,
      deleteAfter: row.deleteAfter?.toISOString() ?? null,
      released: row.releasedToParticipants,
    };
  }

  state(
    auth: AuthContext,
    relationshipId: string,
    meetingId: string,
  ): Promise<MeetingTranscriptState> {
    return this.meetings.buyer(auth, relationshipId, async (scope) => {
      const meeting = await this.meetingIn(scope, meetingId);
      const settings = await this.readSettings(scope.tx, scope.orgId);
      const manager = await this.isManager(scope, meeting);
      const row = await this.latest(scope.tx, meetingId);
      return {
        orgEnabled: settings.enabled && settings.confirmedAt !== null,
        optIn: meeting.transcriptOptIn,
        canManage: manager,
        canUpload: scope.canEdit && can(auth, 'termine.bearbeiten'),
        canRead: manager || Boolean(row?.releasedToParticipants && can(auth, 'termine.sehen')),
        transcript: this.view(row),
      };
    });
  }

  async setOptIn(auth: AuthContext, relationshipId: string, meetingId: string, optIn: boolean) {
    const subscribe = await this.meetings.buyer(auth, relationshipId, async (scope) => {
      const meeting = await this.meetingIn(scope, meetingId);
      if (!(await this.isManager(scope, meeting))) throw forbidden();
      await scope.tx
        .update(schema.meeting)
        .set({ transcriptOptIn: optIn })
        .where(eq(schema.meeting.id, meetingId));
      return optIn && providerOf(meeting.onlineMeetingUrl) === 'teams' ? meeting : null;
    });
    // Teams, Weg meeting: Benachrichtigung „Transkript verfügbar“ abonnieren (nur mit Opt-in)
    if (subscribe?.onlineMeetingUrl) {
      const orgId = (auth.organization as NonNullable<AuthContext['organization']>).id;
      const settings = await this.tenant.run(this.system(orgId), (tx) =>
        this.readSettings(tx, orgId),
      );
      if (settings.enabled && settings.confirmedAt && settings.teamsMode === 'meeting') {
        const organizer = await this.organizerOf(orgId, subscribe);
        if (organizer) {
          await this.integrations
            .withUserToken(orgId, organizer, 'microsoft365', (token) =>
              this.client.subscribeTeams(token, { joinUrl: subscribe.onlineMeetingUrl as string }),
            )
            .catch(() => null);
        }
      }
    }
    return this.state(auth, relationshipId, meetingId);
  }

  async release(auth: AuthContext, relationshipId: string, meetingId: string, released: boolean) {
    await this.meetings.buyer(auth, relationshipId, async (scope) => {
      const meeting = await this.meetingIn(scope, meetingId);
      if (!(await this.isManager(scope, meeting))) throw forbidden();
      const row = await this.latest(scope.tx, meetingId);
      if (!row) throw notFound();
      await scope.tx
        .update(schema.meetingTranscript)
        .set({ releasedToParticipants: released })
        .where(eq(schema.meetingTranscript.id, row.id));
    });
    return this.state(auth, relationshipId, meetingId);
  }

  /** Rohtext mit Sprechern und Zeit; Fundstellen aus den Entwürfen markiert */
  async text(
    auth: AuthContext,
    relationshipId: string,
    meetingId: string,
  ): Promise<TranscriptText> {
    const found = await this.meetings.buyer(auth, relationshipId, async (scope) => {
      const meeting = await this.meetingIn(scope, meetingId);
      const row = await this.latest(scope.tx, meetingId);
      const manager = await this.isManager(scope, meeting);
      if (!row || !(manager || row.releasedToParticipants)) throw forbidden();
      if (row.status !== 'fetched' || !row.entriesRef || !row.keyRef) throw notFound();
      const quotes = await scope.tx
        .select({ excerpt: schema.aiSource.excerpt })
        .from(schema.aiSource)
        .where(
          and(
            eq(schema.aiSource.targetType, 'meeting'),
            eq(schema.aiSource.targetId, meetingId),
            eq(schema.aiSource.objectType, 'meeting_capture'),
          ),
        );
      return {
        ref: row.entriesRef,
        keyRef: row.keyRef,
        quotes: quotes.flatMap((quote) => (quote.excerpt ? [quote.excerpt] : [])),
      };
    });
    const sealed = await this.files.get(found.ref);
    const plain = sealed ? this.integrations.box.open(sealed.toString('utf8'), found.keyRef) : null;
    if (!plain) throw notFound();
    const entries = z.array(transcriptEntrySchema).parse(JSON.parse(plain));
    return { entries, quotes: [...new Set(found.quotes)] };
  }

  /** Upload (VTT, DOCX, TXT bis 10 MB): gleiche Voraussetzungen, nur ohne Abfrage beim Dienst */
  async upload(
    auth: AuthContext,
    relationshipId: string,
    meetingId: string,
    file: { originalname: string; buffer: Buffer } | undefined,
  ): Promise<MeetingTranscriptState> {
    if (!file) throw conflict('datei_fehlt');
    if (file.buffer.length > 10 * 1024 * 1024) throw conflict('datei_zu_gross');
    const entries = parseUpload(file.originalname, file.buffer);
    if (!entries) throw conflict('format_nicht_unterstuetzt');
    if (entries.length === 0) throw conflict('datei_leer');
    const orgId = (auth.organization as NonNullable<AuthContext['organization']> | null)?.id;
    if (!orgId) throw forbidden();
    const meeting = await this.meetings.buyer(auth, relationshipId, async (scope) => {
      if (!scope.canEdit || !can(auth, 'termine.bearbeiten')) throw forbidden();
      return this.meetingIn(scope, meetingId);
    });
    const blocked = await this.blocked(orgId, meeting);
    if (blocked) throw conflict(blocked);
    await this.store(
      orgId,
      meeting,
      'upload',
      { entries, externalId: file.originalname.slice(0, 200), language: null },
      auth.userId,
    );
    await this.evaluate(orgId, meeting, entries, auth);
    return this.state(auth, relationshipId, meetingId);
  }

  // ------------------------------------------------------------- Abruf

  /** Grund, warum nicht abgerufen werden darf; null, wenn alles erfüllt ist */
  private async blocked(orgId: string, meeting: MeetingRow): Promise<string | null> {
    const settings = await this.tenant.run(this.system(orgId), (tx) =>
      this.readSettings(tx, orgId),
    );
    if (!settings.enabled) return 'transkripte_aus';
    if (!settings.confirmedAt) return 'betriebsvereinbarung_fehlt';
    if (!meeting.transcriptOptIn) return 'kein_opt_in';
    if (meeting.ownerOrgId !== orgId || !meeting.relationshipId) return 'kein_lieferant';
    if (meeting.status === 'cancelled') return 'abgesagt';
    if (endOf(meeting).getTime() > this.clock().getTime()) return 'noch_nicht_vorbei';
    return null;
  }

  /** Organisator (Mail) oder SRO der Beziehung: mit seinen Rechten wird abgerufen */
  private async organizerOf(orgId: string, meeting: MeetingRow): Promise<string | null> {
    return this.tenant.run(this.system(orgId), async (tx) => {
      if (meeting.organizerEmail) {
        const [user] = await tx
          .select({ id: schema.appUser.id })
          .from(schema.appUser)
          .where(
            and(
              eq(schema.appUser.organizationId, orgId),
              sql`lower(${schema.appUser.email}) = ${meeting.organizerEmail.toLowerCase()}`,
            ),
          );
        if (user) return user.id;
      }
      const [sro] = await tx
        .select({ userId: schema.relationshipMember.userId })
        .from(schema.relationshipMember)
        .where(
          and(
            eq(schema.relationshipMember.relationshipId, meeting.relationshipId),
            eq(schema.relationshipMember.orgId, orgId),
            eq(schema.relationshipMember.teamRole, 'sro'),
          ),
        );
      return sro?.userId ?? null;
    });
  }

  /**
   * Teams, Weg meeting: Benachrichtigung „Transkript verfügbar“. Gehört der Link zu keinem Termin
   * mit Lieferant und Opt-in, wird nichts abgefragt.
   */
  async fromTeamsNotification(
    orgId: string,
    input: { joinUrl: string; transcriptId: string | null },
  ) {
    const meeting = await this.tenant.run(this.system(orgId), async (tx) => {
      const [row] = await tx
        .select()
        .from(schema.meeting)
        .where(
          and(
            eq(schema.meeting.ownerOrgId, orgId),
            eq(schema.meeting.onlineMeetingUrl, input.joinUrl),
          ),
        );
      return row ?? null;
    });
    if (!meeting || (await this.blocked(orgId, meeting))) return 'ignored' as const;
    return this.fetch(orgId, meeting, 'teams', input.transcriptId);
  }

  /** Läuft regelmäßig: Termine mit Opt-in nach dem Ende abrufen; Meet bis 48 Stunden wiederholen */
  async poll(orgId: string): Promise<number> {
    const now = this.clock();
    const candidates = await this.tenant.run(this.system(orgId), (tx) =>
      tx
        .select()
        .from(schema.meeting)
        .where(
          and(
            eq(schema.meeting.ownerOrgId, orgId),
            eq(schema.meeting.transcriptOptIn, true),
            isNotNull(schema.meeting.onlineMeetingUrl),
            lte(schema.meeting.startsAt, now),
            gte(
              schema.meeting.startsAt,
              new Date(now.getTime() - meetRetryWindowMs - 24 * 3_600_000),
            ),
          ),
        ),
    );
    let fetched = 0;
    for (const meeting of candidates) {
      const provider = providerOf(meeting.onlineMeetingUrl);
      if (!provider || (await this.blocked(orgId, meeting))) continue;
      const existing = await this.tenant.run(this.system(orgId), (tx) =>
        this.latest(tx, meeting.id),
      );
      if (existing && existing.status !== 'pending') continue;
      // Teams kommt über die Benachrichtigung; der Lauf fragt nur, wenn keine kam (Weg org oder Grund)
      const result = await this.fetch(orgId, meeting, provider, null);
      if (result === 'fetched') fetched += 1;
    }
    return fetched;
  }

  private async fetch(
    orgId: string,
    meeting: MeetingRow,
    provider: Provider,
    transcriptId: string | null,
  ) {
    const organizer = await this.organizerOf(orgId, meeting);
    const url = meeting.onlineMeetingUrl as string;
    const result: TranscriptResult | null = organizer
      ? await this.integrations.withUserToken(
          orgId,
          organizer,
          provider === 'teams' ? 'microsoft365' : 'google_workspace',
          (token) =>
            provider === 'teams'
              ? this.client.teams(token, { joinUrl: url, transcriptId })
              : this.client.meet(token, {
                  meetingUrl: url,
                  startsAt: meeting.startsAt.toISOString(),
                }),
        )
      : null;
    if (!result) {
      await this.mark(orgId, meeting, provider, {
        status: 'unavailable',
        reason: 'keine_verbindung',
      });
      return 'unavailable' as const;
    }
    if (result.status === 'ok') {
      await this.store(orgId, meeting, provider, result, null);
      const actor = organizer
        ? await this.tenant.run({ userId: organizer, organizationId: orgId }, (tx) =>
            actorIn(tx, orgId, organizer),
          )
        : null;
      if (actor) await this.evaluate(orgId, meeting, result.entries, actor);
      return 'fetched' as const;
    }
    if (result.status === 'pending') {
      const expired = this.clock().getTime() > endOf(meeting).getTime() + meetRetryWindowMs;
      await this.mark(
        orgId,
        meeting,
        provider,
        expired ? { status: 'unavailable', reason: 'nicht_verfuegbar_48h' } : { status: 'pending' },
      );
      return expired ? ('unavailable' as const) : ('pending' as const);
    }
    await this.mark(orgId, meeting, provider, { status: 'unavailable', reason: result.reason });
    return 'unavailable' as const;
  }

  private async mark(
    orgId: string,
    meeting: MeetingRow,
    source: Provider,
    outcome: { status: 'pending' } | { status: 'unavailable'; reason: string },
  ) {
    const now = this.clock();
    await this.tenant.run(this.system(orgId), async (tx) => {
      const existing = await this.latest(tx, meeting.id);
      const values = {
        status: outcome.status,
        unavailableReason: outcome.status === 'unavailable' ? outcome.reason : null,
        lastAttemptAt: now,
      };
      if (existing && existing.source === source && existing.status !== 'deleted') {
        await tx
          .update(schema.meetingTranscript)
          .set({ ...values, attempts: existing.attempts + 1 })
          .where(eq(schema.meetingTranscript.id, existing.id));
      } else {
        await tx.insert(schema.meetingTranscript).values({
          orgId,
          relationshipId: meeting.relationshipId,
          meetingId: meeting.id,
          source,
          attempts: 1,
          ...values,
        });
      }
    });
  }

  /** Sprecher den Teilnehmern zuordnen; Unbekannte heißen „Teilnehmer 1, 2 …“ */
  private async speakersFor(
    tx: TenantTransaction,
    orgId: string,
    meeting: MeetingRow,
    entries: TranscriptEntry[],
  ) {
    const people = await tx
      .select({
        name: schema.meetingParticipant.name,
        ownerOrgId: schema.meetingParticipant.ownerOrgId,
      })
      .from(schema.meetingParticipant)
      .where(eq(schema.meetingParticipant.meetingId, meeting.id));
    const attendees = await tx
      .select({
        name: schema.meetingAttendee.name,
        email: schema.meetingAttendee.email,
        side: schema.meetingAttendee.side,
      })
      .from(schema.meetingAttendee)
      .where(eq(schema.meetingAttendee.meetingId, meeting.id));
    const labels = [...new Set(entries.map((entry) => entry.speaker))];
    let unknown = 0;
    return labels.map((label) => {
      const lower = label.toLowerCase();
      const participant = people.find(
        (person) => lower && person.name.toLowerCase().includes(lower),
      );
      const attendee = attendees.find(
        (person) =>
          lower &&
          ((person.name ?? '').toLowerCase().includes(lower) ||
            person.email.toLowerCase().startsWith(lower)),
      );
      if (participant) {
        return {
          label,
          name: participant.name,
          side: participant.ownerOrgId === orgId ? ('buyer' as const) : ('supplier' as const),
        };
      }
      if (attendee) {
        return {
          label,
          name: attendee.name ?? attendee.email,
          side:
            attendee.side === 'buyer' || attendee.side === 'supplier'
              ? attendee.side
              : ('unknown' as const),
        };
      }
      unknown += 1;
      return { label, name: `Teilnehmer ${unknown}`, side: 'unknown' as const };
    });
  }

  /** Verschlüsselt ablegen, Löschdatum nach der Aufbewahrung setzen */
  private async store(
    orgId: string,
    meeting: MeetingRow,
    source: 'teams' | 'meet' | 'upload',
    result: { entries: TranscriptEntry[]; externalId: string; language: string | null },
    createdBy: string | null,
  ) {
    const now = this.clock();
    const ref = `${orgId}/transkript/${randomUUID()}`;
    const box = this.integrations.box;
    await this.files.put(ref, Buffer.from(box.seal(JSON.stringify(result.entries)), 'utf8'));
    await this.tenant.run(this.system(orgId), async (tx) => {
      const settings = await this.readSettings(tx, orgId);
      const speakers = await this.speakersFor(tx, orgId, meeting, result.entries);
      const last = result.entries[result.entries.length - 1];
      const values = {
        orgId,
        relationshipId: meeting.relationshipId,
        meetingId: meeting.id,
        source,
        externalId: result.externalId,
        language: result.language,
        durationS: last ? Math.round(last.at) : null,
        speakers,
        entriesRef: ref,
        keyRef: box.keyRef,
        fetchedAt: now,
        deleteAfter: new Date(now.getTime() + settings.retentionDays * 86_400_000),
        status: 'fetched' as const,
        unavailableReason: null,
        lastAttemptAt: now,
        createdBy,
      };
      const existing = await this.latest(tx, meeting.id);
      if (existing && existing.status === 'pending' && existing.source === source) {
        await tx
          .update(schema.meetingTranscript)
          .set({ ...values, attempts: existing.attempts + 1 })
          .where(eq(schema.meetingTranscript.id, existing.id));
      } else {
        await tx.insert(schema.meetingTranscript).values(values);
      }
    });
  }

  /** KI-17 mit dem Transkript als Quelle; alle Punkte entstehen intern */
  private async evaluate(
    _orgId: string,
    meeting: MeetingRow,
    entries: TranscriptEntry[],
    actor: AuthContext,
  ) {
    const text = asNotes(entries).slice(0, maxCaptureChars);
    if (!text.trim()) return;
    await this.capture
      .evaluate(actor, meeting.relationshipId, meeting.id, { source: 'transcript', text })
      .catch(() => null);
  }

  // ------------------------------------------------------------- Aufbewahrung und Erinnerung

  /** Täglich: Rohtranskripte nach der Aufbewahrung löschen; Entwürfe und Fundstellen bleiben */
  async expire(orgId: string): Promise<number> {
    const now = this.clock();
    const due = await this.tenant.run(this.system(orgId), (tx) =>
      tx
        .select()
        .from(schema.meetingTranscript)
        .where(
          and(
            eq(schema.meetingTranscript.orgId, orgId),
            eq(schema.meetingTranscript.status, 'fetched'),
            lte(schema.meetingTranscript.deleteAfter, now),
          ),
        ),
    );
    for (const row of due) {
      if (row.entriesRef) await this.files.remove(row.entriesRef);
      await this.tenant.run(this.system(orgId), (tx) =>
        tx
          .update(schema.meetingTranscript)
          .set({ status: 'deleted', entriesRef: null, speakers: [] })
          .where(eq(schema.meetingTranscript.id, row.id)),
      );
    }
    return due.length;
  }

  /**
   * Teams startet die Transkription nicht von außen (Graph bietet das nicht an). Deshalb bekommt
   * der Organisator zu Beginn eines Termins mit Opt-in eine Erinnerung (IN-06, auch in Ruhezeiten).
   */
  async remind(orgId: string): Promise<number> {
    const now = this.clock();
    const settings = await this.tenant.run(this.system(orgId), (tx) =>
      this.readSettings(tx, orgId),
    );
    if (!settings.enabled || !settings.confirmedAt) return 0;
    const soon = await this.tenant.run(this.system(orgId), (tx) =>
      tx
        .select()
        .from(schema.meeting)
        .where(
          and(
            eq(schema.meeting.ownerOrgId, orgId),
            eq(schema.meeting.transcriptOptIn, true),
            gte(schema.meeting.startsAt, now),
            lte(schema.meeting.startsAt, new Date(now.getTime() + 10 * 60_000)),
          ),
        ),
    );
    let sent = 0;
    for (const meeting of soon) {
      if (providerOf(meeting.onlineMeetingUrl) !== 'teams') continue;
      const already = await this.tenant.run(this.system(orgId), async (tx) => {
        const [row] = await tx
          .select({ id: schema.notification.id })
          .from(schema.notification)
          .where(
            and(
              eq(schema.notification.orgId, orgId),
              eq(schema.notification.kind, 'meeting_reminder'),
              eq(schema.notification.objectId, meeting.id),
            ),
          );
        return Boolean(row);
      });
      if (already) continue;
      const organizer = await this.organizerOf(orgId, meeting);
      if (!organizer) continue;
      await this.bus.emit({
        orgId,
        userIds: [organizer],
        kind: 'meeting_reminder',
        objectType: 'meeting',
        objectId: meeting.id,
        title: `${meeting.title}: Transkription in Teams starten`,
        line: 'Für diesen Termin ist „Transkript übernehmen“ an.',
        href: `/lieferanten/${meeting.relationshipId}/umsetzung/termine/${meeting.id}`,
        relationshipId: meeting.relationshipId,
      });
      sent += 1;
    }
    return sent;
  }
}
