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

/** KI-16: Regeln der Frühwarnung, zusätzlich zu FS-01 */
export const earlyWarningRuleKeys = [
  'performance_drop',
  'supplier_commitment_overdue',
  'dependency',
  'feedback_drop',
  'public_event',
] as const;
export type EarlyWarningRuleKey = (typeof earlyWarningRuleKeys)[number];
export const allHintRuleKeys = [...hintRuleKeys, ...earlyWarningRuleKeys] as const;
export type AnyHintRuleKey = (typeof allHintRuleKeys)[number];
export const hintSeverities = ['high', 'medium', 'low'] as const;
export type HintSeverity = (typeof hintSeverities)[number];

/** KI-16: Startschwellen je Regel; der Admin ändert sie in den Einstellungen KI. */
export const defaultHintThresholds = {
  performance_drop: { months: 3 },
  supplier_commitment_overdue: { days: 14, highDays: 45 },
  dependency: { share: 0.6 },
  feedback_drop: { drop: 0.1 },
  public_event: { days: 30 },
} as const;

/** Beleg eines Hinweises der Frühwarnung: Kennzahl, Werte, Schwelle, Zeitraum, Verweise */
export const hintEvidenceSchema = z
  .object({
    metric: z.string().optional(),
    unit: z.string().optional(),
    values: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    threshold: z.string().optional(),
    period: z.string().optional(),
    refs: z
      .array(z.object({ objectType: z.string(), objectId: z.string(), title: z.string() }))
      .optional(),
    sources: z
      .array(z.object({ title: z.string(), url: z.string(), publishedOn: z.string() }))
      .optional(),
  })
  .passthrough();
export type HintEvidence = z.infer<typeof hintEvidenceSchema>;

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
  ruleKey: z.enum(allHintRuleKeys),
  relationshipId: z.uuid().nullable(),
  supplier: z.string().nullable(),
  detail: hintDetailSchema,
  status: z.enum(['open', 'in_progress', 'accepted', 'dismissed', 'resolved']),
  // KI-16
  severity: z.enum(hintSeverities),
  score: z.number().int(),
  title: z.string().nullable(),
  evidence: hintEvidenceSchema,
  explanation: z.string().nullable(),
  suggestedAction: z.string().nullable(),
  feedback: z.enum(['helpful', 'not_helpful']).nullable(),
  lastSeenAt: z.iso.datetime({ offset: true }),
  resolvedReason: z.string().nullable(),
  isFocus: z.boolean(),
  /** Im Team der Beziehung (bzw. bei Hinweisen ohne Beziehung selbst gemeint): für Mein Tag */
  isOwn: z.boolean(),
  /** Warengruppe für den Filter: bei Abhängigkeit die betroffene, sonst die Hauptwarengruppe */
  materialGroup: z.string().nullable(),
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

export const hintFeedbackSchema = z.object({ helpful: z.boolean() }).strict();

/** KI-16: Einstellungen der Frühwarnung je Organisation */
export const hintRuleSettingsSchema = z.object({
  rules: z.record(z.string(), z.boolean()),
  thresholds: z.record(z.string(), z.record(z.string(), z.number())),
  /** Bewertungen je Regel: hilfreich und nicht hilfreich */
  ratings: z.array(
    z.object({
      ruleKey: z.enum(allHintRuleKeys),
      helpful: z.number().int(),
      notHelpful: z.number().int(),
    }),
  ),
});
export type HintRuleSettings = z.infer<typeof hintRuleSettingsSchema>;
export const saveHintRuleSettingsSchema = hintRuleSettingsSchema.omit({ ratings: true }).strict();
