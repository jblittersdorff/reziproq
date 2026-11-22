import { z } from 'zod';

// WG-09: Sechs Marktkräfte, heute und in 3 bis 5 Jahren. Reziproq entwirft mit Quellen, eine
// Person bestätigt jede Kraft einzeln. Ohne KI füllt das Team die Karten von Hand aus.

export const marketForceKeys = [
  'supplier_power',
  'customer_power',
  'new_entrants',
  'substitutes',
  'external_factors',
  'rivalry',
] as const;
export type MarketForceKey = (typeof marketForceKeys)[number];

/** Name der Kraft im Startbestand der Leitfragen (WG-startdaten) */
export const marketForceQuestionKey: Record<MarketForceKey, string> = {
  supplier_power: 'Verhandlungsmacht der Lieferanten',
  customer_power: 'Verhandlungsmacht der Endkunden',
  new_entrants: 'Bedrohung durch neue Konkurrenz',
  substitutes: 'Bedrohung durch Ersatzprodukte',
  external_factors: 'Abhängigkeit von externen Faktoren',
  rivalry: 'Wettbewerb im Markt',
};
export const marketSynthesisQuestionKey = 'Zusammenschau';

const level = z.enum(['low', 'high']);

export const aiSourceSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['own_data', 'public']),
  title: z.string(),
  url: z.string().nullable(),
  publishedAt: z.string().nullable(),
});

export const marketPointSchema = z.object({
  text: z.string(),
  sources: z.array(aiSourceSchema),
});

const assessmentSchema = z.object({
  today: level.nullable(),
  future: level.nullable(),
  relevant: z.boolean().nullable(),
  points: z.array(marketPointSchema),
});

export const marketForceSchema = assessmentSchema.extend({
  force: z.enum(marketForceKeys),
  status: z.enum(['draft', 'confirmed']),
  confirmedBy: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  // Neuer Entwurf neben dem bestätigten Stand (Neu recherchieren); ersetzt nichts von selbst
  proposal: assessmentSchema.nullable(),
});

export const marketAnalysisSchema = z.object({
  canEdit: z.boolean(),
  forces: z.array(marketForceSchema),
  confirmedCount: z.number().int(),
  researchedAt: z.string().nullable(),
  sourceCount: z.number().int(),
  // Ohne öffentliche Recherche arbeitet Reziproq nur mit eigenen Daten (WG-23).
  publicResearch: z.boolean(),
  synthesisDraft: z.object({ id: z.uuid(), text: z.string() }).nullable(),
});

/** Von Hand ausfüllen oder anpassen: zwei bis drei Begründungspunkte, ohne Quelle erlaubt */
export const saveMarketForceSchema = z.object({
  today: level,
  future: level,
  relevant: z.boolean(),
  points: z.array(z.string().trim().min(1).max(400)).min(1).max(5),
});

/** Antwort des Modells; Quellen als Kürzel der übergebenen Liste (Q1, Q2 …) */
export const marketDraftOutputSchema = z.object({
  forces: z.array(
    z.object({
      force: z.enum(marketForceKeys),
      today: level,
      future: level,
      relevant: z.boolean(),
      points: z.array(z.object({ text: z.string().min(1), sources: z.array(z.string()) })),
    }),
  ),
  synthesis: z.string().default(''),
});

export type MarketForce = z.infer<typeof marketForceSchema>;
export type MarketAnalysis = z.infer<typeof marketAnalysisSchema>;
export type SaveMarketForce = z.infer<typeof saveMarketForceSchema>;
