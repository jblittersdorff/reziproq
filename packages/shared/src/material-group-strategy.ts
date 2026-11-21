import { z } from 'zod';

// WG-04, WG-06: Warengruppenstrategie je Jahr in zehn Schritten, mit Leitfragen, „Beobachtung
// und Erklärung“, Meilensteinen, Kennzahlen und Zielen. Der Stand je Schritt ergibt sich aus den
// Daten; es gibt kein Feld dafür.

export const strategySteps = [
  { step: 1, key: 'setup', name: 'Aufsetzen', nameEn: 'Set up' },
  { step: 2, key: 'goals', name: 'Ziele', nameEn: 'Goals' },
  { step: 3, key: 'internal', name: 'Interne Analyse', nameEn: 'Internal analysis' },
  { step: 4, key: 'suppliers', name: 'Lieferantenanalyse', nameEn: 'Supplier analysis' },
  { step: 5, key: 'market', name: 'Marktanalyse', nameEn: 'Market analysis' },
  { step: 6, key: 'assessment', name: 'Bewertung', nameEn: 'Assessment' },
  { step: 7, key: 'scorecard', name: 'Scorecard', nameEn: 'Scorecard' },
  { step: 8, key: 'awards', name: 'Vergaben', nameEn: 'Awards' },
  { step: 9, key: 'supplier_map', name: 'Supplier Map', nameEn: 'Supplier map' },
  { step: 10, key: 'approval', name: 'Freigabe', nameEn: 'Approval' },
] as const;
export const strategyStepCount = strategySteps.length;
export type StrategyStepNumber = (typeof strategySteps)[number]['step'];

export const strategyStatuses = ['draft', 'resubmit', 'approved'] as const;
export type StrategyStatus = (typeof strategyStatuses)[number];

export const stepStates = ['open', 'in_progress', 'done'] as const;
export type StepState = (typeof stepStates)[number];

/** WG-06: die fünf Zieldimensionen; Schlüssel der bestehenden Zielkategorien (SPL-01) */
export const goalDimensions = [
  'supply',
  'quality',
  'cost',
  'technology',
  'sustainability',
] as const;
export type GoalDimension = (typeof goalDimensions)[number];

/** Rolle der Person in der Warengruppe; bestimmt, was sie in der Strategie darf */
export const strategyRoles = [
  'lead',
  'commodity_manager',
  'buyer',
  'function',
  'admin',
  'reader',
] as const;
export type StrategyRole = (typeof strategyRoles)[number];

const person = z.object({ userId: z.string(), name: z.string() });
const money = z.object({
  amountCents: z.number().int(),
  currency: z.string(),
  year: z.number().int(),
});

export const strategySummarySchema = z.object({
  id: z.uuid(),
  year: z.number().int(),
  status: z.enum(strategyStatuses),
  version: z.number().int(),
  steps: z.array(z.enum(stepStates)).length(strategyStepCount),
});
export type StrategySummary = z.infer<typeof strategySummarySchema>;

/** GET /api/warengruppen/strategien: Übersicht der Strategien eines Jahres */
export const strategyOverviewSchema = z.object({
  year: z.number().int(),
  /** Die eine nächste Aufgabe der Person über alle Warengruppen */
  next: z
    .object({
      materialGroupId: z.uuid(),
      name: z.string(),
      step: z.number().int().nullable(),
      /** null: Strategie anlegen */
      strategyId: z.uuid().nullable(),
    })
    .nullable(),
  groups: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      code: z.string(),
      lead: person.nullable(),
      spend: money.nullable(),
      supplierCount: z.number().int(),
      /** null: noch keine Strategie für das Jahr; nur sichtbare Strategien */
      strategy: strategySummarySchema.nullable(),
      /** Strategie existiert, ist aber ein Entwurf außerhalb des eigenen Teams */
      hidden: z.boolean(),
      canCreate: z.boolean(),
    }),
  ),
  approvedCount: z.number().int(),
});
export type StrategyOverview = z.infer<typeof strategyOverviewSchema>;

/** Kopf jeder Strategie-Seite: Warengruppen-Leiste und Ablauf-Leiste */
export const strategyContextSchema = z.object({
  group: z.object({
    id: z.uuid(),
    name: z.string(),
    code: z.string(),
    lead: person.nullable(),
    spend: money.nullable(),
    supplierCount: z.number().int(),
  }),
  strategy: strategySummarySchema,
  role: z.enum(strategyRoles),
  /** Schritte, die die Person bearbeiten darf */
  editableSteps: z.array(z.number().int()),
});
export type StrategyContext = z.infer<typeof strategyContextSchema>;

export const strategyNoteSchema = z.object({
  view: z.string(),
  text: z.string(),
  notApplicable: z.boolean(),
  updatedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type StrategyNote = z.infer<typeof strategyNoteSchema>;

export const strategyMilestoneSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  dueOn: z.iso.date(),
});

export const materialGroupKpiSchema = z.object({
  id: z.uuid(),
  dimension: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  unit: z.string().nullable(),
  source: z.string().nullable(),
  active: z.boolean(),
});
export type MaterialGroupKpi = z.infer<typeof materialGroupKpiSchema>;

const decimal = z.number().finite().nullable();

export const strategyGoalSchema = z.object({
  id: z.uuid(),
  kpiId: z.uuid(),
  dimension: z.string(),
  text: z.string(),
  actual: decimal,
  targetNextYear: decimal,
  targetFinal: decimal,
  targetQuarter: z.number().int().min(1).max(4).nullable(),
  targetYear: z.number().int().nullable(),
  deferred: z.boolean(),
  deferredReason: z.string().nullable(),
});
export type StrategyGoal = z.infer<typeof strategyGoalSchema>;

/** GET …/schritte/:step: Inhalt eines Schritts */
export const strategyStepSchema = z.object({
  step: z.number().int().min(1).max(10),
  questions: z.array(z.object({ id: z.uuid(), view: z.string().nullable(), text: z.string() })),
  notes: z.array(strategyNoteSchema),
  /** Schritt 1 */
  milestones: z.array(strategyMilestoneSchema),
  /** Schritt 1: Einkauf im Team aus der Business Unit mit dem höchsten Umsatz, wenn nicht schon Lead */
  leadSuggestion: z
    .object({ userId: z.string(), name: z.string(), businessUnit: z.string() })
    .nullable()
    .default(null),
  /** Schritt 2 */
  dimensions: z.array(z.object({ key: z.string(), name: z.string() })),
  kpis: z.array(materialGroupKpiSchema),
  goals: z.array(strategyGoalSchema),
});
export type StrategyStep = z.infer<typeof strategyStepSchema>;

export const createStrategySchema = z
  .object({ year: z.number().int().min(2000).max(2100) })
  .strict();

export const saveNoteSchema = z
  .object({
    view: z.string().trim().max(40).default(''),
    text: z.string().max(5000),
    notApplicable: z.boolean().default(false),
  })
  .strict()
  .refine((note) => !note.notApplicable || note.text.trim().length > 0, {
    message: 'reason_required',
    path: ['text'],
  });
export type SaveNote = z.input<typeof saveNoteSchema>;

export const milestoneRequestSchema = z
  .object({ title: z.string().trim().min(1).max(200), dueOn: z.iso.date() })
  .strict();
export type MilestoneRequest = z.infer<typeof milestoneRequestSchema>;

const goalNumber = z.number().finite().nullable().optional();

/** Ziel anlegen oder ändern: immer mit Kennzahl; zurückgestellt nur mit Begründung */
export const goalRequestSchema = z
  .object({
    kpiId: z.uuid({ message: 'kpi_required' }),
    text: z.string().trim().max(500).default(''),
    actual: goalNumber,
    targetNextYear: goalNumber,
    targetFinal: goalNumber,
    targetQuarter: z.number().int().min(1).max(4).nullable().optional(),
    targetYear: z.number().int().min(2000).max(2100).nullable().optional(),
    deferred: z.boolean().default(false),
    deferredReason: z.string().trim().max(1000).nullable().optional(),
  })
  .strict()
  .refine((goal) => !goal.deferred || (goal.deferredReason ?? '').trim().length > 0, {
    message: 'reason_required',
    path: ['deferredReason'],
  })
  .refine((goal) => goal.deferred || goal.text.length > 0, {
    message: 'text_required',
    path: ['text'],
  });
export type GoalRequest = z.input<typeof goalRequestSchema>;

export const kpiRequestSchema = z
  .object({
    dimension: z.enum(goalDimensions),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    unit: z.string().trim().max(20).nullable().optional(),
    source: z.string().trim().max(200).nullable().optional(),
    active: z.boolean().default(true),
  })
  .strict();
export type KpiRequest = z.input<typeof kpiRequestSchema>;

export const kpiListSchema = z.object({
  dimensions: z.array(z.object({ key: z.string(), name: z.string() })),
  kpis: z.array(materialGroupKpiSchema),
});

export const questionListSchema = z.object({
  questions: z.array(
    z.object({
      id: z.uuid(),
      step: z.number().int(),
      view: z.string().nullable(),
      text: z.string(),
      position: z.number().int(),
    }),
  ),
});
export const questionRequestSchema = z.object({ text: z.string().trim().min(1).max(500) }).strict();

/** GET /api/warengruppen/:id/strategie?jahr=: Strategie eines Jahres oder der Weg, sie anzulegen */
export const strategyContextResponseSchema = z.object({
  year: z.number().int(),
  context: strategyContextSchema.nullable(),
  /** Es gibt eine Strategie, aber sie ist ein Entwurf außerhalb des eigenen Teams */
  hidden: z.boolean(),
  canCreate: z.boolean(),
});
export type StrategyContextResponse = z.infer<typeof strategyContextResponseSchema>;

/** Planungsjahr der Strategien: das nächste Kalenderjahr */
export const strategyYearOf = (today: Date) => today.getFullYear() + 1;
