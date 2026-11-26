import { z } from 'zod';
import { userFunctions } from './permissions.js';
import { assignmentStatuses, roundStatuses } from './rounds.js';
import { segmentCriterionSchema, segmentTypeSchema } from './segment.js';

// SEG-04: Bewertung abgeben. Je Zuordnung und Kriterium ein Ist- und ein Soll-Wert (0 bis 100).

const valueSchema = z.number().int().min(0).max(100);

export const saveRatingSchema = z
  .object({
    criterionKey: z.string().min(1).max(60),
    ist: valueSchema.optional(),
    soll: valueSchema.optional(),
    comment: z.string().trim().max(500).nullable().optional(),
  })
  .refine(
    (value) => value.ist !== undefined || value.soll !== undefined || value.comment !== undefined,
  );

const namedSchema = z.object({ id: z.uuid(), name: z.string() });

export const ratingAssignmentSchema = z.object({
  id: z.uuid(),
  roundId: z.uuid(),
  roundName: z.string(),
  roundStatus: z.enum(roundStatuses),
  dueDate: z.iso.date(),
  relationshipId: z.uuid(),
  supplier: z.string(),
  businessUnit: namedSchema,
  materialGroup: namedSchema.nullable(),
  function: z.enum(userFunctions),
  status: z.enum(assignmentStatuses),
  // Den Namen sehen nur SRO und Admin (NF-03).
  raterName: z.string().nullable(),
});

export const ratingAssignmentListSchema = z.object({
  assignments: z.array(ratingAssignmentSchema),
});

export const ratingValueSchema = z.object({
  criterionKey: z.string(),
  ist: valueSchema.nullable(),
  soll: valueSchema.nullable(),
  comment: z.string().nullable(),
});

export const ratingOutcomeSchema = z.object({
  impactScore: z.number(),
  qualityScore: z.number(),
  impactLevel: z.number().int().min(1).max(3),
  qualityLevel: z.number().int().min(1).max(3),
  typeName: z.string(),
});

export const ratingDetailSchema = z.object({
  assignment: ratingAssignmentSchema,
  // Nur die bewertende Person ändert, und nur in einer laufenden Runde.
  editable: z.boolean(),
  model: z.object({
    version: z.number().int().positive(),
    // E-K0-33 (K2-b.1): 2 × 2 oder 3 × 3
    gridSize: z.union([z.literal(2), z.literal(3)]),
    lowMax: z.number().int(),
    midMax: z.number().int(),
    criteria: z.array(segmentCriterionSchema),
    types: z.array(segmentTypeSchema),
  }),
  values: z.array(ratingValueSchema),
  // Erst gefüllt, wenn alle Kriterien beide Werte haben.
  ist: ratingOutcomeSchema.nullable(),
  soll: ratingOutcomeSchema.nullable(),
});

export type SaveRating = z.infer<typeof saveRatingSchema>;
export type RatingAssignment = z.infer<typeof ratingAssignmentSchema>;
export type RatingAssignmentList = z.infer<typeof ratingAssignmentListSchema>;
export type RatingValue = z.infer<typeof ratingValueSchema>;
export type RatingOutcome = z.infer<typeof ratingOutcomeSchema>;
export type RatingDetail = z.infer<typeof ratingDetailSchema>;

// SEG-05: Segmentierung je Lieferant. Mittelwerte der abgegebenen Bewertungen, die der Nutzer sehen darf.

// SEG-06: Konsolidierung. Jede Festlegung ist eine neue Version; frühere bleiben lesbar.

const levelSchema = z.number().int().min(1).max(3);
export const segmentLevelsSchema = z.object({
  impactLevel: levelSchema,
  qualityLevel: levelSchema,
});

const reasonSchema = z.string().trim().min(1).max(1000);

export const consolidateRequestSchema = z.object({
  total: z.object({ ist: segmentLevelsSchema, soll: segmentLevelsSchema, reason: reasonSchema }),
  entries: z
    .array(
      z.object({
        businessUnitId: z.uuid(),
        materialGroupId: z.uuid().nullable(),
        ist: segmentLevelsSchema,
        soll: segmentLevelsSchema,
        reason: reasonSchema,
      }),
    )
    .max(200),
});

const decidedTypeSchema = segmentLevelsSchema.extend({ typeName: z.string() });

export const decisionEntrySchema = z.object({
  scope: z.enum(['total', 'bu_mg']),
  businessUnit: namedSchema.nullable(),
  materialGroup: namedSchema.nullable(),
  ist: decidedTypeSchema,
  soll: decidedTypeSchema,
  reason: z.string(),
});

export const decisionVersionSchema = z.object({
  version: z.number().int().positive(),
  decidedAt: z.iso.datetime({ offset: true }),
  decidedBy: z.object({ userId: z.string(), name: z.string() }),
  modelVersion: z.number().int().positive(),
  entries: z.array(decisionEntrySchema),
});

export const decisionHistorySchema = z.object({
  // Neueste Version zuerst
  versions: z.array(decisionVersionSchema),
  // Nur SRO und Admin dürfen konsolidieren
  canConsolidate: z.boolean(),
});

export type ConsolidateRequest = z.infer<typeof consolidateRequestSchema>;
export type DecisionVersion = z.infer<typeof decisionVersionSchema>;
export type DecisionHistory = z.infer<typeof decisionHistorySchema>;

export const segmentationStatuses = ['provisional', 'consolidated'] as const;

export const segmentationGroupSchema = z.object({
  businessUnit: namedSchema,
  materialGroup: namedSchema.nullable(),
  ist: ratingOutcomeSchema.nullable(),
  soll: ratingOutcomeSchema.nullable(),
  count: z.number().int(),
  status: z.enum(segmentationStatuses),
});

export const segmentationRowSchema = z.object({
  assignmentId: z.uuid(),
  businessUnit: namedSchema,
  materialGroup: namedSchema.nullable(),
  function: z.enum(userFunctions),
  values: z.array(ratingValueSchema),
  // Größte Abweichung eines Ist-Werts vom Mittelwert des Kriteriums; danach sortiert die Heatmap.
  deviation: z.number(),
});

export const segmentationCriterionStatSchema = z.object({
  criterionKey: z.string(),
  mean: z.number(),
  min: z.number(),
  max: z.number(),
});

export const segmentationSchema = z.object({
  segmentation: z
    .object({
      roundId: z.uuid(),
      roundName: z.string(),
      status: z.enum(segmentationStatuses),
      model: ratingDetailSchema.shape.model,
      overall: z.object({
        ist: ratingOutcomeSchema.nullable(),
        soll: ratingOutcomeSchema.nullable(),
        count: z.number().int(),
      }),
      // Letzte Konsolidierung (SEG-06); null, solange nichts festgelegt ist
      decision: decisionVersionSchema.nullable(),
      groups: z.array(segmentationGroupSchema),
      rows: z.array(segmentationRowSchema),
      stats: z.array(segmentationCriterionStatSchema),
    })
    .nullable(),
});

export type SegmentationGroup = z.infer<typeof segmentationGroupSchema>;
export type SegmentationRow = z.infer<typeof segmentationRowSchema>;
export type Segmentation = z.infer<typeof segmentationSchema>;
