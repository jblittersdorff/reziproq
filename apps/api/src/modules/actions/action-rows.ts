import { currentTime, sql, type TenantTransaction } from '@reziproq/db';
import type { ActionItem, WorkItemKind } from '@reziproq/shared';
import { berlinDate } from '../today/berlin.js';

// QBR-03, ZQ-01 (K2-a.3): Zusagen und Aufgaben einer Beziehung, früher Maßnahmen (E-K2-1). Eine
// Abfrage über beide Tabellen, wie Row-Level Security sie der Session zeigt: geteilte Zusagen beider
// Seiten, die eigenen internen Zusagen und die eigenen Aufgaben. Für die alten Maßnahmen-Seiten bis
// K2-c und für jeden Dienst, der offene Zusagen und Aufgaben liest.

/** Offen heißt bei Aufgaben noch zu tun: open oder in_progress; bei Zusagen open */
export const openStatuses = ['open', 'in_progress'] as const;

/** Heute als JJJJ-MM-TT nach Berlin und der Uhr des Mandanten (B-33) */
export const today = () => berlinDate(currentTime());

export const isOpen = (row: { kind: WorkItemKind; status: string }) =>
  row.kind === 'commitment'
    ? row.status === 'open'
    : (openStatuses as readonly string[]).includes(row.status);

export const isOverdue = (row: { kind: WorkItemKind; dueDate: string; status: string }) =>
  isOpen(row) && row.dueDate < today();

export interface WorkRow {
  kind: WorkItemKind;
  id: string;
  relationshipId: string;
  ownerOrgId: string;
  visibility: 'internal' | 'shared';
  title: string;
  description: string | null;
  /** Wer zusagt bzw. wessen Aufgabe es ist */
  ownerSide: 'buyer' | 'supplier';
  ownerUserId: string | null;
  ownerName: string;
  dueDate: string;
  status: ActionItem['status'];
  /** Quelle, wie die alten Seiten sie kennen (Termin, Feedback-Lücke, Initiative, Hinweis, Hand) */
  sourceType: ActionItem['sourceType'];
  sourceId: string | null;
  evidence: unknown;
  meetingTitle: string | null;
  gapDimension: string | null;
}

export interface WorkFilter {
  relationshipIds: string[];
  /** Nur offene (Aufgaben open oder in_progress, Zusagen open) */
  openOnly?: boolean;
  /** Nur diese Art */
  kind?: WorkItemKind;
  /** Nur mit dieser verantwortlichen Person */
  ownerUserId?: string;
  /** Nur aus diesen Quellen, z. B. Feedback-Lücken einer Welle oder ein Termin */
  source?: { type: 'meeting' | 'feedback_gap'; ids: string[] };
}

/**
 * Zusagen und Aufgaben in einer Liste. Quellen der Zusagen werden auf die Arten der alten Seiten
 * abgebildet: feedback heißt dort feedback_gap, ein Gemeinsamer Plan mit Initiative heißt
 * initiative, Mail, Hinweis und Deal zählen bis zur Akte (K2-c) als von Hand.
 */
export async function workRows(tx: TenantTransaction, filter: WorkFilter): Promise<WorkRow[]> {
  if (filter.relationshipIds.length === 0) return [];
  if (filter.source && filter.source.ids.length === 0) return [];
  const ids = filter.relationshipIds;
  const owner = filter.ownerUserId ?? null;
  const commitments = sql`
    select 'commitment' as kind, c.id, c.relationship_id, c.owner_org_id, c.visibility, c.title,
      c.description, c.side as owner_side, c.owner_user_id, c.owner_name, c.due_on::text as due_date,
      c.status,
      case
        when c.source_type = 'feedback' then 'feedback_gap'
        when c.source_type in ('meeting', 'initiative') then c.source_type
        when c.source_type is null and c.initiative_id is not null then 'initiative'
        else 'manual'
      end as source_type,
      case
        when c.source_type in ('meeting', 'feedback') then c.source_ref
        when c.source_type = 'initiative' then coalesce(c.source_ref, c.initiative_id)
        when c.source_type is null then c.initiative_id
      end as source_id,
      c.fulfilled_evidence as evidence
    from commitment c
    where c.relationship_id in ${ids}
      ${filter.openOnly ? sql`and c.status = 'open'` : sql``}
      ${owner ? sql`and c.owner_user_id = ${owner}` : sql``}`;
  const tasks = sql`
    select 'task' as kind, t.id, t.relationship_id, t.org_id as owner_org_id,
      'internal' as visibility, t.title, t.description,
      case t.space when 'buyer_private' then 'buyer' else 'supplier' end as owner_side,
      t.owner_user_id, t.owner_name, t.due_date::text as due_date, t.status,
      case when t.source_type = 'hint' then 'manual' else t.source_type end as source_type,
      case when t.source_type = 'hint' then null else t.source_id end as source_id,
      null::jsonb as evidence
    from task t
    where t.relationship_id in ${ids}
      ${filter.openOnly ? sql`and t.status in ('open', 'in_progress')` : sql``}
      ${owner ? sql`and t.owner_user_id = ${owner}` : sql``}`;
  const parts =
    filter.kind === 'commitment'
      ? commitments
      : filter.kind === 'task'
        ? tasks
        : sql`${commitments} union all ${tasks}`;
  const rows = await tx.execute<{
    kind: WorkItemKind;
    id: string;
    relationship_id: string;
    owner_org_id: string;
    visibility: 'internal' | 'shared';
    title: string;
    description: string | null;
    owner_side: 'buyer' | 'supplier';
    owner_user_id: string | null;
    owner_name: string;
    due_date: string;
    status: ActionItem['status'];
    source_type: ActionItem['sourceType'];
    source_id: string | null;
    evidence: unknown;
    meeting_title: string | null;
    gap_dimension: string | null;
  }>(sql`
    select w.*, m.title as meeting_title,
      r.dimension as gap_dimension
    from (${parts}) w
    left join meeting m on w.source_type = 'meeting' and m.id = w.source_id
    left join survey_result r on w.source_type = 'feedback_gap' and r.id = w.source_id
    where true
      ${
        filter.source
          ? sql`and w.source_type = ${filter.source.type} and w.source_id in ${filter.source.ids}`
          : sql``
      }
    order by w.due_date, w.title`);
  return rows.rows.map((row) => ({
    kind: row.kind,
    id: row.id,
    relationshipId: row.relationship_id,
    ownerOrgId: row.owner_org_id,
    visibility: row.visibility,
    title: row.title,
    description: row.description,
    ownerSide: row.owner_side,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    dueDate: row.due_date,
    status: row.status,
    sourceType: row.source_type,
    sourceId: row.source_id,
    evidence: row.evidence,
    meetingTitle: row.meeting_title,
    gapDimension: row.gap_dimension,
  }));
}

/**
 * Offene Zusagen und Aufgaben einer Beziehung, wie Row-Level Security sie der Session zeigt. Für
 * Überblick und Termin; liest nur.
 */
export async function openActionsOf(tx: TenantTransaction, relationshipId: string) {
  return (await workRows(tx, { relationshipIds: [relationshipId], openOnly: true })).map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    status: row.status,
    dueDate: row.dueDate,
  }));
}

/** Zählt offene und überfällige Zusagen und Aufgaben einer Beziehung. */
export async function countOpenActions(tx: TenantTransaction, relationshipId: string) {
  const rows = await workRows(tx, { relationshipIds: [relationshipId], openOnly: true });
  return { open: rows.length, overdue: rows.filter((row) => row.dueDate < today()).length };
}
