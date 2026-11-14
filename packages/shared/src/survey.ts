import { z } from 'zod';

// PUL-01: Fragebogen für Puls und Jahres-Feedback. Beide Seiten beantworten dieselben Fragen mit
// Ist und Soll auf einer Skala von 1 bis 5, dazu „Kann ich nicht beurteilen“.

export const surveyKinds = ['pulse', 'annual'] as const;
export type SurveyKind = (typeof surveyKinds)[number];

export const surveyDimensions = [
  'trust',
  'collaboration',
  'integration',
  'transparency',
  'strategy',
] as const;
export type SurveyDimension = (typeof surveyDimensions)[number];

/** Skala für Ist und Soll; null heißt „Kann ich nicht beurteilen“ (PUL-02). */
export const surveyScale = [1, 2, 3, 4, 5] as const;

export const surveyQuestionSchema = z.object({
  /** Bleibt über alle Versionen gleich, damit die Auswertung (PUL-03) Fragen vergleichen kann */
  key: z.string(),
  dimension: z.enum(surveyDimensions),
  textDe: z.string(),
  textEn: z.string(),
  active: z.boolean(),
  /** Von der Organisation ergänzt, nicht aus dem Standard */
  custom: z.boolean(),
});
export type SurveyQuestion = z.infer<typeof surveyQuestionSchema>;

type DefaultQuestion = Omit<SurveyQuestion, 'active' | 'custom'>;

const question = (
  key: string,
  dimension: SurveyDimension,
  textDe: string,
  textEn: string,
): DefaultQuestion => ({ key, dimension, textDe, textEn });

/** Standard von Reziproq; jede Käuferorganisation beginnt mit Version 1 daraus. */
export const defaultSurveyQuestions: Record<SurveyKind, DefaultQuestion[]> = {
  pulse: [
    question(
      'pulse_satisfaction',
      'collaboration',
      'Wie zufrieden bin ich insgesamt mit der Zusammenarbeit?',
      'How satisfied am I with the collaboration overall?',
    ),
    question(
      'pulse_trust',
      'trust',
      'Wie sehr vertrauen wir einander?',
      'How much do we trust each other?',
    ),
    question(
      'pulse_alignment',
      'strategy',
      'Wie gut sind wir auf gemeinsame Ziele ausgerichtet?',
      'How well are we aligned on shared goals?',
    ),
  ],
  annual: [
    question('trust_1', 'trust', 'Zusagen werden eingehalten.', 'Commitments are kept.'),
    question(
      'trust_2',
      'trust',
      'Informationen werden nicht gegen uns verwendet.',
      'Information is not used against us.',
    ),
    question(
      'trust_3',
      'trust',
      'Bei Problemen suchen wir gemeinsam eine Lösung.',
      'When problems arise, we look for a solution together.',
    ),
    question(
      'trust_4',
      'trust',
      'Wir können offen über Schwierigkeiten sprechen.',
      'We can talk openly about difficulties.',
    ),
    question(
      'trust_5',
      'trust',
      'Die andere Seite handelt auch in schwierigen Phasen fair.',
      'The other side acts fairly, even in difficult times.',
    ),
    question(
      'collaboration_1',
      'collaboration',
      'Ansprechpartner sind klar und erreichbar.',
      'Contacts are clear and reachable.',
    ),
    question(
      'collaboration_2',
      'collaboration',
      'Entscheidungen fallen schnell genug.',
      'Decisions are made quickly enough.',
    ),
    question(
      'collaboration_3',
      'collaboration',
      'Abläufe zwischen uns sind einfach.',
      'Processes between us are simple.',
    ),
    question(
      'collaboration_4',
      'collaboration',
      'Konflikte werden sachlich gelöst.',
      'Conflicts are resolved objectively.',
    ),
    question(
      'collaboration_5',
      'collaboration',
      'Die Zusammenarbeit funktioniert über alle Funktionen hinweg.',
      'Collaboration works across all functions.',
    ),
    question(
      'integration_1',
      'integration',
      'Wir werden früh in Planungen einbezogen.',
      'We are involved in planning early on.',
    ),
    question(
      'integration_2',
      'integration',
      'Entwicklungsteams arbeiten eng zusammen.',
      'Development teams work closely together.',
    ),
    question(
      'integration_3',
      'integration',
      'Planungs- und Bedarfsdaten werden regelmäßig abgestimmt.',
      'Planning and demand data are aligned regularly.',
    ),
    question(
      'integration_4',
      'integration',
      'Systeme und Daten sind sinnvoll verbunden.',
      'Systems and data are connected in a useful way.',
    ),
    question(
      'integration_5',
      'integration',
      'Verbesserungen werden gemeinsam umgesetzt.',
      'Improvements are implemented together.',
    ),
    question(
      'transparency_1',
      'transparency',
      'Wir kennen die mittelfristigen Pläne der anderen Seite.',
      "We know the other side's medium-term plans.",
    ),
    question(
      'transparency_2',
      'transparency',
      'Bedarfs- und Kapazitätsinformationen sind verlässlich.',
      'Demand and capacity information is reliable.',
    ),
    question(
      'transparency_3',
      'transparency',
      'Kostentreiber werden offen besprochen.',
      'Cost drivers are discussed openly.',
    ),
    question(
      'transparency_4',
      'transparency',
      'Risiken werden früh angesprochen.',
      'Risks are raised early.',
    ),
    question(
      'transparency_5',
      'transparency',
      'Rückmeldungen auf Vorschläge kommen zuverlässig.',
      'Responses to proposals arrive reliably.',
    ),
    question(
      'strategy_1',
      'strategy',
      'Wir verfolgen gemeinsame langfristige Ziele.',
      'We pursue shared long-term goals.',
    ),
    question(
      'strategy_2',
      'strategy',
      'Die Geschäftsleitungen tauschen sich regelmäßig aus.',
      'Senior management on both sides talks regularly.',
    ),
    question(
      'strategy_3',
      'strategy',
      'Innovationen werden gemeinsam vorangetrieben.',
      'Innovation is driven forward together.',
    ),
    question(
      'strategy_4',
      'strategy',
      'Beide Seiten investieren in die Beziehung.',
      'Both sides invest in the relationship.',
    ),
    question(
      'strategy_5',
      'strategy',
      'Die Beziehung schafft messbaren Wert für beide.',
      'The relationship creates measurable value for both.',
    ),
  ],
};

export const surveyVersionSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  createdAt: z.string(),
  /** null für Version 1 aus dem Standard */
  createdByName: z.string().nullable(),
  note: z.string().nullable(),
});
export type SurveyVersion = z.infer<typeof surveyVersionSchema>;

export const surveyTemplateSchema = surveyVersionSchema.extend({
  kind: z.enum(surveyKinds),
  questions: z.array(surveyQuestionSchema),
});
export type SurveyTemplate = z.infer<typeof surveyTemplateSchema>;

export const surveysSchema = z.object({
  templates: z.array(
    surveyVersionSchema.extend({
      kind: z.enum(surveyKinds),
      active: z.number().int(),
      total: z.number().int(),
    }),
  ),
  canManage: z.boolean(),
});
export type Surveys = z.infer<typeof surveysSchema>;

export const surveyDetailSchema = z.object({
  template: surveyTemplateSchema,
  versions: z.array(surveyVersionSchema),
  canManage: z.boolean(),
});
export type SurveyDetail = z.infer<typeof surveyDetailSchema>;

const questionText = z.string().trim().max(300);

/** Anlegen oder ändern; aktiv nur mit Text in beiden Sprachen. */
export const saveSurveyQuestionSchema = z
  .object({
    dimension: z.enum(surveyDimensions),
    textDe: questionText,
    textEn: questionText,
    active: z.boolean(),
  })
  .strict()
  .refine((value) => value.textDe.length > 0 || value.textEn.length > 0, {
    path: ['textDe'],
    message: 'text_fehlt',
  })
  .refine((value) => !value.active || (value.textDe.length > 0 && value.textEn.length > 0), {
    path: ['active'],
    message: 'beide_sprachen',
  });
export type SaveSurveyQuestion = z.infer<typeof saveSurveyQuestionSchema>;

// PUL-02a: Feedback-Welle anlegen und einladen.

/** Funktion der teilnehmenden Person; die Auswertung (PUL-03) gruppiert danach. */
export const surveyFunctions = [
  'purchasing',
  'quality',
  'engineering',
  'logistics',
  'programs',
  'after_sales',
  'sales',
  'management',
  'other',
] as const;
export type SurveyFunction = (typeof surveyFunctions)[number];

export const surveySides = ['buyer', 'supplier'] as const;
export type SurveySide = (typeof surveySides)[number];

const turnoutSchema = z.object({ invited: z.number().int(), completed: z.number().int() });

export const surveyWaveSchema = z.object({
  id: z.uuid(),
  kind: z.enum(surveyKinds),
  templateVersion: z.number().int(),
  dueDate: z.iso.date(),
  createdAt: z.string(),
  createdByName: z.string(),
  buyerClosedAt: z.string().nullable(),
  supplierClosedAt: z.string().nullable(),
  /** open bis zur Frist, solange nicht beide Seiten abgeschlossen haben */
  status: z.enum(['open', 'closed']),
  /** Nur Anzahlen je Seite, nie Personen */
  turnout: z.object({ buyer: turnoutSchema, supplier: turnoutSchema }),
  /** PUL-03: gesetzt, sobald die Ergebnisse für beide Seiten sichtbar sind */
  revealedAt: z.string().nullable(),
  /** PUL-03: größte Lücke (Ist Käufer − Ist Lieferant), erst nach der Aufdeckung */
  topGap: z.object({ dimension: z.enum(surveyDimensions), delta: z.number() }).nullable(),
});
export type SurveyWave = z.infer<typeof surveyWaveSchema>;

export const surveyWavesSchema = z.object({
  waves: z.array(surveyWaveSchema),
  canStart: z.boolean(),
});
export type SurveyWaves = z.infer<typeof surveyWavesSchema>;

export const surveyParticipantSchema = z.object({
  id: z.uuid(),
  side: z.enum(surveySides),
  email: z.string(),
  name: z.string().nullable(),
  function: z.enum(surveyFunctions),
  invitedAt: z.string(),
});
export type SurveyParticipant = z.infer<typeof surveyParticipantSchema>;

export const surveySuggestionSchema = z.object({
  side: z.enum(surveySides),
  name: z.string(),
  email: z.string(),
  function: z.enum(surveyFunctions).nullable(),
  source: z.enum(['team', 'contact', 'colleague']),
});
export type SurveySuggestion = z.infer<typeof surveySuggestionSchema>;

export const surveyWaveDetailSchema = z.object({
  wave: surveyWaveSchema,
  ownSide: z.enum(surveySides),
  /** Nur die Einladungen der eigenen Seite, ohne Angabe, wer geantwortet hat */
  participants: z.array(surveyParticipantSchema),
  canInvite: z.boolean(),
  canClose: z.boolean(),
  canExtend: z.boolean(),
  /** PUL-03: null bis zur Aufdeckung, für beide Seiten dieselben Zahlen */
  results: z.lazy(() => surveyResultsSchema.nullable()),
});
export type SurveyWaveDetail = z.infer<typeof surveyWaveDetailSchema>;

/** Vorschläge für den Ablauf „Neue Welle“ und „Einladen“: Team, Kontakte, Kolleginnen. */
export const surveySuggestionsSchema = z.object({
  suggestions: z.array(surveySuggestionSchema),
  templates: z.array(
    z.object({ kind: z.enum(surveyKinds), version: z.number().int(), questions: z.number().int() }),
  ),
});
export type SurveySuggestions = z.infer<typeof surveySuggestionsSchema>;

const participantInput = z
  .object({
    email: z.email().trim().toLowerCase().max(254),
    name: z.string().trim().max(120).nullable(),
    function: z.enum(surveyFunctions),
  })
  .strict();

const sidedParticipant = participantInput.extend({ side: z.enum(surveySides) }).strict();

export const startSurveyWaveSchema = z
  .object({
    kind: z.enum(surveyKinds),
    dueDate: z.iso.date(),
    participants: z.array(sidedParticipant).min(1).max(200),
  })
  .strict();
export type StartSurveyWave = z.infer<typeof startSurveyWaveSchema>;

/** Weitere Teilnehmende einladen; der Lieferant nur auf seiner Seite. */
export const inviteSurveyParticipantsSchema = z
  .object({ participants: z.array(sidedParticipant).min(1).max(200) })
  .strict();
export type InviteSurveyParticipants = z.infer<typeof inviteSurveyParticipantsSchema>;

export const extendSurveyWaveSchema = z.object({ dueDate: z.iso.date() }).strict();
export type ExtendSurveyWave = z.infer<typeof extendSurveyWaveSchema>;

// PUL-02b: Beantworten über den persönlichen Link, ohne Anmeldung.

export const surveyTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,100}$/);

export const publicSurveySchema = z.object({
  /** open: beantwortbar; used: schon abgesendet; expired: Frist vorbei oder Seite abgeschlossen */
  status: z.enum(['open', 'used', 'expired']),
  kind: z.enum(surveyKinds),
  dueDate: z.iso.date(),
  side: z.enum(surveySides),
  buyer: z.string(),
  supplier: z.string(),
  /** Nur aktive Fragen der Version der Welle; leer, wenn nicht offen */
  questions: z.array(surveyQuestionSchema),
});
export type PublicSurvey = z.infer<typeof publicSurveySchema>;

const scaleValue = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const surveyAnswerSchema = z
  .object({ current: scaleValue.nullable(), target: scaleValue.nullable() })
  .strict();

export const submitSurveySchema = z
  .object({
    answers: z.record(z.string().max(60), surveyAnswerSchema),
    comment: z.string().trim().max(2000).nullable(),
  })
  .strict();
export type SubmitSurvey = z.infer<typeof submitSurveySchema>;

// PUL-03: Auswertung und Wahrnehmungslücken.

/** Mindestgröße einer Gruppe (Seite, Funktion), damit niemand zugeordnet werden kann. */
export const surveyMinGroup = 3;

const meanPairSchema = z.object({ ist: z.number().nullable(), soll: z.number().nullable() });
export type SurveyMeanPair = z.infer<typeof meanPairSchema>;

export const surveyDimensionResultSchema = z.object({
  dimension: z.enum(surveyDimensions),
  buyer: meanPairSchema,
  supplier: meanPairSchema,
  /** Ist Käufer − Ist Lieferant; null, wenn eine Seite nur „Kann ich nicht beurteilen“ hat */
  delta: z.number().nullable(),
});
export type SurveyDimensionResult = z.infer<typeof surveyDimensionResultSchema>;

export const surveyResultsSchema = z.object({
  revealedAt: z.string(),
  responses: z.object({ buyer: z.number().int(), supplier: z.number().int() }),
  /** Sortiert nach der größten Lücke (Betrag) */
  dimensions: z.array(surveyDimensionResultSchema),
  topGaps: z.array(surveyDimensionResultSchema).max(3),
  /** Nur Gruppen ab drei Antworten; eine Seite fehlt, wenn sie die Funktion nicht hat */
  functions: z.array(
    z.object({
      function: z.enum(surveyFunctions),
      buyer: z
        .object({ n: z.number().int(), dimensions: z.array(surveyDimensionResultSchema) })
        .nullable(),
      supplier: z
        .object({ n: z.number().int(), dimensions: z.array(surveyDimensionResultSchema) })
        .nullable(),
      dimensions: z.array(surveyDimensionResultSchema),
    }),
  ),
  questions: z.array(
    z.object({
      key: z.string(),
      dimension: z.enum(surveyDimensions),
      labelDe: z.string(),
      labelEn: z.string(),
      buyer: meanPairSchema,
      supplier: meanPairSchema,
      delta: z.number().nullable(),
    }),
  ),
  /** Freitexte der jeweils anderen Seite, ohne Funktion, in zufälliger Reihenfolge */
  freeTexts: z.array(z.string()),
});
export type SurveyResults = z.infer<typeof surveyResultsSchema>;

/** Lücke je Dimension: Ist Käufer − Ist Lieferant, auf zwei Stellen. */
export function surveyGap(buyer: number | null, supplier: number | null): number | null {
  if (buyer === null || supplier === null) return null;
  return Math.round((buyer - supplier) * 100) / 100;
}

/** Nach dem Betrag der Lücke absteigend; Dimensionen ohne Lücke ans Ende. */
export function sortByGap<T extends { delta: number | null }>(items: T[]): T[] {
  const size = (delta: number | null) => (delta === null ? -1 : Math.abs(delta));
  return [...items].sort((a, b) => size(b.delta) - size(a.delta));
}
