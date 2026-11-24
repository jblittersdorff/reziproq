import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, currentTime, desc, eq, inArray, schema, type TenantTransaction } from '@reziproq/db';
import {
  type ActivityFeed,
  type ActivityFilter,
  type ActivityItem,
  activityFeedSchema,
  type NotePatch,
  type NoteRequest,
  noteRequestSchema,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { ownRelationship } from '../suppliers/team.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

/** Wohin ein Entwurf von Reziproq führt, je Art (SEG-11, PUL-08, SPL-10, QBR-07) */
const draftHref = (relationshipId: string, kind: string, objectId: string) => {
  const base = `/lieferanten/${relationshipId}`;
  switch (kind) {
    case 'deviation_explanation':
      return `${base}/strategie/segmentierung`;
    case 'feedback_themes':
      return `${base}/beziehung/feedback`;
    case 'plan_summary':
      return `${base}/strategie/lieferantenplan`;
    case 'pre_read':
      return `${base}/umsetzung/termine/${objectId}`;
    default:
      return null;
  }
};

/**
 * NAV-10: Aktivitäten eines Lieferanten als Sicht über die Quelltabellen. Die Zeilensicherheit der
 * Quellen gilt weiter: Eine private Notiz liefert die Datenbank nur ihrer Autorin.
 */
@Injectable()
export class ActivitiesService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private run<T>(
    auth: AuthContext,
    work: (tx: TenantTransaction, organization: AccountOrganization) => Promise<T>,
  ): Promise<T> {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, (tx) =>
      work(tx, organization),
    );
  }

  feed(auth: AuthContext, relationshipId: string, filter?: ActivityFilter): Promise<ActivityFeed> {
    return this.run(auth, async (tx, organization) => {
      await ownRelationship(tx, organization, relationshipId);
      return this.feedIn(tx, auth, relationshipId, filter);
    });
  }

  private async feedIn(
    tx: TenantTransaction,
    auth: AuthContext,
    relationshipId: string,
    filter?: ActivityFilter,
  ): Promise<ActivityFeed> {
    const want = (group: ActivityFilter) => !filter || filter === group;
    const items: ActivityItem[] = [];

    if (want('notizen')) {
      const notes = await tx
        .select({ note: schema.note, author: schema.appUser.name })
        .from(schema.note)
        .innerJoin(schema.appUser, eq(schema.appUser.id, schema.note.authorUserId))
        .where(eq(schema.note.relationshipId, relationshipId))
        .orderBy(desc(schema.note.createdAt));
      for (const { note, author } of notes) {
        items.push({
          id: `note:${note.id}`,
          kind: note.kind,
          occurredAt: note.createdAt.toISOString(),
          actor: { type: 'person', name: author },
          title: note.text,
          code: null,
          meta: null,
          href: null,
          visibility: note.visibility,
          pinned: note.pinned,
          mine: note.authorUserId === auth.userId,
        });
      }
    }

    if (want('termine')) {
      const meetings = await tx
        .select({
          id: schema.meeting.id,
          title: schema.meeting.title,
          startsAt: schema.meeting.startsAt,
          location: schema.meeting.location,
          createdByName: schema.meeting.createdByName,
          source: schema.meeting.source,
        })
        .from(schema.meeting)
        .where(eq(schema.meeting.relationshipId, relationshipId));
      for (const meeting of meetings) {
        items.push({
          id: `meeting:${meeting.id}`,
          kind: 'meeting',
          occurredAt: meeting.startsAt.toISOString(),
          actor: { type: 'person', name: meeting.createdByName },
          title: meeting.title,
          // IN-03: Herkunft „aus Outlook“, „aus dem Kalender“ …
          code: meeting.source === 'reziproq' ? null : meeting.source,
          meta: meeting.location,
          href: `/lieferanten/${relationshipId}/umsetzung/termine/${meeting.id}`,
          visibility: 'team',
          pinned: false,
          mine: false,
        });
      }
    }

    if (want('mails')) {
      // IN-04: abgelegte Mails; „Nur ich“ liefert die Datenbank nur der ablegenden Person
      const mails = await tx
        .select({ mail: schema.filedMail, filer: schema.appUser.name })
        .from(schema.filedMail)
        .innerJoin(schema.appUser, eq(schema.appUser.id, schema.filedMail.filedBy))
        .where(eq(schema.filedMail.relationshipId, relationshipId));
      const mailIds = mails.map(({ mail }) => mail.id);
      const attachments =
        mailIds.length === 0
          ? []
          : await tx
              .select()
              .from(schema.filedMailAttachment)
              .where(inArray(schema.filedMailAttachment.filedMailId, mailIds));
      const draftIds = mails.flatMap(({ mail }) =>
        mail.summaryDraftId ? [mail.summaryDraftId] : [],
      );
      const summaries = new Map(
        (draftIds.length === 0
          ? []
          : await tx
              .select({
                id: schema.aiDraft.id,
                content: schema.aiDraft.content,
                status: schema.aiDraft.status,
              })
              .from(schema.aiDraft)
              .where(inArray(schema.aiDraft.id, draftIds))
        )
          .filter((draft) => draft.status !== 'discarded')
          .map((draft) => [draft.id, draft.content]),
      );
      for (const { mail, filer } of mails) {
        items.push({
          id: `mail:${mail.id}`,
          kind: 'mail',
          occurredAt: mail.sentAt.toISOString(),
          actor: { type: 'person', name: filer },
          title: mail.subject,
          code: mail.source,
          meta: mail.fromName ?? mail.fromEmail,
          href: null,
          visibility: mail.visibility,
          pinned: false,
          mine: mail.filedBy === auth.userId,
          mail: {
            id: mail.id,
            fromEmail: mail.fromEmail,
            fromName: mail.fromName,
            sentAt: mail.sentAt.toISOString(),
            summary: (mail.summaryDraftId && summaries.get(mail.summaryDraftId)) || null,
            source: mail.source,
            attachments: attachments
              .filter((attachment) => attachment.filedMailId === mail.id)
              .map((attachment) => ({
                id: attachment.id,
                fileName: attachment.fileName,
                mime: attachment.mime,
                size: attachment.size,
                stored: attachment.fileKey !== null,
              })),
          },
        });
      }
    }

    if (want('reziproq')) {
      // Hinweise (FS-01) und Entwürfe von Reziproq stehen mit Reziproq als Akteur.
      const hints = await tx
        .select({
          id: schema.hint.id,
          ruleKey: schema.hint.ruleKey,
          status: schema.hint.status,
          createdAt: schema.hint.createdAt,
        })
        .from(schema.hint)
        .where(eq(schema.hint.relationshipId, relationshipId));
      for (const hint of hints) {
        items.push({
          id: `hint:${hint.id}`,
          kind: 'hint',
          occurredAt: hint.createdAt.toISOString(),
          actor: { type: 'reziproq' },
          title: '',
          code: hint.ruleKey,
          meta: hint.status,
          href: '/hinweise',
          visibility: 'team',
          pinned: false,
          mine: false,
        });
      }
      const drafts = await tx
        .select({
          id: schema.aiDraft.id,
          kind: schema.aiDraft.kind,
          objectId: schema.aiDraft.objectId,
          status: schema.aiDraft.status,
          createdAt: schema.aiDraft.createdAt,
        })
        .from(schema.aiDraft)
        .where(eq(schema.aiDraft.relationshipId, relationshipId));
      for (const draft of drafts) {
        items.push({
          id: `agent:${draft.id}`,
          kind: 'agent',
          occurredAt: draft.createdAt.toISOString(),
          actor: { type: 'reziproq' },
          title: '',
          code: draft.kind,
          meta: draft.status,
          href: draftHref(relationshipId, draft.kind, draft.objectId),
          visibility: 'team',
          pinned: false,
          mine: false,
        });
      }
    }

    // Angeheftete oben, sonst neueste zuerst
    items.sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.occurredAt.localeCompare(a.occurredAt),
    );
    return activityFeedSchema.parse({ canWrite: can(auth, 'notizen.schreiben'), items });
  }

  addNote(auth: AuthContext, relationshipId: string, input: NoteRequest): Promise<ActivityFeed> {
    return this.writeNote(auth, relationshipId, input, (tx) =>
      this.feedIn(tx, auth, relationshipId),
    );
  }

  /** Für Anbindungen (IN-01): dieselbe Prüfung wie addNote, Ergebnis ist die ID der Notiz. */
  async createNote(auth: AuthContext, relationshipId: string, input: NoteRequest): Promise<string> {
    return this.writeNote(auth, relationshipId, input, async (_tx, id) => id);
  }

  private writeNote<T>(
    auth: AuthContext,
    relationshipId: string,
    input: NoteRequest,
    result: (tx: TenantTransaction, id: string) => Promise<T>,
  ): Promise<T> {
    // Auch Anbindungen (IN-01) schreiben hierüber; das Recht gilt deshalb im Dienst, nicht nur am Endpunkt.
    if (!can(auth, 'notizen.schreiben')) throw forbidden();
    const note = noteRequestSchema.parse(input);
    return this.run(auth, async (tx, organization) => {
      await ownRelationship(tx, organization, relationshipId);
      const [created] = await tx
        .insert(schema.note)
        .values({
          orgId: organization.id,
          relationshipId,
          authorUserId: auth.userId,
          ...note,
        })
        .returning({ id: schema.note.id });
      return result(tx, created?.id ?? '');
    });
  }

  /** Ändern, anheften und löschen nur die eigenen Notizen. */
  private async ownNote(
    tx: TenantTransaction,
    auth: AuthContext,
    relationshipId: string,
    id: string,
  ) {
    const [row] = await tx
      .select({ id: schema.note.id, author: schema.note.authorUserId })
      .from(schema.note)
      .where(and(eq(schema.note.id, id), eq(schema.note.relationshipId, relationshipId)));
    if (!row) throw notFound();
    if (row.author !== auth.userId) throw forbidden();
  }

  updateNote(
    auth: AuthContext,
    relationshipId: string,
    id: string,
    change: NotePatch,
  ): Promise<ActivityFeed> {
    return this.run(auth, async (tx, organization) => {
      await ownRelationship(tx, organization, relationshipId);
      await this.ownNote(tx, auth, relationshipId, id);
      await tx
        .update(schema.note)
        .set({
          ...(change.text !== undefined ? { text: change.text } : {}),
          ...(change.pinned !== undefined ? { pinned: change.pinned } : {}),
          updatedAt: currentTime(),
        })
        .where(eq(schema.note.id, id));
      return this.feedIn(tx, auth, relationshipId);
    });
  }

  removeNote(auth: AuthContext, relationshipId: string, id: string): Promise<ActivityFeed> {
    return this.run(auth, async (tx, organization) => {
      await ownRelationship(tx, organization, relationshipId);
      await this.ownNote(tx, auth, relationshipId, id);
      await tx.delete(schema.note).where(inArray(schema.note.id, [id]));
      return this.feedIn(tx, auth, relationshipId);
    });
  }
}
