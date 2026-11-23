import { z } from 'zod';

// KI-15 Import und Zuordnung: Lieferantenstamm und Spend aus dem ERP als Stapel. Was sicher ist,
// wird übernommen; was unsicher ist, prüft ein Mensch. Jede Entscheidung wird ein Alias oder eine
// Regel und greift beim nächsten Import ohne Modell. Lieferant = Organisation mit Beziehung des
// Käufers, Warengruppe = material_group (Entscheidung F14 vom 23.11.2026).

export const importBatchKinds = ['supplier_master', 'spend'] as const;
export type ImportBatchKind = (typeof importBatchKinds)[number];

export const importBatchStatuses = [
  'uploaded',
  'mapped',
  'processing',
  'review',
  'committed',
  'reverted',
  'failed',
  'discarded',
] as const;
export type ImportBatchStatus = (typeof importBatchStatuses)[number];

export const importMatchMethods = [
  'alias',
  'vat_id',
  'duns',
  'fuzzy',
  'model',
  'manual',
  'new',
] as const;
export const importCategoryMethods = ['rule', 'model', 'manual'] as const;
export const importRowStates = ['ok', 'review', 'error', 'skipped'] as const;
export type ImportRowState = (typeof importRowStates)[number];

/** Felder, denen Spalten zugeordnet werden; Pflichtfelder je Art */
export const importFields = {
  supplier_master: ['externalNumber', 'name', 'city', 'country', 'vatId', 'duns', 'sourceSystem'],
  spend: [
    'externalNumber',
    'name',
    'city',
    'country',
    'vatId',
    'duns',
    'sourceSystem',
    'bookingDate',
    'year',
    'amount',
    'currency',
    'erpMaterialGroup',
    'account',
    'description',
  ],
} as const;
export type ImportField = (typeof importFields)['spend'][number];
export const requiredImportFields: Record<ImportBatchKind, ImportField[]> = {
  supplier_master: ['name', 'country'],
  spend: ['amount'],
};

/** Höchstens so viele Zeilen je Import */
export const maxImportRows = 50_000;
/** Ab dieser Ähnlichkeit wird ein Lieferant automatisch zugeordnet */
export const autoMatchScore = 0.92;
/** Ab dieser Ähnlichkeit steht der Kandidat zur Prüfung, darunter „neu“ zur Prüfung */
export const reviewMatchScore = 0.7;
/** Ab dieser Konfidenz ist eine Warengruppe sicher */
export const categoryConfidence = 0.9;
/** So lange lässt sich ein übernommener Import rückgängig machen */
export const revertDays = 30;

export const columnMapSchema = z.record(z.string(), z.string().nullable());
export type ColumnMap = z.infer<typeof columnMapSchema>;

export const importCandidateSchema = z.object({
  relationshipId: z.uuid(),
  name: z.string(),
  score: z.number(),
});

export const importRowSchema = z.object({
  id: z.uuid(),
  rowNo: z.number().int(),
  status: z.enum(importRowStates),
  raw: z.record(z.string(), z.string()),
  /** Vom Code gelesen: Name, Nummer, Land, Betrag in Cent, Jahr … */
  normalized: z.object({
    name: z.string().nullable(),
    externalNumber: z.string().nullable(),
    sourceSystem: z.string(),
    city: z.string().nullable(),
    country: z.string().nullable(),
    vatId: z.string().nullable(),
    duns: z.string().nullable(),
    amountCents: z.number().int().nullable(),
    currency: z.string().nullable(),
    year: z.number().int().nullable(),
    erpMaterialGroup: z.string().nullable(),
    account: z.string().nullable(),
    description: z.string().nullable(),
  }),
  supplier: z.object({ relationshipId: z.uuid(), name: z.string() }).nullable(),
  matchMethod: z.enum(importMatchMethods).nullable(),
  matchScore: z.number().nullable(),
  matchReason: z.string().nullable(),
  /** Vorschlag (Kandidat oder Modell), nie automatisch übernommen */
  suggestion: z
    .object({
      relationshipId: z.uuid().nullable(),
      name: z.string().nullable(),
      reason: z.string(),
      /** Vorgeschlagener Konzernverbund für einen neuen Lieferanten */
      parentRelationshipId: z.uuid().nullable(),
      parentName: z.string().nullable(),
    })
    .nullable(),
  candidates: z.array(importCandidateSchema),
  materialGroup: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  categoryMethod: z.enum(importCategoryMethods).nullable(),
  categoryConfidence: z.number().nullable(),
  categorySuggestion: z
    .object({ id: z.uuid().nullable(), name: z.string().nullable(), reason: z.string() })
    .nullable(),
  /** Was zur Prüfung steht: Lieferant, Warengruppe oder beides */
  needs: z.array(z.enum(['supplier', 'category'])),
  error: z.string().nullable(),
  decidedBy: z.string().nullable(),
  /** Neu anlegen beim Übernehmen */
  createNew: z.boolean(),
});
export type ImportRowView = z.infer<typeof importRowSchema>;

export const importBatchSummarySchema = z.object({
  id: z.uuid(),
  kind: z.enum(importBatchKinds),
  fileName: z.string(),
  status: z.enum(importBatchStatuses),
  rowsTotal: z.number().int(),
  rowsOk: z.number().int(),
  rowsReview: z.number().int(),
  rowsError: z.number().int(),
  createdByName: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
  committedAt: z.iso.datetime({ offset: true }).nullable(),
  /** IN-07: Datei oder Lieferung über die Import-API */
  source: z.enum(['file', 'api']).default('file'),
});
export type ImportBatchSummary = z.infer<typeof importBatchSummarySchema>;

export const importBatchListSchema = z.object({
  batches: z.array(importBatchSummarySchema),
  canManage: z.boolean(),
});

export const importBatchSchema = importBatchSummarySchema.extend({
  headers: z.array(z.string()),
  /** Erste Zeilen für die Vorschau der Spalten */
  sample: z.array(z.record(z.string(), z.string())),
  columnMap: columnMapSchema,
  /** Vorschlag für die Zuordnung der Spalten; bestätigt der Admin */
  suggestedMap: columnMapSchema,
  missingRequired: z.array(z.string()),
  /** Spend in Cent: sicher, zur Prüfung, Fehler */
  spend: z.object({ okCents: z.number(), reviewCents: z.number(), errorCents: z.number() }),
  /** Anteil sicher zugeordneter Zeilen, die über Alias oder Regel ohne Modell kamen */
  learnedShare: z.number(),
  rows: z.array(importRowSchema),
  errors: z.array(z.object({ reason: z.string(), count: z.number().int() })),
  /** Was das Übernehmen bewirkt */
  plan: z.object({
    newSuppliers: z.number().int(),
    materialGroups: z.number().int(),
    openRows: z.number().int(),
    aliases: z.number().int(),
    rules: z.number().int(),
  }),
  /** Nach dem Übernehmen: Datenqualität */
  quality: z
    .object({
      assignedShare: z.number(),
      suppliersWithoutGroup: z.number().int(),
      proposedGroups: z.number().int(),
    })
    .nullable(),
  /** Warengruppen des Kunden für „Andere Warengruppe“ */
  groups: z.array(z.object({ id: z.uuid(), name: z.string() })),
  canManage: z.boolean(),
  canRevert: z.boolean(),
  revertUntil: z.iso.datetime({ offset: true }).nullable(),
});
export type ImportBatch = z.infer<typeof importBatchSchema>;

export const saveColumnMapSchema = z.object({ columnMap: columnMapSchema }).strict();

export const decideImportRowsSchema = z
  .object({
    rowIds: z.array(z.uuid()).min(1).max(500),
    action: z.enum(['accept', 'supplier', 'new', 'new_in_group', 'category', 'skip']),
    relationshipId: z.uuid().optional(),
    materialGroupId: z.uuid().nullable().optional(),
  })
  .strict();
export type DecideImportRows = z.infer<typeof decideImportRowsSchema>;
