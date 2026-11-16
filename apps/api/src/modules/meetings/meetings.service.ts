import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { and, asc, auditedChange, desc, eq, schema, type TenantTransaction } from '@reziproq/db';
import {
  agendaTemplates,
  type CreateMeeting,
  type LiveSection,
  type MeetingDetail,
  type MeetingList,
  type MeetingSide,
  type MeetingSummary,
  meetingDetailSchema,
  meetingListSchema,
  type SaveAgenda,
  type SaveMeetingNote,
  type SaveProtocol,
  type TeamRole,
  type UpdateMeeting,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { meetingAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { CustomersService } from '../customers/customers.service.js';
import { MEETING_LIVE_SOURCES, type MeetingLiveSource } from './live-sections.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const closed = () =>
  new ConflictException({
    statusCode: 409,
    code: 'meeting_closed',
    message: 'Der Termin ist abgeschlossen.',
  });

/** Wo gearbeitet wird: Seite, eigene Organisation, Käufer der Beziehung und ob geändert werden darf. */
export interface MeetingScope {
  tx: TenantTransaction;
  auth: AuthContext;
  side: MeetingSide;
  orgId: string;
  buyerOrgId: string;
  relationshipId: string;
  canEdit: boolean;
  /** Teamrolle der eigenen Seite; „sro“ heißt beim Lieferanten Key Account Manager (QBR-07) */
  teamRole: TeamRole | null;
}

type MeetingRow = typeof schema.meeting.$inferSelect;

/** Fehler aus dem Trigger app_meeting_locked werden zu 409. */
async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const message = (error as { cause?: { message?: string } }).cause?.message;
    if (message === 'meeting_closed') throw closed();
    throw error;
  }
}

/**
 * QBR-01a: Termine einer Beziehung für beide Seiten. Jede Seite ändert nur ihre eigenen Zeilen
 * (PLT-04): den Termin pflegt, wer ihn angelegt hat; Agendapunkte und Beschlüsse ergänzt jede
 * Seite für sich. Interne Notizen sind org_private.
 */
@Injectable()
export class MeetingsService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(CustomersService) private readonly customers: CustomersService,
    @Optional()
    @Inject(MEETING_LIVE_SOURCES)
    private readonly liveSources: MeetingLiveSource[] = [],
  ) {}

  /** Aktueller Stand aus den Orten der Sachen (QBR-01b); leere Abschnitte entfallen. */
  private async readLive(scope: MeetingScope): Promise<LiveSection[]> {
    const sections: LiveSection[] = [];
    for (const source of this.liveSources) {
      const section = await source.read(scope.tx, scope.relationshipId);
      if (section && section.items.length > 0) sections.push(section);
    }
    return sections;
  }

  /** Offen: der Stand von jetzt; abgeschlossen: der eingefrorene Stand, unverändert. */
  private async live(scope: MeetingScope, meeting: MeetingRow) {
    if (meeting.status !== 'closed')
      return { sections: await this.readLive(scope), frozenAt: null };
    const [snapshot] = await scope.tx
      .select({
        frozenAt: schema.meetingSnapshot.frozenAt,
        content: schema.meetingSnapshot.content,
      })
      .from(schema.meetingSnapshot)
      .where(eq(schema.meetingSnapshot.meetingId, meeting.id));
    const content = (snapshot?.content ?? { sections: [] }) as { sections: LiveSection[] };
    return { sections: content.sections, frozenAt: snapshot?.frozenAt.toISOString() ?? null };
  }

  /**
   * Termin abschließen (QBR-01b), nur die Seite, die ihn angelegt hat: Erst wird der Status
   * gesetzt – das geht nur einmal (Trigger app_meeting_closed_unchanged) und sperrt Protokoll und
   * Beschlüsse –, dann friert meeting_snapshot den Stand der Live-Abschnitte ein.
   */
  async close(scope: MeetingScope, meetingId: string): Promise<MeetingDetail> {
    const meeting = await this.contribute(scope, meetingId);
    if (meeting.ownerOrgId !== scope.orgId) throw forbidden();
    const { tx } = scope;
    const sections = await this.readLive(scope);
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    await guarded(() =>
      auditedChange(tx, actor, meetingAudit, async () => {
        await tx
          .update(schema.meeting)
          .set({ status: 'closed' })
          .where(eq(schema.meeting.id, meetingId));
        await tx.insert(schema.meetingSnapshot).values({
          meetingId,
          relationshipId: scope.relationshipId,
          ownerOrgId: scope.orgId,
          visibility: 'shared',
          content: { sections },
        });
        return {
          objectId: meetingId,
          relationshipId: scope.relationshipId,
          action: 'updated' as const,
          before: {
            title: meeting.title,
            starts_at: meeting.startsAt.toISOString(),
            status: meeting.status,
          },
          after: {
            title: meeting.title,
            starts_at: meeting.startsAt.toISOString(),
            status: 'closed',
          },
          result: undefined,
        };
      }),
    );
    return this.detail(scope, meetingId);
  }

  /** Käuferseite: eigene Beziehung; ändern Admin oder wer im Team ist, nie mit Teamrolle Leser. */
  buyer<T>(auth: AuthContext, relationshipId: string, work: (scope: MeetingScope) => Promise<T>) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const [relationship] = await tx
        .select({ status: schema.relationship.status })
        .from(schema.relationship)
        .where(
          and(
            eq(schema.relationship.id, relationshipId),
            eq(schema.relationship.buyerOrgId, organization.id),
          ),
        );
      if (!relationship) throw notFound();
      const [member] = await tx
        .select({ teamRole: schema.relationshipMember.teamRole })
        .from(schema.relationshipMember)
        .where(
          and(
            eq(schema.relationshipMember.relationshipId, relationshipId),
            eq(schema.relationshipMember.orgId, organization.id),
            eq(schema.relationshipMember.userId, auth.userId),
          ),
        );
      const canEdit =
        relationship.status !== 'ended' &&
        can(auth, 'termine.bearbeiten', { teamRole: member?.teamRole ?? null }) &&
        (auth.orgRole === 'admin' || member !== undefined);
      return work({
        tx,
        auth,
        side: 'buyer',
        orgId: organization.id,
        buyerOrgId: organization.id,
        relationshipId,
        canEdit,
        teamRole: member?.teamRole ?? null,
      });
    });
  }

  /** Lieferantenseite: im Kontext genau dieses Kunden (LIF-02). */
  supplier<T>(
    auth: AuthContext,
    relationshipId: string,
    work: (scope: MeetingScope) => Promise<T>,
  ) {
    return this.customers.inCustomer(auth, relationshipId, async (tx, customer) => {
      const [member] = await tx
        .select({ teamRole: schema.relationshipMember.teamRole })
        .from(schema.relationshipMember)
        .where(
          and(
            eq(schema.relationshipMember.relationshipId, relationshipId),
            eq(schema.relationshipMember.orgId, auth.organization?.id as string),
            eq(schema.relationshipMember.userId, auth.userId),
          ),
        );
      return work({
        tx,
        auth,
        side: 'supplier',
        orgId: auth.organization?.id as string,
        buyerOrgId: customer.buyerOrgId,
        relationshipId,
        canEdit: can(auth, 'termine.bearbeiten'),
        teamRole: member?.teamRole ?? null,
      });
    });
  }

  private sideOf(scope: MeetingScope, ownerOrgId: string): MeetingSide {
    return ownerOrgId === scope.buyerOrgId ? 'buyer' : 'supplier';
  }

  private summary(scope: MeetingScope, row: MeetingRow): MeetingSummary {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      startsAt: row.startsAt.toISOString(),
      location: row.location,
      status: row.status,
      ownerSide: this.sideOf(scope, row.ownerOrgId),
    };
  }

  /** Formate der Spielregeln, die diese Seite sieht: Käufer die aktuelle Version, Lieferant die geteilte. */
  private async formats(scope: MeetingScope) {
    const { tx } = scope;
    let ruleSetId: string | undefined;
    if (scope.side === 'buyer') {
      const [set] = await tx
        .select({ id: schema.ruleSet.id })
        .from(schema.ruleSet)
        .where(
          and(
            eq(schema.ruleSet.relationshipId, scope.relationshipId),
            eq(schema.ruleSet.ownerOrgId, scope.orgId),
          ),
        )
        .orderBy(desc(schema.ruleSet.version))
        .limit(1);
      ruleSetId = set?.id;
    } else {
      const [target] = await tx
        .select({ id: schema.relationshipTarget.ruleSetId })
        .from(schema.relationshipTarget)
        .where(eq(schema.relationshipTarget.relationshipId, scope.relationshipId));
      ruleSetId = target?.id;
    }
    if (!ruleSetId) return [];
    return tx
      .select({ id: schema.ruleSetItem.id, title: schema.ruleSetItem.title })
      .from(schema.ruleSetItem)
      .where(
        and(eq(schema.ruleSetItem.ruleSetId, ruleSetId), eq(schema.ruleSetItem.kind, 'format')),
      )
      .orderBy(asc(schema.ruleSetItem.position));
  }

  async list(scope: MeetingScope): Promise<MeetingList> {
    const rows = await scope.tx
      .select()
      .from(schema.meeting)
      .where(eq(schema.meeting.relationshipId, scope.relationshipId))
      .orderBy(asc(schema.meeting.startsAt));
    const now = Date.now();
    const summaries = rows.map((row) => this.summary(scope, row));
    return meetingListSchema.parse({
      upcoming: summaries.filter(
        (meeting, index) =>
          (rows[index] as MeetingRow).startsAt.getTime() >= now && meeting.status !== 'closed',
      ),
      past: summaries
        .filter(
          (meeting, index) =>
            (rows[index] as MeetingRow).startsAt.getTime() < now || meeting.status === 'closed',
        )
        .reverse(),
      canCreate: scope.canEdit,
      formats: await this.formats(scope),
    });
  }

  private async meetingRow(scope: MeetingScope, meetingId: string) {
    const [row] = await scope.tx
      .select()
      .from(schema.meeting)
      .where(
        and(
          eq(schema.meeting.id, meetingId),
          eq(schema.meeting.relationshipId, scope.relationshipId),
        ),
      );
    if (!row) throw notFound();
    return row;
  }

  private base(scope: MeetingScope, meetingId: string) {
    return {
      meetingId,
      relationshipId: scope.relationshipId,
      ownerOrgId: scope.orgId,
      visibility: 'shared' as const,
    };
  }

  async create(scope: MeetingScope, input: CreateMeeting): Promise<MeetingDetail> {
    if (!scope.canEdit) throw forbidden();
    const { tx } = scope;
    if (input.ruleSetItemId) {
      const formats = await this.formats(scope);
      if (!formats.some((format) => format.id === input.ruleSetItemId)) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'unknown_format',
          message: 'Das Format gehört nicht zu den Spielregeln dieser Beziehung.',
        });
      }
    }
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    const id = await auditedChange(tx, actor, meetingAudit, async () => {
      const [row] = await tx
        .insert(schema.meeting)
        .values({
          relationshipId: scope.relationshipId,
          ownerOrgId: scope.orgId,
          visibility: 'shared',
          type: input.type,
          ruleSetItemId: input.ruleSetItemId,
          title: input.title,
          startsAt: new Date(input.startsAt),
          location: input.location,
          createdBy: scope.auth.userId,
          createdByName: actor.name,
        })
        .returning({ id: schema.meeting.id });
      if (!row) throw new Error('Termin nicht angelegt');
      if (input.participants.length > 0) {
        await tx.insert(schema.meetingParticipant).values(
          input.participants.map((name, index) => ({
            ...this.base(scope, row.id),
            name,
            position: index + 1,
          })),
        );
      }
      const template = agendaTemplates[input.type][input.locale];
      await tx.insert(schema.meetingAgendaItem).values(
        template.map((title, index) => ({
          ...this.base(scope, row.id),
          title,
          position: index + 1,
        })),
      );
      return {
        objectId: row.id,
        relationshipId: scope.relationshipId,
        action: 'created' as const,
        after: { title: input.title, starts_at: input.startsAt, status: 'planned' },
        result: row.id,
      };
    });
    return this.detail(scope, id);
  }

  async detail(scope: MeetingScope, meetingId: string): Promise<MeetingDetail> {
    const { tx } = scope;
    const meeting = await this.meetingRow(scope, meetingId);
    const own = (ownerOrgId: string) => ownerOrgId === scope.orgId;
    const participants = await tx
      .select()
      .from(schema.meetingParticipant)
      .where(eq(schema.meetingParticipant.meetingId, meetingId))
      .orderBy(asc(schema.meetingParticipant.position));
    const agenda = await tx
      .select()
      .from(schema.meetingAgendaItem)
      .where(eq(schema.meetingAgendaItem.meetingId, meetingId));
    const decisions = await tx
      .select()
      .from(schema.meetingDecision)
      .where(eq(schema.meetingDecision.meetingId, meetingId));
    const [note] = await tx
      .select({ text: schema.meetingNote.text })
      .from(schema.meetingNote)
      .where(
        and(eq(schema.meetingNote.meetingId, meetingId), eq(schema.meetingNote.orgId, scope.orgId)),
      );
    // Erst die Punkte der Seite, die den Termin angelegt hat, dann die der anderen, je in Reihenfolge.
    const order = <T extends { ownerOrgId: string; position: number }>(rows: T[]) =>
      [...rows].sort(
        (a, b) =>
          Number(a.ownerOrgId !== meeting.ownerOrgId) -
            Number(b.ownerOrgId !== meeting.ownerOrgId) || a.position - b.position,
      );
    const isClosed = meeting.status === 'closed';
    return meetingDetailSchema.parse({
      meeting: {
        ...this.summary(scope, meeting),
        protocol: meeting.protocol,
        createdByName: meeting.createdByName,
      },
      participants: participants.map((row) => ({
        id: row.id,
        side: this.sideOf(scope, row.ownerOrgId),
        own: own(row.ownerOrgId),
        name: row.name,
      })),
      agenda: order(agenda).map((row) => ({
        id: row.id,
        side: this.sideOf(scope, row.ownerOrgId),
        own: own(row.ownerOrgId),
        title: row.title,
        position: row.position,
      })),
      decisions: order(decisions).map((row) => ({
        id: row.id,
        side: this.sideOf(scope, row.ownerOrgId),
        own: own(row.ownerOrgId),
        text: row.text,
        position: row.position,
      })),
      note: note?.text ?? null,
      canEditMeeting: scope.canEdit && own(meeting.ownerOrgId) && !isClosed,
      canContribute: scope.canEdit && !isClosed,
      live: await this.live(scope, meeting),
      canClose: scope.canEdit && own(meeting.ownerOrgId) && !isClosed,
    });
  }

  private async contribute(scope: MeetingScope, meetingId: string) {
    if (!scope.canEdit) throw forbidden();
    const meeting = await this.meetingRow(scope, meetingId);
    if (meeting.status === 'closed') throw closed();
    return meeting;
  }

  /** Nur die Seite, die den Termin angelegt hat: Titel, Datum, Ort, eigene Teilnehmende. */
  async update(
    scope: MeetingScope,
    meetingId: string,
    input: UpdateMeeting,
  ): Promise<MeetingDetail> {
    const meeting = await this.contribute(scope, meetingId);
    if (meeting.ownerOrgId !== scope.orgId) throw forbidden();
    const { tx } = scope;
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    await guarded(() =>
      auditedChange(tx, actor, meetingAudit, async () => {
        await tx
          .update(schema.meeting)
          .set({ title: input.title, startsAt: new Date(input.startsAt), location: input.location })
          .where(eq(schema.meeting.id, meetingId));
        await tx
          .delete(schema.meetingParticipant)
          .where(
            and(
              eq(schema.meetingParticipant.meetingId, meetingId),
              eq(schema.meetingParticipant.ownerOrgId, scope.orgId),
            ),
          );
        if (input.participants.length > 0) {
          await tx.insert(schema.meetingParticipant).values(
            input.participants.map((name, index) => ({
              ...this.base(scope, meetingId),
              name,
              position: index + 1,
            })),
          );
        }
        return {
          objectId: meetingId,
          relationshipId: scope.relationshipId,
          action: 'updated' as const,
          before: {
            title: meeting.title,
            starts_at: meeting.startsAt.toISOString(),
            status: meeting.status,
          },
          after: { title: input.title, starts_at: input.startsAt, status: meeting.status },
          result: undefined,
        };
      }),
    );
    return this.detail(scope, meetingId);
  }

  /** Eigene Agendapunkte ersetzen; die der anderen Seite bleiben, wie sie sind. */
  async saveAgenda(
    scope: MeetingScope,
    meetingId: string,
    input: SaveAgenda,
  ): Promise<MeetingDetail> {
    await this.contribute(scope, meetingId);
    const { tx } = scope;
    await guarded(async () => {
      await tx
        .delete(schema.meetingAgendaItem)
        .where(
          and(
            eq(schema.meetingAgendaItem.meetingId, meetingId),
            eq(schema.meetingAgendaItem.ownerOrgId, scope.orgId),
          ),
        );
      if (input.items.length > 0) {
        await tx.insert(schema.meetingAgendaItem).values(
          input.items.map((title, index) => ({
            ...this.base(scope, meetingId),
            title,
            position: index + 1,
          })),
        );
      }
    });
    return this.detail(scope, meetingId);
  }

  /** Protokoll nur von der Seite, die den Termin angelegt hat; Beschlüsse je Seite. */
  async saveProtocol(
    scope: MeetingScope,
    meetingId: string,
    input: SaveProtocol,
  ): Promise<MeetingDetail> {
    const meeting = await this.contribute(scope, meetingId);
    const owner = meeting.ownerOrgId === scope.orgId;
    if (!owner && input.protocol !== null && input.protocol !== (meeting.protocol ?? null)) {
      throw forbidden();
    }
    const { tx } = scope;
    await guarded(async () => {
      if (owner) {
        await tx
          .update(schema.meeting)
          .set({ protocol: input.protocol || null })
          .where(eq(schema.meeting.id, meetingId));
      }
      await tx
        .delete(schema.meetingDecision)
        .where(
          and(
            eq(schema.meetingDecision.meetingId, meetingId),
            eq(schema.meetingDecision.ownerOrgId, scope.orgId),
          ),
        );
      if (input.decisions.length > 0) {
        await tx.insert(schema.meetingDecision).values(
          input.decisions.map((text, index) => ({
            ...this.base(scope, meetingId),
            text,
            position: index + 1,
          })),
        );
      }
    });
    return this.detail(scope, meetingId);
  }

  /** Interne Notiz der eigenen Organisation; leer löscht sie. */
  async saveNote(
    scope: MeetingScope,
    meetingId: string,
    input: SaveMeetingNote,
  ): Promise<MeetingDetail> {
    await this.contribute(scope, meetingId);
    const { tx } = scope;
    if (input.text === '') {
      await tx
        .delete(schema.meetingNote)
        .where(
          and(
            eq(schema.meetingNote.meetingId, meetingId),
            eq(schema.meetingNote.orgId, scope.orgId),
          ),
        );
    } else {
      await tx
        .insert(schema.meetingNote)
        .values({
          meetingId,
          relationshipId: scope.relationshipId,
          orgId: scope.orgId,
          text: input.text,
        })
        .onConflictDoUpdate({
          target: [schema.meetingNote.meetingId, schema.meetingNote.orgId],
          set: { text: input.text, updatedAt: new Date() },
        });
    }
    return this.detail(scope, meetingId);
  }
}
