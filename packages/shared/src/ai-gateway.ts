import { z } from 'zod';
import { valueAssumptionSchema } from './opportunities.js';

// KI-01: Modell-Gateway, Einstellungen KI und Kontingent. Startwerte und Routing gelten im Code;
// die Organisation ändert nur die Einstellungen.

export const modelClassValues = ['small', 'standard', 'synthesis'] as const;
export type ModelClass = (typeof modelClassValues)[number];

/** Funktionen, die heute ein Modell aufrufen, mit ihrer Modellklasse (Routing-Tabelle). */
export const aiFeatureClasses = {
  prompt: 'standard',
  deviation_explanation: 'small',
  feedback_themes: 'small',
  plan_summary: 'standard',
  pre_read: 'standard',
  market_analysis: 'synthesis',
  // KI-11: Begründungen der Wertpotenziale
  value_opportunity: 'standard',
  // AW-01, NAV-10: Aussagen der Auswertungsseiten
  insight_summary: 'standard',
  // KI-16: Begründung eines Hinweises
  hint_explanation: 'small',
  // KI-17: Ergebnisse aus den Notizen nach einem Termin
  meeting_capture: 'standard',
  // KI-15: Spalten, Lieferanten und Warengruppen beim Import vorschlagen
  import_assist: 'small',
} as const satisfies Record<string, ModelClass>;
export type AiFeature = keyof typeof aiFeatureClasses;
export const aiFeatureValues = Object.keys(aiFeatureClasses) as AiFeature[];

/** Zugelassene öffentliche Quellen (Vorlage E-KI) */
export const aiSourceKindValues = [
  'industry_reports',
  'annual_reports',
  'commodity_indices',
  'official_gazettes',
  'trade_press',
] as const;

/** Wer eigene Agenten anlegen darf (KI-09) */
export const aiCustomAgentRoleValues = ['buyers_with_access', 'admins'] as const;

export const aiSettingsSchema = z.object({
  publicResearch: z.boolean(),
  sourceKinds: z.array(z.enum(aiSourceKindValues)).max(aiSourceKindValues.length),
  budgetMonthCents: z.number().int().min(0).max(100_000_000),
  budgetRunCents: z.number().int().min(1).max(1_000_000),
  maxSteps: z.number().int().min(1).max(500),
  customAgentRoles: z.enum(aiCustomAgentRoleValues),
  customAgentApproval: z.boolean(),
  agentBudgetOverrides: z
    .array(
      z.object({
        agentKey: z.string().trim().min(1).max(80),
        budgetRunCents: z.number().int().min(1).max(1_000_000),
      }),
    )
    .max(50),
  // KI-11: Segmente (Ist-Typ „Wirkung-Qualität“), für die der Wertpotenzial-Finder monatlich läuft
  valueFinderSegments: z.array(z.string().regex(/^[1-3]-[1-3]$/)).max(9),
  // KI-11: eigene Annahmen der Hebel-Vorlagen statt der Startwerte
  valueAssumptions: z.array(valueAssumptionSchema).max(20),
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;

/** Startwerte aus KI-01: Recherche aus, 150 € im Monat, 2,00 € je Lauf, 60 Schritte, Freigabe an. */
export const defaultAiSettings: AiSettings = {
  publicResearch: false,
  sourceKinds: [...aiSourceKindValues],
  budgetMonthCents: 15_000,
  budgetRunCents: 200,
  maxSteps: 60,
  customAgentRoles: 'buyers_with_access',
  customAgentApproval: true,
  agentBudgetOverrides: [],
  valueFinderSegments: [],
  valueAssumptions: [],
};

export const aiSettingsResponseSchema = z.object({
  settings: aiSettingsSchema,
  // Verarbeitung nur in der EU: immer an, nicht abschaltbar
  euOnly: z.literal(true),
  canEdit: z.boolean(),
  // Segmenttypen des aktiven Modells zur Auswahl für den monatlichen Lauf
  segmentTypes: z.array(z.object({ key: z.string(), name: z.string() })).optional(),
});
export type AiSettingsResponse = z.infer<typeof aiSettingsResponseSchema>;

/** Kontingent des Monats; die Aufteilung je Funktion sehen nur Admins. */
export const aiUsageSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  budgetMonthCents: z.number().int(),
  usedCents: z.number().int(),
  calls: z.number().int(),
  byFeature: z
    .array(z.object({ feature: z.string(), calls: z.number().int(), costCents: z.number().int() }))
    .nullable(),
});
export type AiUsage = z.infer<typeof aiUsageSchema>;

/** Mikrocent aus model_call in ganze Cent für die Anzeige; angefangene Cent zählen. */
export const centsFromMicrocents = (microcents: number) => Math.ceil(microcents / 1_000_000);
