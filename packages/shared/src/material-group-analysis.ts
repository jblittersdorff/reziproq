import { z } from 'zod';

// WG-07: Sieben Sichten der Analysen. Vier von innen (Schritt 3), drei auf die Lieferanten
// (Schritt 4). Das Team pflegt die Eingaben je Sicht; Umsatzwerte rechnet der Dienst aus dem Spend.

export const internalViews = ['volume', 'supply_chain', 'cost', 'technology'] as const;
export const supplierViews = ['revenue_finance', 'quality', 'footprint'] as const;
export const analysisViewKeys = [...internalViews, ...supplierViews] as const;
export type AnalysisViewKey = (typeof analysisViewKeys)[number];

export const analysisStepOf = (view: AnalysisViewKey) =>
  (internalViews as readonly string[]).includes(view) ? 3 : 4;
export const viewsOfStep = (step: number): readonly AnalysisViewKey[] =>
  step === 3 ? internalViews : step === 4 ? supplierViews : [];

/** Name der Sicht im Startbestand der Leitfragen (WG-startdaten) */
export const analysisViewQuestionKey: Record<AnalysisViewKey, string> = {
  volume: 'Volumen',
  supply_chain: 'Lieferkette',
  cost: 'Kosten',
  technology: 'Technologie',
  revenue_finance: 'Umsatz und Finanzen',
  quality: 'Qualität',
  footprint: 'Footprint',
};

const text = (max = 300) => z.string().trim().min(1).max(max);
const pct = z.number().min(0).max(100);
const year = z.number().int().min(2000).max(2100);
const country = z
  .string()
  .trim()
  .regex(/^[A-Z]{2}$/);

export const volumeDataSchema = z
  .object({
    minRequirements: z.array(text()).max(10).default([]),
    differentiators: z.array(text()).max(10).default([]),
    // Prognosen trägt das Team ein; Ist-Werte kommen aus dem Spend.
    forecast: z
      .array(
        z
          .object({
            businessUnitId: z.uuid().nullable(),
            year,
            amountCents: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(60)
      .default([]),
  })
  .strict();

export const supplyChainDataSchema = z
  .object({
    stages: z
      .array(
        z
          .object({ name: text(120), description: z.string().max(500), valueSharePct: pct })
          .strict(),
      )
      .max(10)
      .default([]),
    countries: z
      .array(z.object({ country, sharePct: pct }).strict())
      .max(5)
      .default([]),
  })
  .strict();

/**
 * Kostensicht als Index je Kostenart: eigene Seite, Soll-Kalkulation, Wettbewerb oder Markt.
 * Kartellrecht: Kosten lassen sich keinem einzelnen Lieferanten zuordnen; jedes weitere Feld,
 * auch ein Lieferant, wird abgelehnt.
 */
export const costDataSchema = z
  .object({
    costTypes: z
      .array(
        z
          .object({
            name: text(120),
            own: z.number().min(0).max(1000).nullable(),
            target: z.number().min(0).max(1000).nullable(),
            market: z.number().min(0).max(1000).nullable(),
          })
          .strict(),
      )
      .max(15)
      .default([]),
  })
  .strict();

export const technologyDataSchema = z
  .object({
    technologies: z
      .array(
        z
          .object({
            name: text(120),
            // Startdatum als Monat, z. B. 2027-08
            startsOn: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
            products: z.string().max(300),
            rampUp: z.array(z.object({ year, pct }).strict()).max(6).default([]),
          })
          .strict(),
      )
      .max(10)
      .default([]),
  })
  .strict();

export const stabilityRatings = ['ok', 'watch', 'critical'] as const;
export const qualityRatings = ['A', 'B', 'C'] as const;

export const revenueFinanceDataSchema = z
  .object({
    stability: z
      .array(z.object({ relationshipId: z.uuid(), rating: z.enum(stabilityRatings) }).strict())
      .max(200)
      .default([]),
    // Abweichung Vertrag zu Abruf in Prozent je Lieferant und Jahr
    callOff: z
      .array(
        z
          .object({ relationshipId: z.uuid(), year, deviationPct: z.number().min(-100).max(1000) })
          .strict(),
      )
      .max(200)
      .default([]),
  })
  .strict();

export const qualityDataSchema = z
  .object({
    ratings: z
      .array(z.object({ relationshipId: z.uuid(), rating: z.enum(qualityRatings) }).strict())
      .max(200)
      .default([]),
    defects: z
      .array(
        z
          .object({ relationshipId: z.uuid(), year, ppm: z.number().min(0).max(1_000_000) })
          .strict(),
      )
      .max(200)
      .default([]),
    audits: z
      .array(z.object({ site: text(120), result: text(120) }).strict())
      .max(50)
      .default([]),
  })
  .strict();

export const footprintDataSchema = z
  .object({
    // Umsatz nach Empfängerland: Anteile, die das Team einträgt
    recipients: z
      .array(z.object({ country, sharePct: pct }).strict())
      .max(10)
      .default([]),
  })
  .strict();

export const analysisDataSchemas = {
  volume: volumeDataSchema,
  supply_chain: supplyChainDataSchema,
  cost: costDataSchema,
  technology: technologyDataSchema,
  revenue_finance: revenueFinanceDataSchema,
  quality: qualityDataSchema,
  footprint: footprintDataSchema,
} as const;

export type AnalysisData = {
  [K in AnalysisViewKey]: z.infer<(typeof analysisDataSchemas)[K]>;
};

/**
 * Oberste Anteile: sortiert absteigend, bis mindestens `limit` des Ganzen erreicht ist, höchstens
 * `max` Einträge; der Rest als eine Summe (WG-07 Volumensicht: 80 %, höchstens zehn).
 */
export function topShares<T extends { amountCents: number }>(items: T[], limit = 0.8, max = 10) {
  const total = items.reduce((sum, item) => sum + item.amountCents, 0);
  const sorted = [...items].sort((a, b) => b.amountCents - a.amountCents);
  const top: (T & { share: number })[] = [];
  let covered = 0;
  for (const item of sorted) {
    if (top.length >= max || (total > 0 && covered / total >= limit)) break;
    top.push({ ...item, share: total > 0 ? item.amountCents / total : 0 });
    covered += item.amountCents;
  }
  const restCents = total - covered;
  return { top, restCents, restShare: total > 0 ? restCents / total : 0, total };
}

const named = z.object({ id: z.uuid(), name: z.string() });
const amountByYear = z.object({ year: z.number().int(), amountCents: z.number().int() });
const share = z.object({
  key: z.string(),
  name: z.string(),
  amountCents: z.number(),
  share: z.number(),
});

export const analysisComputedSchema = z.object({
  currency: z.string(),
  spendYear: z.number().int(),
  years: z.array(z.number().int()),
  // Volumen: oberste 80 % der Produktgruppen, höchstens zehn, Rest als „Weitere“
  productGroups: z.array(share),
  productGroupRestShare: z.number(),
  // Volumen: Ist je Business Unit und Jahr aus dem Spend
  byBusinessUnit: z.array(
    z.object({ businessUnit: named.nullable(), years: z.array(amountByYear) }),
  ),
  // Umsatz und Finanzen: Umsatz nach Segment Ist in der Warengruppe (WG-18)
  bySegment: z.array(share),
  // Anteil der fünf größten Lieferanten je Jahr
  topSuppliers: z.array(
    z.object({
      relationshipId: z.uuid(),
      name: z.string(),
      shares: z.array(z.object({ year: z.number().int(), share: z.number() })),
    }),
  ),
  byStability: z.array(share),
  byQualityRating: z.array(share),
  // Footprint: Umsatz nach Land des Lieferanten
  bySupplierCountry: z.array(share),
});

export const analysisViewSchema = z.object({
  view: z.enum(analysisViewKeys),
  state: z.enum(['open', 'in_progress', 'done']),
  data: z.record(z.string(), z.unknown()),
  updatedAt: z.string().nullable(),
});

export const candidateSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  site: z.string().nullable(),
  country: z.string().nullable(),
  revenueCents: z.number().int().nullable(),
  currency: z.string(),
  isSupplier: z.boolean(),
  comment: z.string().nullable(),
});

export const analysisStepSchema = z.object({
  step: z.number().int(),
  canEdit: z.boolean(),
  views: z.array(analysisViewSchema),
  computed: analysisComputedSchema,
  suppliers: z.array(z.object({ relationshipId: z.uuid(), name: z.string() })),
  businessUnits: z.array(named),
  candidates: z.array(candidateSchema),
  // Schritt 4: Bewertungsrunde der Warengruppe entschieden (WG-18)
  round: z.object({ exists: z.boolean(), decided: z.boolean() }),
});

export const saveAnalysisSchema = z.object({ data: z.unknown() });

export const candidateRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  site: z.string().trim().max(200).nullable(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable()
    .default(null),
  revenueCents: z.number().int().nonnegative().nullable(),
  currency: z.string().trim().length(3).default('EUR'),
  comment: z.string().trim().max(1000).nullable(),
});

export type AnalysisView = z.infer<typeof analysisViewSchema>;
export type AnalysisStep = z.infer<typeof analysisStepSchema>;
export type AnalysisComputed = z.infer<typeof analysisComputedSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type CandidateRequest = z.input<typeof candidateRequestSchema>;
