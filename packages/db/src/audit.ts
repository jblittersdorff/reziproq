import type { AuditAction, AuditChanges } from './schema/audit.js';
import { auditEvent, outboxEvent } from './schema/audit.js';
import type { TenantTransaction } from './tenant.js';

// PLT-08: Verlauf. Ein Objekt bekommt Verlauf, indem es mit auditedObject() markiert wird; jede
// Änderung über auditedChange() schreibt dann in derselben Transaktion genau einen Verlaufs- und
// einen Outbox-Eintrag. Scheitert eins davon, scheitert alles.

/** Ein Objekt mit Verlauf und die Felder, die in den Verlauf dürfen. */
export interface AuditedObject<Fields extends string = string> {
  type: string;
  /**
   * shared: Einträge sehen beide Seiten der Beziehung, also nur geteilte Felder eintragen.
   * internal: nur die eigene Organisation, z. B. Rollen oder internes Team.
   */
  visibility: 'shared' | 'internal';
  fields: readonly Fields[];
}

/** Markiert ein Objekt als „mit Verlauf“. Nur die genannten Felder landen im Verlauf. */
export function auditedObject<const Fields extends string>(
  definition: AuditedObject<Fields>,
): AuditedObject<Fields> {
  return definition;
}

/** Wer ändert: Person mit Namen zum Zeitpunkt der Änderung und ihre Organisation. */
export interface AuditActor {
  userId: string;
  name: string;
  organizationId: string;
}

export interface OutboxEmailPayload {
  template:
    | 'invitation'
    | 'reminder'
    | 'approval'
    | 'escalation'
    | 'supplier_invitation'
    | 'survey'
    | 'mention'
    | 'export_ready';
  locale: 'de' | 'en';
  recipient: string;
  firstName?: string;
  title: string;
  deadline?: string;
  link: string;
  /** Nur supplier_invitation: wer einlädt */
  sender?: string;
  /** Nur supplier_invitation: persönliche Nachricht */
  message?: string;
}

export interface AuditedChangeResult<T> {
  objectId: string;
  relationshipId: string | null;
  action: AuditAction;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  email?: OutboxEmailPayload;
  result: T;
}

/**
 * Alte und neue Werte der Felder, die das Objekt freigibt. Alles andere, z. B. private Werte wie
 * Spend oder Notizen, wird verworfen, bevor es den Verlauf erreicht.
 */
export function diffFields(
  object: AuditedObject,
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): AuditChanges {
  const changes: AuditChanges = {};
  for (const field of object.fields) {
    const from = before?.[field] ?? null;
    const to = after?.[field] ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[field] = { from, to };
  }
  return changes;
}

/**
 * Führt eine Änderung aus und schreibt Verlauf und Outbox in derselben Transaktion. `write`
 * nimmt die Änderung vor und meldet, welches Objekt sich wie geändert hat.
 */
export async function auditedChange<T>(
  tx: TenantTransaction,
  actor: AuditActor,
  object: AuditedObject,
  write: () => Promise<AuditedChangeResult<T>>,
): Promise<T> {
  const change = await write();
  const [event] = await tx
    .insert(auditEvent)
    .values({
      actorUserId: actor.userId,
      actorName: actor.name,
      ownerOrgId: actor.organizationId,
      visibility: object.visibility,
      relationshipId: change.relationshipId,
      objectType: object.type,
      objectId: change.objectId,
      action: change.action,
      changes: diffFields(object, change.before, change.after),
    })
    .returning({ id: auditEvent.id });
  if (!event) throw new Error('Verlaufseintrag nicht angelegt');
  await tx.insert(outboxEvent).values({
    eventType: change.email ? `email.${change.email.template}` : `${object.type}.${change.action}`,
    objectType: object.type,
    objectId: change.objectId,
    auditEventId: event.id,
    orgId: actor.organizationId,
    emailTemplate: change.email?.template ?? null,
    emailLocale: change.email?.locale ?? null,
    emailRecipient: change.email?.recipient ?? null,
    emailFirstName: change.email?.firstName ?? null,
    emailTitle: change.email?.title ?? null,
    emailDeadline: change.email?.deadline ?? null,
    emailLink: change.email?.link ?? null,
    emailSender: change.email?.sender ?? null,
    emailMessage: change.email?.message ?? null,
  });
  return change.result;
}
