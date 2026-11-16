import { z } from 'zod';

// FS-01: Hinweise auf typische Fehler im Lieferantenmanagement, nur für den Käufer.

export const hintRuleKeys = [
  'segment_spend_only',
  'weak_focus',
  'unexplained_deviation',
  'too_many_focus',
  'no_operational_function',
  'cadence_missed',
  'no_feedback',
  'plan_missing',
  'right_without_obligation',
  'buyer_commitments_overdue',
] as const;
export const hintRuleKeySchema = z.enum(hintRuleKeys);
export type HintRuleKey = z.infer<typeof hintRuleKeySchema>;

/** Standard für „Zu viele Fokuslieferanten je SRO“; Admins ändern ihn. */
export const defaultMaxFocusPerSro = 8;
/** Kürzere Begründungen eines Fokus gelten als „automatisch“. */
export const minFocusReasonLength = 20;

/** Zahlen und Namen für den Satz, warum; je Regel unterschiedlich. */
export const hintDetailSchema = z
  .object({
    count: z.number().int().optional(),
    limit: z.number().int().optional(),
    person: z.string().optional(),
    deviation: z.number().optional(),
    threshold: z.number().optional(),
    format: z.string().optional(),
    since: z.string().optional(),
    jbpDate: z.string().optional(),
    groups: z.array(z.string()).optional(),
  })
  .passthrough();
export type HintDetail = z.infer<typeof hintDetailSchema>;

export const hintSchema = z.object({
  id: z.uuid(),
  ruleKey: hintRuleKeySchema,
  relationshipId: z.uuid().nullable(),
  supplier: z.string().nullable(),
  detail: hintDetailSchema,
  status: z.enum(['open', 'accepted', 'dismissed']),
  reason: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  decidedAt: z.iso.datetime({ offset: true }).nullable(),
  decidedByName: z.string().nullable(),
  /** Wohin „Beheben“ führt */
  href: z.string(),
  /** SRO der Beziehung oder Admin; Annehmen braucht eine Beziehung für die Maßnahme */
  canAccept: z.boolean(),
  canDismiss: z.boolean(),
  /** Nach dem Annehmen: die interne Maßnahme */
  actionHref: z.string().nullable(),
});
export type Hint = z.infer<typeof hintSchema>;

export const hintListSchema = z.object({
  hints: z.array(hintSchema),
  /** Wann die Regeln zuletzt geprüft wurden */
  checkedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type HintList = z.infer<typeof hintListSchema>;

export const dismissHintSchema = z.object({ reason: z.string().trim().min(3).max(1000) }).strict();
export type DismissHint = z.infer<typeof dismissHintSchema>;

export const hintSettingsSchema = z
  .object({ maxFocusPerSro: z.number().int().min(1).max(200) })
  .strict();
export type HintSettings = z.infer<typeof hintSettingsSchema>;
