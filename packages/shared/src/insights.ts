import { z } from 'zod';

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
  statement: insightStatementSchema.nullable().optional(),
});

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
