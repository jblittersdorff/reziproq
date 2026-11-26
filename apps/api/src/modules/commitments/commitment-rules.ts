import { UnprocessableEntityException } from '@nestjs/common';
import { currentTime, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  type CommitmentEvidence,
  type StoredCommitmentEvidence,
  storedCommitmentEvidenceSchema,
} from '@reziproq/shared';
import { berlinDate } from '../today/berlin.js';

// ZQ-01 (K2-a.2): Regeln der Zusagen für jeden Dienst, der Zusagen bucht. Gehalten nur mit Beleg
// (Regel 2, T2-ZQ2; dieselbe Prüfung steht als Constraint in der Datenbank), Ersatz nach E-K2-2
// (Regel 3) und die Quote je Seite und Jahr, in der nur beidseitig bestätigte Zusagen zählen.

type CommitmentRow = typeof schema.commitment.$inferSelect;

export const evidenceMissing = () =>
  new UnprocessableEntityException({ statusCode: 422, code: 'beleg_fehlt' });

/** Beleg, wie ein Dienst ihn übergibt; ref nennt das Objekt, auf das er sich stützt */
export type EvidenceInput = CommitmentEvidence & { ref?: StoredCommitmentEvidence['ref'] };

/** Beleg der Buchung „gehalten“ mit Person und Zeitpunkt; ohne Beleg 422 beleg_fehlt */
export function keptEvidence(
  evidence: EvidenceInput | undefined,
  actor: { userId: string; name: string },
): StoredCommitmentEvidence {
  if (!evidence) throw evidenceMissing();
  return {
    ...evidence,
    byUserId: actor.userId,
    byName: actor.name,
    at: currentTime().toISOString(),
  };
}

/** Felder für einen neuen Status: Beleg nur bei gehalten, Abschluss-Zeitpunkt außer bei offen */
export function statusFields(
  status: CommitmentRow['status'],
  evidence: StoredCommitmentEvidence | null,
): Pick<CommitmentRow, 'status' | 'fulfilledEvidence' | 'doneAt'> {
  if (status === 'kept' && !evidence) throw evidenceMissing();
  return {
    status,
    fulfilledEvidence: status === 'kept' ? evidence : null,
    doneAt: status === 'open' ? null : currentTime(),
  };
}

/** Gespeicherter Beleg für die Anzeige; unlesbare Werte gelten als keiner */
export function evidenceOf(value: unknown): StoredCommitmentEvidence | null {
  const parsed = storedCommitmentEvidenceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * E-K2-2: Eine ersetzte Zusage zählt als verfehlt nur, wenn ihre Frist vor dem Ersatz verstrichen
 * war; sonst gilt sie als ersetzt und zählt in keiner Quote. „Heute“ nach Berlin und nach der Uhr
 * des Mandanten (B-33).
 */
export function replacedStatus(
  dueOn: string,
  today: string = berlinDate(currentTime()),
): 'missed' | 'replaced' {
  return dueOn < today ? 'missed' : 'replaced';
}

export interface Replacement {
  title: string;
  dueOn: string;
  ownerUserId: string | null;
  ownerName: string;
  measure?: string | null;
  sourceType?: CommitmentRow['sourceType'];
  sourceRef?: string | null;
}

/**
 * Regel 3: Eine neue Zusage derselben Seite ersetzt eine offene. Die neue verweist mit
 * supersedes_id auf die alte; die alte wird verfehlt oder ersetzt (E-K2-2), bei geteilten Zusagen
 * über app_zusage_status. Anlegen darf nur die zusagende Seite (RLS).
 */
export async function replaceCommitment(
  tx: TenantTransaction,
  old: CommitmentRow,
  next: Replacement,
  actor: { userId: string; name: string },
): Promise<{ id: string; oldStatus: 'missed' | 'replaced' }> {
  if (old.status !== 'open') {
    throw new UnprocessableEntityException({ statusCode: 422, code: 'nicht_offen' });
  }
  const [created] = await tx
    .insert(schema.commitment)
    .values({
      relationshipId: old.relationshipId,
      ownerOrgId: old.ownerOrgId,
      visibility: old.visibility,
      jbpId: old.jbpId,
      initiativeId: old.initiativeId,
      side: old.side,
      title: next.title,
      measure: next.measure ?? old.measure,
      ownerUserId: next.ownerUserId,
      ownerName: next.ownerName,
      dueOn: next.dueOn,
      sourceType: next.sourceType ?? old.sourceType,
      sourceRef: next.sourceRef ?? null,
      supersedesId: old.id,
      createdBy: actor.userId,
      createdByName: actor.name,
    })
    .returning({ id: schema.commitment.id });
  if (!created) throw new Error('Zusage nicht angelegt');
  const oldStatus = replacedStatus(old.dueOn);
  if (old.visibility === 'shared') {
    await tx.execute(sql`select app_zusage_status(${old.id}, ${oldStatus}, null)`);
  } else {
    await tx
      .update(schema.commitment)
      .set({ ...statusFields(oldStatus, null), updatedAt: currentTime() })
      .where(eq(schema.commitment.id, old.id));
  }
  return { id: created.id, oldStatus };
}

export interface SideQuote {
  kept: number;
  due: number;
  /** Gehalten je fällig in Prozent, gerundet; null ohne fällige Zusage */
  percent: number | null;
}

/** Regel 2: Quote je Seite für ein Jahr, nur beidseitig bestätigte Zusagen (Sicht commitment_rate) */
export async function commitmentQuote(
  tx: TenantTransaction,
  relationshipId: string,
  year: number,
): Promise<Record<'buyer' | 'supplier', SideQuote>> {
  const rows = (
    await tx.execute<{ side: 'buyer' | 'supplier'; kept: number; due: number }>(sql`
      select side, kept, due from commitment_rate
      where relationship_id = ${relationshipId} and year = ${year}`)
  ).rows;
  const quote = (side: 'buyer' | 'supplier'): SideQuote => {
    const row = rows.find((entry) => entry.side === side);
    const kept = row?.kept ?? 0;
    const due = row?.due ?? 0;
    return { kept, due, percent: due === 0 ? null : Math.round((kept / due) * 100) };
  };
  return { buyer: quote('buyer'), supplier: quote('supplier') };
}
