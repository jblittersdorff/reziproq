import { z } from 'zod';

// Verlauf (PLT-08): GET /api/audit?object_type=…&object_id=…

export const auditActions = ['created', 'updated', 'ended', 'shared', 'approved'] as const;

export const auditQuerySchema = z.object({
  object_type: z.string().min(1).max(100),
  object_id: z.string().min(1).max(100),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;

/** Ein Eintrag, neueste zuerst. Personen mit Namen, wie sie zum Zeitpunkt hießen. */
export const auditEntrySchema = z.object({
  id: z.string(),
  occurredAt: z.string(),
  actorName: z.string(),
  /** Name der Organisation der handelnden Person */
  organization: z.string(),
  action: z.enum(auditActions),
  /** Je Feld alter und neuer Wert; nur Felder, die das Objekt freigibt */
  changes: z.record(z.string(), z.object({ from: z.unknown(), to: z.unknown() })),
});

export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const auditResponseSchema = z.object({ entries: z.array(auditEntrySchema) });

export type AuditResponse = z.infer<typeof auditResponseSchema>;
