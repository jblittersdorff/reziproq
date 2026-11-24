import { currentTime, schema, type TenantTransaction } from '@reziproq/db';

// ZA-01 Regel 3, G-5: Ein Objekt wechselt aus einem privaten Raum in die Mitte nur mit dem
// Bestätigungs-Token eines Menschen. Die Datenbank setzt das für Läufe von Reziproq durch
// (Trigger app_guard_shared, Migration 0130); dieser Dienst übersetzt die Ablehnung in einen
// Entwurf, den ein Mensch in Kurz prüfen bestätigt.

/** SQLSTATE der Ablehnung durch app_guard_shared */
export const sharedGuardCode = 'RZ001';

/** Gültigkeit eines Tokens: Es entsteht beim Bestätigen und wird sofort verbraucht. */
const tokenMinutes = 15;

export interface ConfirmTokenInput {
  orgId: string;
  userId: string;
  purpose: string;
  /** Tabelle des Objekts, z. B. action */
  objectType: string;
  objectId: string;
  now?: Date;
}

/** Legt das Token einer Person für genau ein Objekt an (nur in ihrer eigenen Session). */
export async function issueConfirmToken(
  tx: TenantTransaction,
  input: ConfirmTokenInput,
): Promise<string> {
  const now = input.now ?? currentTime();
  const [row] = await tx
    .insert(schema.confirmToken)
    .values({
      orgId: input.orgId,
      userId: input.userId,
      purpose: input.purpose,
      objectType: input.objectType,
      objectId: input.objectId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + tokenMinutes * 60_000),
    })
    .returning({ id: schema.confirmToken.id });
  if (!row) throw new Error('Token wurde nicht angelegt');
  return row.id;
}

export interface ShareRequest {
  orgId: string;
  userId: string;
  relationshipId: string;
  runId: string | null;
  /** Tabelle und Objekt, das in die Mitte soll */
  objectType: string;
  objectId: string;
  /** Was ein Mensch im Entwurf prüft, z. B. „Maßnahme ‚Musterteile‘ mit Rheintal teilen“ */
  summary: string;
}

export type ShareOutcome = { status: 'shared' } | { status: 'draft'; draftId: string };

function rejectedByGuard(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } }).cause?.code;
  return code === sharedGuardCode || (error as { code?: string }).code === sharedGuardCode;
}

/**
 * Führt `share` in einem Sicherungspunkt aus. Lehnt die Datenbank den Wechsel ab, weil der Lauf
 * kein gültiges Token hat, bleibt das Objekt, wo es war, und ein Entwurf „share_request“ entsteht
 * (T1-ZA4). Andere Fehler gehen unverändert weiter.
 */
export async function shareOrDraft(
  tx: TenantTransaction,
  request: ShareRequest,
  share: (savepoint: TenantTransaction) => Promise<unknown>,
): Promise<ShareOutcome> {
  try {
    await tx.transaction(async (savepoint) => {
      await share(savepoint);
    });
    return { status: 'shared' };
  } catch (error) {
    if (!rejectedByGuard(error)) throw error;
  }
  const [draft] = await tx
    .insert(schema.aiDraft)
    .values({
      orgId: request.orgId,
      relationshipId: request.relationshipId,
      kind: 'share_request',
      objectType: request.objectType,
      objectId: request.objectId,
      content: request.summary,
      runId: request.runId,
      model: 'none',
      createdBy: request.userId,
    })
    .returning({ id: schema.aiDraft.id });
  if (!draft) throw new Error('Entwurf wurde nicht angelegt');
  return { status: 'draft', draftId: draft.id };
}
