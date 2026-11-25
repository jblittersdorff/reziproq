import { z } from 'zod';

export const agentRunStatuses = [
  'queued',
  'running',
  'waiting_input',
  'done',
  'failed',
  'aborted_budget',
  'cancelled',
] as const;

export const agentRunSchema = z.object({
  id: z.uuid(),
  agentName: z.string(),
  version: z.number().int(),
  status: z.enum(agentRunStatuses),
  isTest: z.boolean(),
  isOwn: z.boolean(),
  stepsUsed: z.number().int().nonnegative(),
  costCents: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  cancellationPending: z.boolean(),
  canResume: z.boolean(),
  startedBy: z.string().nullable(),
});
export type AgentRun = z.infer<typeof agentRunSchema>;

export const agentDefinitionSchema = z.object({
  id: z.uuid(),
  key: z.literal('meeting_brief'),
  enabled: z.boolean(),
  version: z.number().int(),
  runCount: z.number().int().nonnegative(),
});
export const agentsResponseSchema = z.object({
  agents: z.array(agentDefinitionSchema),
  recentRuns: z.array(agentRunSchema),
  nextRunId: z.uuid().nullable().optional(),
  canManage: z.boolean(),
});
export const agentDetailSchema = z.object({
  agent: agentDefinitionSchema,
  runs: z.array(agentRunSchema),
  canManage: z.boolean(),
  tools: z.array(z.string()),
  instructions: z.string(),
  trigger: z.enum(['manual', 'schedule', 'event']),
});

export const agentStepKeys = ['plan', 'read', 'model', 'retry', 'answer', 'draft'] as const;
export const agentRunDetailSchema = z.object({
  run: agentRunSchema,
  steps: z.array(
    z.object({
      seq: z.number().int().positive(),
      key: z.enum(agentStepKeys),
      status: z.enum(['running', 'done', 'failed']),
      finishedAt: z.iso.datetime().nullable(),
    }),
  ),
  draftHref: z.string().nullable(),
  sourceHref: z.string().nullable().optional(),
  hasOpenDraft: z.boolean().optional(),
  outboundQueries: z
    .array(
      z.object({
        id: z.uuid(),
        text: z.string(),
        provider: z.string(),
        sentAt: z.iso.datetime(),
      }),
    )
    .optional(),
  testResult: z.string().nullable(),
  question: z.string().nullable().optional(),
  detailsAllowed: z.boolean(),
});

export const setAgentStateSchema = z.object({ enabled: z.boolean() }).strict();
export const startAgentSchema = z
  .object({
    relationshipId: z.uuid(),
    meetingId: z.uuid(),
    isTest: z.boolean().default(false),
  })
  .strict();
export type StartAgent = z.infer<typeof startAgentSchema>;

export const resumeAgentSchema = z
  .object({
    answer: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();
