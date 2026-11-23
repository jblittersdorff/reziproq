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

/** KI-08: Schritte des Laufs der Marktanalyse */
export const marketRunStepKeys = [
  'plan',
  'own_data',
  'public_sources',
  'forces',
  'check',
  'implications',
  'drafts',
] as const;

/**
 * KI-08: Protokoll des letzten Laufs. Eigene Daten ohne Kostensicht; „Was nach außen ging“ sind nur
 * die gesendeten Suchanfragen. Verworfene Quellen und Aussagen stehen mit Grund im Protokoll.
 */
export const marketRunSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  createdAt: z.string(),
  startedBy: z.string().nullable(),
  publicResearch: z.boolean(),
  steps: z.array(
    z.object({ key: z.enum(marketRunStepKeys), status: z.enum(['running', 'done', 'failed']) }),
  ),
  ownSources: z.array(z.string()),
  publicSources: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      publisher: z.string(),
      publishedOn: z.string(),
    }),
  ),
  discardedSources: z.array(
    z.object({ title: z.string(), reason: z.enum(['too_old', 'undated']) }),
  ),
  outbound: z.array(z.object({ text: z.string(), sentAt: z.string() })),
  /** Suchanfragen, die der Filter nicht gesendet hat (Zahlen aus eigenen Daten) */
  blockedQueries: z.number().int(),
  discardedPoints: z.array(
    z.object({ text: z.string(), reason: z.enum(['no_source', 'not_supported']) }),
  ),
  created: z.object({
    forces: z.number().int(),
    opportunities: z.number().int(),
    threats: z.number().int(),
    levers: z.number().int(),
  }),
});
export type MarketRun = z.infer<typeof marketRunSchema>;

export const marketAnalysisSchema = z.object({
  canEdit: z.boolean(),
  forces: z.array(marketForceSchema),
  confirmedCount: z.number().int(),
  researchedAt: z.string().nullable(),
  sourceCount: z.number().int(),
  // Ohne öffentliche Recherche arbeitet Reziproq nur mit eigenen Daten (WG-23).
  publicResearch: z.boolean(),
  synthesisDraft: z.object({ id: z.uuid(), text: z.string() }).nullable(),
  /** KI-08: letzter Lauf der Marktanalyse mit Protokoll */
  run: marketRunSchema.nullable().default(null),
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

/** KI-08: Implikationen des Modells: Chancen und Risiken mit Quellen und Hebelvorschlag */
export const marketImplicationsOutputSchema = z.object({
  items: z
    .array(
      z.object({
        type: z.enum(['opportunity', 'threat']),
        text: z.string().min(1),
        sources: z.array(z.string()),
        lever: z.string().nullable().default(null),
      }),
    )
    .max(8),
});

export type MarketForce = z.infer<typeof marketForceSchema>;
export type MarketAnalysis = z.infer<typeof marketAnalysisSchema>;
export type SaveMarketForce = z.infer<typeof saveMarketForceSchema>;
