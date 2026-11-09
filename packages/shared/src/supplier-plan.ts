import { z } from 'zod';

export const planStatuses = ['draft', 'in_review', 'approved', 'superseded'] as const;
export type PlanStatus = (typeof planStatuses)[number];

export const defaultObjectiveCategories = [
  { key: 'cost', name: 'Kosten' },
  { key: 'quality', name: 'Qualität' },
  { key: 'technology', name: 'Technologie' },
  { key: 'supply', name: 'Versorgung' },
  { key: 'sustainability', name: 'Nachhaltigkeit' },
  { key: 'capacity', name: 'Kapazität' },
  { key: 'location', name: 'Standort' },
] as const;

export const objectiveCategorySchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
  name: z.string().trim().min(1).max(100),
  position: z.number().int().positive(),
  active: z.boolean(),
});
export type ObjectiveCategory = z.infer<typeof objectiveCategorySchema>;

export const objectiveCategoriesResponseSchema = z.object({
  categories: z.array(objectiveCategorySchema),
});

export const objectiveCategoryRequestSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
  name: z.string().trim().min(1).max(100),
  position: z.number().int().positive(),
  active: z.boolean().optional(),
});
export type ObjectiveCategoryRequest = z.infer<typeof objectiveCategoryRequestSchema>;

export const updateObjectiveCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  position: z.number().int().positive(),
  active: z.boolean(),
});
export type UpdateObjectiveCategory = z.infer<typeof updateObjectiveCategorySchema>;

export const planObjectiveSchema = z.object({
  id: z.string(),
  categoryKey: z.string(),
  categoryName: z.string(),
  businessUnit: z.object({ id: z.string(), name: z.string() }).nullable(),
  materialGroup: z.object({ id: z.string(), name: z.string() }).nullable(),
  text: z.string(),
  owner: z.object({ userId: z.string(), name: z.string() }),
  targetYear: z.number().int(),
  canEdit: z.boolean(),
});
export type PlanObjective = z.infer<typeof planObjectiveSchema>;

// SPL-03: Beiträge der Funktionen. Je Beitrag genau eine Business Unit oder Warengruppe.
export const contributionStatuses = ['open', 'done'] as const;

const namedReferenceSchema = z.object({ id: z.string(), name: z.string() });

export const planContributionSchema = z.object({
  id: z.string(),
  businessUnit: namedReferenceSchema.nullable(),
  materialGroup: namedReferenceSchema.nullable(),
  assignee: z.object({ userId: z.string(), name: z.string() }),
  dueDate: z.iso.date(),
  status: z.enum(contributionStatuses),
  doneAt: z.string().nullable(),
});
export type PlanContribution = z.infer<typeof planContributionSchema>;

export const contributionSuggestionSchema = z.object({
  businessUnit: namedReferenceSchema.nullable(),
  materialGroup: namedReferenceSchema.nullable(),
  suggestedUserId: z.string().nullable(),
});

export const contributionSuggestionsResponseSchema = z.object({
  rows: z.array(contributionSuggestionSchema),
  teamCandidates: z.array(z.object({ userId: z.string(), name: z.string() })),
});
export type ContributionSuggestionsResponse = z.infer<typeof contributionSuggestionsResponseSchema>;

export const requestContributionsSchema = z.object({
  contributions: z
    .array(
      z
        .object({
          businessUnitId: z.uuid().nullable(),
          materialGroupId: z.uuid().nullable(),
          assigneeUserId: z.string().min(1).max(255),
          dueDate: z.iso.date(),
        })
        .refine(
          (value) =>
            Number(Boolean(value.businessUnitId)) + Number(Boolean(value.materialGroupId)) === 1,
          { message: 'exactly_one_reference', path: ['businessUnitId'] },
        ),
    )
    .min(1)
    .max(200),
});
export type RequestContributions = z.infer<typeof requestContributionsSchema>;

export const contributionDetailSchema = z.object({
  id: z.string(),
  planId: z.string(),
  relationshipId: z.string(),
  businessUnit: namedReferenceSchema.nullable(),
  materialGroup: namedReferenceSchema.nullable(),
  assignee: z.object({ userId: z.string(), name: z.string() }),
  dueDate: z.iso.date(),
  status: z.enum(contributionStatuses),
  summary: z.string(),
  targetType: z.string().nullable(),
  categories: z.array(objectiveCategorySchema),
  objectives: z.array(planObjectiveSchema),
  canEdit: z.boolean(),
});
export type ContributionDetail = z.infer<typeof contributionDetailSchema>;

export const contributionObjectiveRequestSchema = z.object({
  categoryKey: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
  text: z.string().trim().min(1).max(2000),
  targetYear: z.number().int().min(1900).max(9999),
});
export type ContributionObjectiveRequest = z.infer<typeof contributionObjectiveRequestSchema>;

// SPL-06: Strategische Themen. Mehr als fünf verwässern den Fokus, Speichern bleibt möglich.
export const recommendedTopicLimit = 5;

export const strategicTopicSchema = z.object({
  id: z.string(),
  title: z.string(),
  reason: z.string(),
  priority: z.number().int().positive(),
  objectives: z.array(z.object({ id: z.string(), text: z.string() })),
});
export type StrategicTopic = z.infer<typeof strategicTopicSchema>;

export const strategicTopicRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(2000),
  objectiveIds: z.array(z.uuid()).min(1).max(100),
});
export type StrategicTopicRequest = z.infer<typeof strategicTopicRequestSchema>;

export const strategicTopicOrderSchema = z.object({
  topicIds: z.array(z.uuid()).min(1).max(200),
});
export type StrategicTopicOrder = z.infer<typeof strategicTopicOrderSchema>;

/** SPL-07: Stand der Freigabe des Plans. */
export const planApprovalStateSchema = z.object({
  round: z.number().int(),
  submittedAt: z.string().nullable(),
  approvedAt: z.string().nullable(),
  /** Gibt es keinen Sponsor im Team, genügt der SRO (mit Hinweis). */
  hasSponsor: z.boolean(),
  decisions: z.array(
    z.object({
      userName: z.string(),
      role: z.enum(['sro', 'sponsor']),
      decision: z.enum(['approved', 'returned']),
      comment: z.string().nullable(),
      decidedAt: z.string(),
      round: z.number().int(),
    }),
  ),
  /** Offene Beiträge und fehlende Themen als Hinweis vor dem Einreichen */
  hints: z.object({ openContributions: z.number().int(), noTopics: z.boolean() }),
  canSubmit: z.boolean(),
  canDecide: z.boolean(),
  canNewVersion: z.boolean(),
});
export type PlanApprovalState = z.infer<typeof planApprovalStateSchema>;

export const supplierPlanSchema = z.object({
  id: z.string(),
  relationshipId: z.string(),
  cycleId: z.string(),
  version: z.number().int().positive(),
  status: z.enum(planStatuses),
  summary: z.string(),
  createdAt: z.string(),
  targetType: z.string().nullable(),
  sro: z.object({ userId: z.string(), name: z.string() }).nullable(),
  objectives: z.array(planObjectiveSchema),
  contributions: z.object({
    done: z.number().int(),
    total: z.number().int(),
    items: z.array(planContributionSchema),
  }),
  topics: z.array(strategicTopicSchema),
  canManage: z.boolean(),
  approval: planApprovalStateSchema,
});
export type SupplierPlan = z.infer<typeof supplierPlanSchema>;

/** SPL-07: Freigabe – eine Entscheidung je Person und Runde. */
export const planDecisionSchema = z
  .object({
    decision: z.enum(['approved', 'returned']),
    comment: z.string().trim().max(2000).nullable(),
  })
  .strict()
  .refine((value) => value.decision === 'approved' || (value.comment ?? '').length > 0, {
    message: 'Zurückgeben braucht eine Begründung',
    path: ['comment'],
  });
export type PlanDecision = z.infer<typeof planDecisionSchema>;

/** SPL-07: Versionen eines Plans im Zyklus, je mit Inhalt für den Vergleich. */
export const planVersionSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  status: z.enum(planStatuses),
  approvedAt: z.string().nullable(),
  summary: z.string(),
  objectives: z.array(
    z.object({
      categoryName: z.string(),
      reference: z.string().nullable(),
      text: z.string(),
      targetYear: z.number().int(),
    }),
  ),
  topics: z.array(z.object({ title: z.string(), reason: z.string(), priority: z.number().int() })),
});
export const planVersionsSchema = z.object({ versions: z.array(planVersionSchema) });
export type PlanVersion = z.infer<typeof planVersionSchema>;
export type PlanVersions = z.infer<typeof planVersionsSchema>;

export const supplierPlanResponseSchema = z.object({
  plan: supplierPlanSchema.nullable(),
  cycleId: z.string().nullable(),
  categories: z.array(objectiveCategorySchema),
  teamCandidates: z.array(z.object({ userId: z.string(), name: z.string() })),
  canCreate: z.boolean(),
});
export type SupplierPlanResponse = z.infer<typeof supplierPlanResponseSchema>;

export const updatePlanSummarySchema = z.object({
  summary: z.string().trim().max(5000),
});
export type UpdatePlanSummary = z.infer<typeof updatePlanSummarySchema>;

export const planObjectiveRequestSchema = z
  .object({
    categoryKey: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
    businessUnitId: z.uuid().nullable(),
    materialGroupId: z.uuid().nullable(),
    text: z.string().trim().min(1).max(2000),
    ownerUserId: z.string().min(1).max(255),
    targetYear: z.number().int().min(1900).max(9999),
  })
  .refine(
    (value) => Number(Boolean(value.businessUnitId)) + Number(Boolean(value.materialGroupId)) === 1,
    { message: 'exactly_one_reference', path: ['businessUnitId'] },
  );
export type PlanObjectiveRequest = z.infer<typeof planObjectiveRequestSchema>;
