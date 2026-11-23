import { z } from 'zod';
import type { Action } from './permissions.js';

// KI-09: Eigene Agenten ohne Code. Aufgabe in eigenen Worten, Daten (Werkzeuge der Registry),
// Auslöser, Umfang, Ergebnis, Prüfer, Budget. Jede Änderung ist eine neue Version; aktiv nur nach
// erfolgreichem Testlauf dieser Version. Bewertet Lieferanten und Beziehungen, nie Personen.

/** Lesende Werkzeuge für eigene Agenten, je mit dem Recht, das man für den Datenbereich braucht */
export const customAgentTools = {
  supplier_master: 'lieferanten.sehen',
  spend: 'lieferanten.sehen',
  segmentation: 'bewertungen.sehen',
  commitments: 'jbp.sehen',
  actions: 'massnahmen.sehen',
  meetings: 'termine.sehen',
  feedback: 'feedback.sehen',
  hints: 'hinweise.sehen',
} as const satisfies Record<string, Action>;
export type CustomAgentTool = keyof typeof customAgentTools;
export const customAgentToolKeys = Object.keys(customAgentTools) as CustomAgentTool[];

export const customAgentEvents = [
  'feedback_revealed',
  'commitment_overdue',
  'qbr_in_7_days',
  'spend_import_done',
] as const;
export type CustomAgentEvent = (typeof customAgentEvents)[number];

export const customAgentScopes = ['focus', 'supplier', 'category'] as const;
export const customAgentOutputs = ['task', 'action', 'note'] as const;
export type CustomAgentOutput = (typeof customAgentOutputs)[number];
export const customAgentReviewers = ['me', 'sro'] as const;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const customAgentScheduleSchema = z.discriminatedUnion('every', [
  z.object({ every: z.literal('week'), weekday: z.number().int().min(1).max(7), time }),
  z.object({ every: z.literal('month'), day: z.number().int().min(1).max(28), time }),
]);
export type CustomAgentSchedule = z.infer<typeof customAgentScheduleSchema>;

export const customAgentTriggerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('manual') }),
  z.object({ kind: z.literal('schedule'), schedule: customAgentScheduleSchema }),
  z.object({ kind: z.literal('event'), event: z.enum(customAgentEvents) }),
]);
export type CustomAgentTrigger = z.infer<typeof customAgentTriggerSchema>;

export const customAgentScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('focus') }),
  z.object({ kind: z.literal('supplier'), relationshipId: z.uuid() }),
  z.object({ kind: z.literal('category'), materialGroupId: z.uuid() }),
]);
export type CustomAgentScope = z.infer<typeof customAgentScopeSchema>;

export const saveCustomAgentSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    instructions: z.string().trim().min(1).max(2000),
    tools: z
      .array(z.enum(customAgentToolKeys as [CustomAgentTool, ...CustomAgentTool[]]))
      .min(1)
      .max(8),
    trigger: customAgentTriggerSchema,
    scope: customAgentScopeSchema,
    output: z.enum(customAgentOutputs),
    reviewer: z.enum(customAgentReviewers),
    budgetCents: z.number().int().min(1).max(1_000_000),
  })
  .strict();
export type SaveCustomAgent = z.infer<typeof saveCustomAgentSchema>;

export const customAgentStatuses = [
  'draft',
  'pending_approval',
  'active',
  'paused',
  'off',
] as const;

export const customAgentSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: z.enum(customAgentStatuses),
  ownerName: z.string(),
  isOwn: z.boolean(),
  version: z.number().int(),
  config: saveCustomAgentSchema,
  /** Die Aufgabe bewertet Personen: gespeichert, aber nicht aktivierbar */
  blockedReason: z.string().nullable(),
  /** Erfolgreicher Testlauf der aktuellen Version */
  testPassed: z.boolean(),
  lastTestRunId: z.uuid().nullable(),
  /** Freigabe durch einen Admin nötig (Zeitplan oder Ereignis bei eingeschalteter Freigabe) */
  needsApproval: z.boolean(),
  reviewComment: z.string().nullable(),
  pausedReason: z.string().nullable(),
  runCount: z.number().int(),
  canEdit: z.boolean(),
  canApprove: z.boolean(),
  canStart: z.boolean(),
});
export type CustomAgent = z.infer<typeof customAgentSchema>;

export const customAgentDetailSchema = customAgentSchema.extend({
  runs: z.array(
    z.object({
      id: z.uuid(),
      version: z.number().int(),
      status: z.string(),
      isTest: z.boolean(),
      createdAt: z.string(),
      startedBy: z.string().nullable(),
    }),
  ),
});
export type CustomAgentDetail = z.infer<typeof customAgentDetailSchema>;

export const customAgentListSchema = z.object({
  agents: z.array(customAgentSchema),
  /** Darf eigene Agenten anlegen (ai_custom_agent_roles) */
  canCreate: z.boolean(),
  /** Zur Freigabe wartende Agenten (nur für Admins befüllt) */
  pendingApproval: z.array(customAgentSchema),
});
export type CustomAgentList = z.infer<typeof customAgentListSchema>;

/** Was der Nutzer beim Anlegen wählen darf: nur Werkzeuge mit sichtbaren Datenbereichen */
export const customAgentOptionsSchema = z.object({
  tools: z.array(z.enum(customAgentToolKeys as [CustomAgentTool, ...CustomAgentTool[]])),
  suppliers: z.array(z.object({ relationshipId: z.uuid(), name: z.string() })),
  categories: z.array(z.object({ id: z.uuid(), name: z.string() })),
  maxBudgetCents: z.number().int(),
  approvalRequired: z.boolean(),
  /** Vorlage aus einem Agenten von Reziproq */
  templates: z.array(z.object({ key: z.string(), name: z.string(), instructions: z.string() })),
});
export type CustomAgentOptions = z.infer<typeof customAgentOptionsSchema>;

export const reviewCustomAgentSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approve') }),
  z.object({ decision: z.literal('return'), comment: z.string().trim().min(1).max(1000) }),
]);
export type ReviewCustomAgent = z.infer<typeof reviewCustomAgentSchema>;

export const startCustomAgentSchema = z.object({ isTest: z.boolean().default(false) }).strict();

/** Ergebnis je Lieferant (Entwurf oder im Testlauf nur angezeigt) */
export const customAgentResultSchema = z.object({
  relationshipId: z.uuid(),
  supplier: z.string(),
  title: z.string(),
  text: z.string(),
  draftId: z.uuid().nullable(),
  status: z.enum(['draft', 'accepted', 'discarded']).nullable(),
});
export const customAgentRunResultsSchema = z.object({
  output: z.enum(customAgentOutputs),
  results: z.array(customAgentResultSchema),
  canAccept: z.boolean(),
});
export type CustomAgentRunResults = z.infer<typeof customAgentRunResultsSchema>;
