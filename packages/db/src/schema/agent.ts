import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { organization } from './organization.js';

const triggerKinds = ['manual', 'schedule', 'event'] as const;
const agentStatuses = ['draft', 'pending_approval', 'active', 'paused', 'off'] as const;
const runStatuses = [
  'queued',
  'running',
  'waiting_input',
  'done',
  'failed',
  'aborted_budget',
  'cancelled',
] as const;
const stepKinds = ['plan', 'read', 'search', 'model', 'check', 'draft'] as const;
const stepStatuses = ['running', 'done', 'failed'] as const;

const id = () => uuid().primaryKey().default(sql`uuidv7()`);
const orgId = () =>
  uuid()
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' });
const time = () => timestamp({ withTimezone: true });

/** Konfiguration eines Agenten in einer Organisation. Läufe bleiben an ihre Version gebunden. */
export const agent = pgTable(
  'agent',
  {
    id: id(),
    orgId: orgId(),
    key: text().notNull(),
    name: text().notNull(),
    description: text().notNull(),
    kind: text({ enum: ['system', 'custom'] }).notNull(),
    ownerUserId: text(),
    status: text({ enum: agentStatuses }).notNull().default('draft'),
    // KI-09: Rückgabe durch den Admin mit Kommentar; Grund einer automatischen Pause
    reviewComment: text(),
    pausedReason: text(),
  },
  (table) => [
    unique('agent_org_id').on(table.orgId, table.id),
    unique('agent_org_key').on(table.orgId, table.key),
    check(
      'agent_kind_owner',
      sql`(${table.kind} = 'system' and ${table.ownerUserId} is null)
    or (${table.kind} = 'custom' and ${table.ownerUserId} is not null)`,
    ),
    check(
      'agent_status',
      sql`${table.status} in ('draft','pending_approval','active','paused','off')`,
    ),
  ],
);

export const agentVersion = pgTable(
  'agent_version',
  {
    id: id(),
    orgId: orgId(),
    agentId: uuid().notNull(),
    version: integer().notNull(),
    instructions: text().notNull(),
    tools: jsonb().$type<string[]>().notNull(),
    trigger: text({ enum: triggerKinds }).notNull(),
    schedule: text(),
    eventKey: text(),
    scope: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    outputTarget: text().notNull(),
    reviewerRule: text().notNull(),
    modelClass: text({ enum: ['small', 'standard', 'synthesis'] }).notNull(),
    budgetCents: integer().notNull(),
    maxSteps: integer().notNull(),
    createdBy: text(),
    approvedBy: text(),
    approvedAt: time(),
    // KI-09: erfolgreicher Testlauf dieser Version; Prüfung der Aufgabe (keine Personenbewertung)
    testRunId: uuid(),
    testPassedAt: time(),
    checkStatus: text({ enum: ['ok', 'blocked'] }),
    checkNote: text(),
  },
  (table) => [
    unique('agent_version_org_id').on(table.orgId, table.id),
    unique('agent_version_number').on(table.orgId, table.agentId, table.version),
    foreignKey({
      name: 'agent_version_agent',
      columns: [table.orgId, table.agentId],
      foreignColumns: [agent.orgId, agent.id],
    }).onDelete('cascade'),
    check(
      'agent_version_limits',
      sql`${table.version} > 0 and ${table.budgetCents} > 0 and ${table.maxSteps} > 0`,
    ),
    check(
      'agent_version_model_class',
      sql`${table.modelClass} in ('small','standard','synthesis')`,
    ),
    check(
      'agent_version_trigger',
      sql`
    (${table.trigger} = 'manual' and ${table.schedule} is null and ${table.eventKey} is null) or
    (${table.trigger} = 'schedule' and ${table.schedule} is not null and ${table.eventKey} is null) or
    (${table.trigger} = 'event' and ${table.schedule} is null and ${table.eventKey} is not null)`,
    ),
  ],
);

export const agentOrgState = pgTable(
  'agent_org_state',
  {
    id: id(),
    orgId: orgId(),
    agentId: uuid().notNull(),
    enabled: boolean().notNull().default(false),
  },
  (table) => [
    unique('agent_org_state_agent_once').on(table.orgId, table.agentId),
    foreignKey({
      name: 'agent_org_state_agent',
      columns: [table.orgId, table.agentId],
      foreignColumns: [agent.orgId, agent.id],
    }).onDelete('cascade'),
  ],
);

export const agentRun = pgTable(
  'agent_run',
  {
    id: id(),
    orgId: orgId(),
    agentVersionId: uuid().notNull(),
    actingUserId: text().notNull(),
    startedBy: text().notNull(),
    trigger: text({ enum: triggerKinds }).notNull(),
    contextRelationshipId: uuid(),
    contextType: text(),
    contextId: uuid(),
    isTest: boolean().notNull().default(false),
    parentRunId: uuid(),
    status: text({ enum: runStatuses }).notNull().default('queued'),
    stepsUsed: integer().notNull().default(0),
    costMicrocents: bigint({ mode: 'number' }).notNull().default(0),
    createdAt: time().notNull().defaultNow(),
    startedAt: time(),
    finishedAt: time(),
    cancelRequestedAt: time(),
    jobTicket: uuid(),
    inputText: text(),
    // KI-07: Prüfsumme über die gelesenen Objekte; gleiche Eingaben starten keinen neuen Lauf
    inputChecksum: text(),
  },
  (table) => [
    unique('agent_run_org_id').on(table.orgId, table.id),
    foreignKey({
      name: 'agent_run_version',
      columns: [table.orgId, table.agentVersionId],
      foreignColumns: [agentVersion.orgId, agentVersion.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'agent_run_parent',
      columns: [table.orgId, table.parentRunId],
      foreignColumns: [table.orgId, table.id],
    }).onDelete('cascade'),
    index('agent_run_org_date').on(table.orgId, table.createdAt),
    index('agent_run_parent_lookup').on(table.orgId, table.parentRunId),
    check(
      'agent_run_status',
      sql`${table.status} in ('queued','running','waiting_input','done','failed','aborted_budget','cancelled')`,
    ),
    check('agent_run_trigger', sql`${table.trigger} in ('manual','schedule','event')`),
    check('agent_run_context', sql`(${table.contextType} is null) = (${table.contextId} is null)`),
    check('agent_run_amounts', sql`${table.stepsUsed} >= 0 and ${table.costMicrocents} >= 0`),
    check('agent_run_not_own_parent', sql`${table.parentRunId} is distinct from ${table.id}`),
  ],
);

export const agentStep = pgTable(
  'agent_step',
  {
    id: id(),
    orgId: orgId(),
    runId: uuid().notNull(),
    seq: integer().notNull(),
    kind: text({ enum: stepKinds }).notNull(),
    title: text().notNull(),
    detail: jsonb().$type<Record<string, unknown>>(),
    toolKey: text(),
    costMicrocents: bigint({ mode: 'number' }).notNull().default(0),
    startedAt: time().notNull().defaultNow(),
    finishedAt: time(),
    status: text({ enum: stepStatuses }).notNull().default('running'),
  },
  (table) => [
    unique('agent_step_org_run_id').on(table.orgId, table.runId, table.id),
    unique('agent_step_seq_once').on(table.orgId, table.runId, table.seq),
    foreignKey({
      name: 'agent_step_run',
      columns: [table.orgId, table.runId],
      foreignColumns: [agentRun.orgId, agentRun.id],
    }).onDelete('cascade'),
    check('agent_step_amounts', sql`${table.seq} > 0 and ${table.costMicrocents} >= 0`),
    check(
      'agent_step_kind',
      sql`${table.kind} in ('plan','read','search','model','check','draft')`,
    ),
    check('agent_step_status', sql`${table.status} in ('running','done','failed')`),
  ],
);

export const agentOutboundQuery = pgTable(
  'agent_outbound_query',
  {
    id: id(),
    orgId: orgId(),
    runId: uuid().notNull(),
    stepId: uuid().notNull(),
    text: text().notNull(),
    provider: text().notNull(),
    sentAt: time().notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'agent_query_step',
      columns: [table.orgId, table.runId, table.stepId],
      foreignColumns: [agentStep.orgId, agentStep.runId, agentStep.id],
    }).onDelete('cascade'),
    index('agent_query_run').on(table.orgId, table.runId),
  ],
);
