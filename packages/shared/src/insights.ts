import { z } from 'zod';
import { allHintRuleKeys, hintDetailSchema, hintSeverities } from './hints.js';

// AW-01, NAV-10: Beleg der Auswertungsseiten aus bestehenden Daten. Aussagen von Reziproq,
// Chancen und Risiken kommen mit KI-04, KI-11 und KI-16.

/**
 * Aussage von Reziproq (AW-01): nur gezeigt, wenn jede Zahl darin in den Fakten der Seite steht;
 * sonst null und die Seite zeigt nur den Beleg. Je Person gespeichert (F3).
 */
export const insightStatementSchema = z.object({
  id: z.uuid(),
  headline: z.string(),
  body: z.string(),
  sources: z.array(z.object({ key: z.string(), label: z.string(), href: z.string().optional() })),
});
export type InsightStatement = z.infer<typeof insightStatementSchema>;

/** NAV-10: drei Sätze der Übersicht; ohne Kandidat fehlt der Satz */
export const overviewSentenceSchema = z.object({
  kind: z.enum(['good', 'stuck', 'todo']),
  text: z.string(),
  href: z.string(),
});

/** Übersicht: Ringpaar, Zeilenliste; nur vom Controlling bestätigte Ergebnisse zählen als gesichert. */
export const overviewInsightSchema = z.object({
  fiscalYear: z.number().int(),
  currency: z.string(),
  securedEbitCents: z.number().int(),
  goalEbitCents: z.number().int().nullable(),
  canSetGoal: z.boolean(),
  focusTotal: z.number().int(),
  focusWithApprovedJbp: z.number().int(),
  // EBIT der laufenden Initiativen im Geschäftsjahr: ab R3 als untere, alle als obere Grenze
  inProgress: z.object({ lowCents: z.number().int(), highCents: z.number().int() }),
  // Cash getrennt vom EBIT, nie addiert
  cashCents: z.number().int(),
  // NAV-10 1.1: Säulen „EBIT gesichert je Quartal“ des Geschäftsjahrs und der Zeitraum „Seit Start“
  quarters: z
    .array(
      z.object({
        quarter: z.number().int().min(1).max(4),
        securedCents: z.number().int(),
        state: z.enum(['past', 'current', 'future']),
      }),
    )
    .length(4)
    .optional(),
  sinceStartSecuredCents: z.number().int().optional(),
  statement: insightStatementSchema.nullable().optional(),
  sentences: z.array(overviewSentenceSchema).max(3).optional(),
});

/** Lieferant: außen gesichert gegen freigegebenes Ziel, innen Zusagen rechtzeitig eingehalten. */
export const supplierRingsSchema = z.object({
  fiscalYear: z.number().int(),
  currency: z.string(),
  securedEbitCents: z.number().int(),
  target: z
    .object({
      ebitTargetCents: z.number().int(),
      approved: z.boolean(),
      proposedBy: z.string(),
    })
    .nullable(),
  commitments: z.object({ due: z.number().int(), keptOnTime: z.number().int() }),
  canPropose: z.boolean(),
  canApprove: z.boolean(),
  // AW-01: Größte Chance, das offene Wertpotenzial (KI-11) mit der höchsten unteren Spanne,
  // Sicherheit hoch oder mittel; ohne Kandidat null und die Karte fehlt
  chance: z
    .object({
      opportunityId: z.uuid(),
      templateKey: z.string(),
      impactType: z.enum(['ebit', 'cash', 'cost_avoidance']),
      low: z.number().int(),
      high: z.number().int(),
      confidence: z.enum(['high', 'medium']),
    })
    .nullable()
    .optional(),
  // AW-01, KI-16: Größtes Risiko, der offene Hinweis mit dem höchsten score der Beziehung; ohne
  // Kandidat null und die Karte fehlt. Nur für Personen, die Hinweise dieser Beziehung sehen.
  risk: z
    .object({
      hintId: z.uuid(),
      ruleKey: z.enum(allHintRuleKeys),
      detail: hintDetailSchema,
      severity: z.enum(hintSeverities),
    })
    .nullable()
    .optional(),
  statement: insightStatementSchema.nullable().optional(),
});

/**
 * AW-01 Ergebnisse · Gesichert: Brücke nur aus vom Controlling bestätigten EBIT-Werten im
 * Geschäftsjahr; ihre Summe ist „Gesichert“. Unbestätigte Ist-Monate stehen in der Tinte-Karte,
 * andere Wirkungsarten als eigene Zeile, nie addiert.
 */
export const securedResultsSchema = z.object({
  fiscalYear: z.number().int(),
  fiscalYears: z.array(z.number().int()),
  currency: z.string(),
  steps: z.array(
    z.object({
      initiativeId: z.uuid(),
      title: z.string(),
      maturity: z.number().int(),
      securedCents: z.number().int(),
    }),
  ),
  securedEbitCents: z.number().int(),
  target: z.object({ ebitTargetCents: z.number().int(), approved: z.boolean() }).nullable(),
  /** Ist-Monate im Geschäftsjahr ohne Freigabe durch das Controlling */
  pending: z.object({
    months: z.number().int(),
    initiatives: z.number().int(),
    amountCents: z.number().int(),
  }),
  others: z.array(
    z.object({
      effectType: z.enum(['cash', 'cost_avoidance', 'strategic']),
      securedCents: z.number().int(),
    }),
  ),
  statement: insightStatementSchema.nullable(),
});
export type SecuredResults = z.infer<typeof securedResultsSchema>;

export const ebitGoalRequestSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  amountCents: z.number().int().positive().nullable(),
});

export const supplierTargetRequestSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  amountCents: z.number().int().positive(),
});

/**
 * Fortschritt von der Basis zum Ziel (AW-01): (zuletzt − Basis) ÷ (Ziel − Basis), begrenzt auf 0 bis
 * 1. Gilt auch, wenn weniger besser ist (Ziel unter Basis). Ohne Wert oder bei Ziel gleich Basis
 * null: dann zeigt die Seite „noch kein Wert“ bzw. den Stand als Text (offen in F3).
 */
export function progressFromBaseline(
  baseline: number | null,
  target: number | null,
  latest: number | null,
): number | null {
  if (baseline === null || target === null || latest === null) return null;
  if (target === baseline) return null;
  const share = (latest - baseline) / (target - baseline);
  return Math.max(0, Math.min(1, share));
}

export type OverviewInsight = z.infer<typeof overviewInsightSchema>;
export type SupplierRings = z.infer<typeof supplierRingsSchema>;
export type EbitGoalRequest = z.infer<typeof ebitGoalRequestSchema>;
export type SupplierTargetRequest = z.infer<typeof supplierTargetRequestSchema>;
