import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  and,
  currentTime,
  eq,
  inArray,
  schema,
  sql,
  type TenantSession,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type DoneList,
  type DoneRow,
  doneListSchema,
  doneWithoutUndo,
  type UndoBlocker,
  type UndoPayload,
  undoDays,
  undoPayloadSchema,
  type WorkerLevel,
  workers,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { visibleRelationships } from '../start/my-day-data.js';
import { berlinDate, berlinTime } from './berlin.js';

// HE-01 Erledigt im Hintergrund (K1-e.3): die Läufe von Reziproq für die Person, mit Rücknahme
// (Dienst 3). Zurücknehmen spielt den undo_payload zurück, wenn das Objekt unverändert ist und die
// Handlung höchstens 30 Tage zurückliegt; sonst lehnt es mit Grund ab.

const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const day = 86_400_000;

/** Aufgaben, die es schon gibt (MA-01): Stufe rechts auf Erledigt */
const shownWorkers = workers.filter((worker) => worker.chapter === 1 || worker.existing);

interface RunRow extends Record<string, unknown> {
  id: string;
  status: string;
  created_at: Date | string;
  finished_at: Date | string | null;
  undone_at: Date | string | null;
  undo_payload: unknown;
  context_relationship_id: string | null;
  context_type: string | null;
  context_id: string | null;
  task: string;
  task_name: string;
  open_drafts: number;
  drafts: number;
  meeting_title: string | null;
}

@Injectable()
export class DoneService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private session(auth: AuthContext): TenantSession | null {
    return auth.organization ? { userId: auth.userId, organizationId: auth.organization.id } : null;
  }

  /** Erledigt: Läufe der letzten 30 Tage, neueste zuerst, mit Rücknahme und Stufen je Aufgabe */
  async list(auth: AuthContext): Promise<DoneList> {
    const since = doneSinceNow();
    const session = this.session(auth);
    const organization = auth.organization;
    if (!session || !organization) {
      return doneListSchema.parse({ since: since.toISOString(), recent: 0, rows: [], tasks: [] });
    }
    return this.tenant.run(
      session,
      async (tx) => {
        const now = currentTime();
        const rows = await tx.execute<RunRow>(sql`
          select r.id, r.status, r.created_at, r.finished_at, r.undone_at, r.undo_payload,
            r.context_relationship_id, r.context_type, r.context_id,
            a.key as task, a.name as task_name,
            (select count(*)::int from ai_draft d
              where d.org_id = r.org_id and d.run_id = r.id and d.status = 'draft') as open_drafts,
            (select count(*)::int from ai_draft d
              where d.org_id = r.org_id and d.run_id = r.id) as drafts,
            (select m.title from meeting m
              where r.context_type = 'meeting' and m.id = r.context_id) as meeting_title
          from agent_run r
          join agent_version v on v.org_id = r.org_id and v.id = r.agent_version_id
          join agent a on a.org_id = v.org_id and a.id = v.agent_id
          where r.org_id = ${organization.id} and r.acting_user_id = ${auth.userId}
            and not r.is_test and r.status in ('done', 'failed')
            and r.created_at >= ${new Date(now.getTime() - undoDays * day).toISOString()}::timestamptz
          order by coalesce(r.finished_at, r.created_at) desc, r.id desc
          limit 200`);
        const names = organization.buyer
          ? await visibleRelationships(tx, {
              orgId: organization.id,
              userId: auth.userId,
              admin: auth.orgRole === 'admin',
            })
          : new Map<string, string>();
        const result: DoneRow[] = [];
        for (const row of rows.rows) {
          const payload = undoPayloadSchema.safeParse(row.undo_payload);
          const at = new Date(row.finished_at ?? row.created_at);
          // Eine gesendete Erinnerung (K2-b.6) lässt sich nicht zurückholen
          const blocker: UndoBlocker | null =
            !payload.success || doneWithoutUndo.includes(payload.data.kind)
              ? 'ohne'
              : row.undone_at
                ? 'zurueckgenommen'
                : now.getTime() - at.getTime() > undoDays * day
                  ? 'abgelaufen'
                  : (await changedSince(tx, payload.data, at))
                    ? 'geaendert'
                    : null;
          const relationshipId = row.context_relationship_id;
          const counterpart = relationshipId ? (names.get(relationshipId) ?? null) : null;
          if (payload.success && payload.data.kind === 'inbound_assign') {
            const meeting = payload.data.meetings[0];
            result.push({
              id: row.id,
              at: at.toISOString(),
              task: row.task,
              taskName: row.task_name,
              status: row.undone_at ? 'undone' : 'done',
              action: 'inbound_assign',
              subject: payload.data.subject,
              counterpart: names.get(payload.data.relationshipId) ?? counterpart,
              href:
                meeting && !row.undone_at
                  ? `/lieferanten/${payload.data.relationshipId}/umsetzung/termine/${meeting.id}`
                  : null,
              openDrafts: 0,
              undo: { possible: blocker === null, blocker },
            });
            continue;
          }
          // K1-g.2: Mail, die das Postfach selbst abgelegt hat
          if (payload.success && payload.data.kind === 'mail_assign') {
            const mail = payload.data;
            result.push({
              id: row.id,
              at: at.toISOString(),
              task: row.task,
              taskName: row.task_name,
              status: row.undone_at ? 'undone' : 'done',
              action: 'mail_assign',
              subject: mail.subject.trim() && mail.subject !== '–' ? mail.subject : null,
              sender: mail.sender,
              counterpart: names.get(mail.relationshipId) ?? counterpart,
              // K2-c.7: die Mail im Verlauf der Akte
              href: row.undone_at
                ? null
                : `/beziehungen/${mail.relationshipId}?sicht=privat#mail-${mail.mailId}`,
              openDrafts: 0,
              undo: { possible: blocker === null, blocker },
            });
            continue;
          }
          // ZQ-01 Regel 5 (K2-b.6): Erinnerung an eine Zusage des Lieferanten, als Nachricht von
          // Reziproq; ansehen bei den Zusagen der Beziehung, ohne Rücknahme
          if (payload.success && payload.data.kind === 'commitment_remind') {
            const remind = payload.data;
            result.push({
              id: row.id,
              at: at.toISOString(),
              task: row.task,
              taskName: row.task_name,
              status: row.status === 'failed' ? 'failed' : 'done',
              action: 'commitment_remind',
              subject: remind.title,
              recipient: remind.recipient,
              counterpart: names.get(remind.relationshipId) ?? counterpart,
              href: `/lieferanten/${remind.relationshipId}/umsetzung/massnahmen`,
              openDrafts: 0,
              undo: { possible: false, blocker: 'ohne' },
            });
            continue;
          }
          const meetingHref =
            row.context_type === 'meeting' && relationshipId && row.context_id
              ? `/lieferanten/${relationshipId}/umsetzung/termine/${row.context_id}`
              : null;
          result.push({
            id: row.id,
            at: at.toISOString(),
            task: row.task,
            taskName: row.task_name,
            status: row.status === 'failed' ? 'failed' : 'done',
            action: row.drafts > 0 ? 'prepared' : 'run',
            subject: row.meeting_title,
            counterpart,
            href: row.open_drafts > 0 ? '/kurz-pruefen' : meetingHref,
            openDrafts: row.open_drafts,
            undo: { possible: false, blocker },
          });
        }
        const settings = await tx
          .select({ key: schema.workerSetting.agentKey, level: schema.workerSetting.level })
          .from(schema.workerSetting)
          .where(
            and(
              eq(schema.workerSetting.orgId, organization.id),
              eq(schema.workerSetting.userId, auth.userId),
            ),
          );
        const levels = new Map(settings.map((entry) => [entry.key, entry.level as WorkerLevel]));
        return doneListSchema.parse({
          since: since.toISOString(),
          recent: result.filter((row) => new Date(row.at) >= since && row.status !== 'undone')
            .length,
          rows: result,
          tasks: shownWorkers.map((worker) => ({
            key: worker.key,
            level: levels.get(worker.key) ?? worker.defaultLevel,
          })),
        });
      },
      { readOnly: true },
    );
  }

  /** Zurücknehmen (HE-01 Dienst 3): nur eigene Handlungen, bis 30 Tage, Objekt unverändert */
  async undo(auth: AuthContext, runId: string): Promise<{ state: 'undone' }> {
    const session = this.session(auth);
    if (!session || auth.supportOrganization) throw notFound();
    return this.tenant.run(session, async (tx) => {
      const [run] = await tx
        .select()
        .from(schema.agentRun)
        .where(
          and(
            eq(schema.agentRun.id, runId),
            eq(schema.agentRun.orgId, session.organizationId as string),
            eq(schema.agentRun.actingUserId, auth.userId),
          ),
        );
      if (!run) throw notFound();
      const payload = undoPayloadSchema.safeParse(run.undoPayload);
      // Ohne Rückweg, oder eine Handlung, die sich nicht zurückholen lässt (gesendete Erinnerung)
      if (
        !payload.success ||
        run.status !== 'done' ||
        doneWithoutUndo.includes(payload.data.kind)
      ) {
        throw new ConflictException({ statusCode: 409, code: 'ohne' });
      }
      if (run.undoneAt) throw new ConflictException({ statusCode: 409, code: 'zurueckgenommen' });
      const at = run.finishedAt ?? run.createdAt;
      if (currentTime().getTime() - at.getTime() > undoDays * day) {
        throw new ConflictException({ statusCode: 409, code: 'abgelaufen' });
      }
      const changed = await changedSince(tx, payload.data, at);
      if (changed) {
        throw new ConflictException({
          statusCode: 409,
          code: 'geaendert',
          changedBy: changed === true ? null : changed,
        });
      }
      await undoPayload(tx, payload.data, auth.userId);
      await tx
        .update(schema.agentRun)
        .set({ undoneAt: currentTime(), undoneBy: auth.userId })
        .where(eq(schema.agentRun.id, runId));
      return { state: 'undone' as const };
    });
  }
}

/** Gestern 18:00 in Berlin nach der Uhr des Mandanten */
function doneSinceNow(): Date {
  const yesterday = new Date(`${berlinDate(currentTime())}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return berlinTime(yesterday.toISOString().slice(0, 10), 18);
}

/**
 * Seit der Handlung geändert? false, wenn alles wie beim Anlegen ist; sonst der Name der Person,
 * die zuletzt geändert hat, oder true, wenn sie nicht bekannt ist.
 */
async function changedSince(
  tx: TenantTransaction,
  payload: UndoPayload,
  at: Date,
): Promise<false | true | string> {
  if (payload.kind === 'mail_assign') {
    // K1-g.2: Die Mail liegt unverändert beim Lieferanten, für das Team sichtbar
    const [mail] = (
      await tx.execute<{ relationship_id: string; visibility: string }>(
        sql`select relationship_id, visibility from filed_mail where id = ${payload.mailId}`,
      )
    ).rows;
    return !mail || mail.relationship_id !== payload.relationshipId || mail.visibility !== 'team';
  }
  if (payload.kind !== 'inbound_assign') return false;
  const ids = payload.meetings.map((meeting) => meeting.id);
  if (ids.length === 0) return false;
  const now = await tx.execute<{
    id: string;
    title: string;
    starts_at: Date | string;
    duration_minutes: number;
    location: string | null;
    status: string;
    type: string;
    visibility: string;
    participants: number;
    agenda_items: number;
    worked: number;
  }>(sql`
    select m.id, m.title, m.starts_at, m.duration_minutes, m.location, m.status, m.type,
      m.visibility,
      (select count(*)::int from meeting_participant p where p.meeting_id = m.id) as participants,
      (select count(*)::int from meeting_agenda_item a where a.meeting_id = m.id) as agenda_items,
      ((select count(*) from meeting_note n where n.meeting_id = m.id)
        + (select count(*) from meeting_capture c where c.meeting_id = m.id)
        + (select count(*) from meeting_transcript t where t.meeting_id = m.id))::int as worked
    from meeting m
    where m.id = any(${sql`${`{${ids.join(',')}}`}::uuid[]`})`);
  const differs = payload.meetings.some((meeting) => {
    const row = now.rows.find((entry) => entry.id === meeting.id);
    if (!row) return true;
    const snap = meeting.snapshot;
    return (
      row.title !== snap.title ||
      new Date(row.starts_at).toISOString() !== snap.startsAt ||
      row.duration_minutes !== snap.durationMinutes ||
      row.location !== snap.location ||
      row.status !== snap.status ||
      row.type !== snap.type ||
      row.visibility !== snap.visibility ||
      row.participants !== snap.participants ||
      row.agenda_items !== snap.agendaItems ||
      row.worked > 0
    );
  });
  if (!differs) return false;
  const [last] = (
    await tx.execute<{ actor_name: string }>(sql`
      select actor_name from audit_event
      where object_type = 'meeting' and object_id = any(${sql`${`{${ids.join(',')}}`}::text[]`})
        and action = 'updated' and occurred_at > ${at.toISOString()}::timestamptz
      order by occurred_at desc
      limit 1`)
  ).rows;
  return last?.actor_name ?? true;
}

/** Spielt einen undo_payload zurück */
async function undoPayload(tx: TenantTransaction, payload: UndoPayload, userId: string) {
  if (payload.kind === 'mail_assign') {
    await undoMail(tx, payload, userId);
    return;
  }
  if (payload.kind !== 'inbound_assign') return;
  const ids = payload.meetings.map((meeting) => meeting.id);
  if (ids.length > 0) {
    // Entwürfe zu den Terminen (z. B. ein Briefing) gelten nicht mehr.
    await tx
      .update(schema.aiDraft)
      .set({
        status: 'discarded',
        dismissReason: 'Termin zurückgenommen',
        decidedBy: userId,
        decidedAt: currentTime(),
      })
      .where(
        and(
          eq(schema.aiDraft.objectType, 'meeting'),
          inArray(schema.aiDraft.objectId, ids),
          eq(schema.aiDraft.status, 'draft'),
        ),
      );
    await tx.delete(schema.meeting).where(inArray(schema.meeting.id, ids));
  }
  // Der Termin steht wieder zum Zuordnen in Kurz prüfen.
  await tx
    .update(schema.inboundItem)
    .set({
      status: 'needs_review',
      assigneeUserId: userId,
      assignedBy: null,
      assignedAt: null,
      objectType: null,
      objectIds: [],
    })
    .where(eq(schema.inboundItem.id, payload.inboundItemId));
}

/**
 * K1-g.2: Die abgelegte Mail geht zurück an den Eingang („Zuordnen“). Text, Empfänger und Anhänge
 * warten dort wieder wie bei „Neu eingegangen“; die Dateien bleiben, nur die Ablage beim Lieferanten
 * und ihre Zusammenfassung als Entwurf entfallen.
 */
async function undoMail(
  tx: TenantTransaction,
  payload: Extract<UndoPayload, { kind: 'mail_assign' }>,
  userId: string,
) {
  const [mail] = await tx
    .select()
    .from(schema.filedMail)
    .where(eq(schema.filedMail.id, payload.mailId));
  const [inbound] = await tx
    .select({ details: schema.inboundItem.details, owner: schema.inboundItem.ownerUserId })
    .from(schema.inboundItem)
    .where(eq(schema.inboundItem.id, payload.inboundItemId));
  if (!mail || !inbound) return;
  const attachments = await tx
    .select({
      fileName: schema.filedMailAttachment.fileName,
      mime: schema.filedMailAttachment.mime,
      size: schema.filedMailAttachment.size,
      fileKey: schema.filedMailAttachment.fileKey,
    })
    .from(schema.filedMailAttachment)
    .where(eq(schema.filedMailAttachment.filedMailId, payload.mailId));
  await tx
    .update(schema.inboundItem)
    .set({
      status: 'needs_review',
      assigneeUserId: userId,
      assignedBy: null,
      assignedAt: null,
      objectType: null,
      objectIds: [],
      details: {
        ...inbound.details,
        mail: {
          messageId: mail.messageId,
          fromEmail: mail.fromEmail,
          fromName: mail.fromName,
          toEmails: mail.toEmails,
          sentAt: mail.sentAt.toISOString(),
          bodyText: mail.bodyText,
          forwardedBy: inbound.owner ?? userId,
          attachments,
        },
      },
    })
    .where(eq(schema.inboundItem.id, payload.inboundItemId));
  if (mail.summaryDraftId) {
    await tx
      .update(schema.aiDraft)
      .set({
        status: 'discarded',
        dismissReason: 'Mail zurückgenommen',
        decidedBy: userId,
        decidedAt: currentTime(),
      })
      .where(and(eq(schema.aiDraft.id, mail.summaryDraftId), eq(schema.aiDraft.status, 'draft')));
  }
  await tx.delete(schema.filedMail).where(eq(schema.filedMail.id, payload.mailId));
}
