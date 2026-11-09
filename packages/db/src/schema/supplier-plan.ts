import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { appUser } from './app-user.js';
import { businessUnit, materialGroup } from './master-data.js';
import { organization } from './organization.js';
import { cycle, relationship } from './relationship.js';

export const planStatuses = ['draft', 'in_review', 'approved', 'superseded'] as const;

/** Konfigurierbare Zielebenen je Käuferorganisation (SPL-01). */
export const objectiveCategory = pgTable(
  'objective_category',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organization.id),
    key: text().notNull(),
    name: text().notNull(),
    position: smallint().notNull(),
    active: boolean().notNull().default(true),
  },
  (table) => [
    unique('objective_category_org_key').on(table.orgId, table.key),
    check('objective_category_key', sql`${table.key} ~ '^[a-z][a-z0-9_-]{0,39}$'`),
    check('objective_category_name', sql`length(trim(${table.name})) between 1 and 100`),
    check('objective_category_position', sql`${table.position} > 0`),
  ],
);

/** Interner Plan je Lieferantenbeziehung und Jahreszyklus (SPL-01). */
export const supplierPlan = pgTable(
  'supplier_plan',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid('relationship_id')
      .notNull()
      .references(() => relationship.id),
    cycleId: uuid('cycle_id').notNull(),
    version: integer().notNull().default(1),
    status: text({ enum: planStatuses }).notNull().default('draft'),
    summary: text().notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // SPL-07: Freigaberunde (zählt jede Einreichung), eingereicht und freigegeben am.
    reviewRound: integer('review_round').notNull().default(0),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
  },
  (table) => [
    check('supplier_plan_version', sql`${table.version} > 0`),
    check(
      'supplier_plan_status',
      sql`${table.status} in ('draft', 'in_review', 'approved', 'superseded')`,
    ),
    unique('supplier_plan_cycle_version').on(table.cycleId, table.version),
    unique('supplier_plan_id_relationship').on(table.id, table.relationshipId),
    foreignKey({
      columns: [table.cycleId, table.relationshipId],
      foreignColumns: [cycle.id, cycle.relationshipId],
      name: 'supplier_plan_cycle_relationship_fk',
    }),
    uniqueIndex('supplier_plan_one_draft').on(table.cycleId).where(sql`${table.status} = 'draft'`),
  ],
);

/** Interne Ziele eines Plans. relationship_id ist für RLS und wird über den Plan abgesichert. */
export const planObjective = pgTable(
  'plan_objective',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid('relationship_id')
      .notNull()
      .references(() => relationship.id),
    planId: uuid('plan_id').notNull(),
    categoryKey: text('category_key').notNull(),
    businessUnitId: uuid('business_unit_id').references(() => businessUnit.id),
    materialGroupId: uuid('material_group_id').references(() => materialGroup.id),
    text: text().notNull(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => appUser.id),
    targetYear: integer('target_year').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.planId, table.relationshipId],
      foreignColumns: [supplierPlan.id, supplierPlan.relationshipId],
      name: 'plan_objective_plan_relationship_fk',
    }).onDelete('cascade'),
    check(
      'plan_objective_one_reference',
      sql`(${table.businessUnitId} is not null and ${table.materialGroupId} is null) or
        (${table.businessUnitId} is null and ${table.materialGroupId} is not null)`,
    ),
    check('plan_objective_text', sql`length(trim(${table.text})) between 1 and 2000`),
    check('plan_objective_year', sql`${table.targetYear} between 1900 and 9999`),
    unique('plan_objective_id_relationship').on(table.id, table.relationshipId),
  ],
);

export const contributionStatuses = ['open', 'done'] as const;

/** Angeforderter Beitrag einer Funktion zum Plan (SPL-03). Nur käuferintern. */
export const planContribution = pgTable(
  'plan_contribution',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid('relationship_id')
      .notNull()
      .references(() => relationship.id),
    planId: uuid('plan_id').notNull(),
    businessUnitId: uuid('business_unit_id').references(() => businessUnit.id),
    materialGroupId: uuid('material_group_id').references(() => materialGroup.id),
    assigneeUserId: text('assignee_user_id')
      .notNull()
      .references(() => appUser.id),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    status: text({ enum: contributionStatuses }).notNull().default('open'),
    doneAt: timestamp('done_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.planId, table.relationshipId],
      foreignColumns: [supplierPlan.id, supplierPlan.relationshipId],
      name: 'plan_contribution_plan_relationship_fk',
    }).onDelete('cascade'),
    check(
      'plan_contribution_one_reference',
      sql`(${table.businessUnitId} is not null and ${table.materialGroupId} is null) or
        (${table.businessUnitId} is null and ${table.materialGroupId} is not null)`,
    ),
    check('plan_contribution_status', sql`${table.status} in ('open', 'done')`),
    check(
      'plan_contribution_done_at',
      sql`(${table.status} = 'done') = (${table.doneAt} is not null)`,
    ),
    uniqueIndex('plan_contribution_one_bu')
      .on(table.planId, table.businessUnitId)
      .where(sql`${table.businessUnitId} is not null`),
    uniqueIndex('plan_contribution_one_mg')
      .on(table.planId, table.materialGroupId)
      .where(sql`${table.materialGroupId} is not null`),
  ],
);

/** Strategische Themen eines Plans (SPL-06); priority ordnet sie aufsteigend. */
export const strategicTopic = pgTable(
  'strategic_topic',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid('relationship_id')
      .notNull()
      .references(() => relationship.id),
    planId: uuid('plan_id').notNull(),
    title: text().notNull(),
    reason: text().notNull(),
    priority: integer().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.planId, table.relationshipId],
      foreignColumns: [supplierPlan.id, supplierPlan.relationshipId],
      name: 'strategic_topic_plan_relationship_fk',
    }).onDelete('cascade'),
    unique('strategic_topic_id_relationship').on(table.id, table.relationshipId),
    check('strategic_topic_title', sql`length(trim(${table.title})) between 1 and 200`),
    check('strategic_topic_reason', sql`length(trim(${table.reason})) between 1 and 2000`),
    check('strategic_topic_priority', sql`${table.priority} > 0`),
  ],
);

export const strategicTopicObjective = pgTable(
  'strategic_topic_objective',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid('relationship_id')
      .notNull()
      .references(() => relationship.id),
    topicId: uuid('topic_id').notNull(),
    objectiveId: uuid('objective_id').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.topicId, table.relationshipId],
      foreignColumns: [strategicTopic.id, strategicTopic.relationshipId],
      name: 'strategic_topic_objective_topic_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.objectiveId, table.relationshipId],
      foreignColumns: [planObjective.id, planObjective.relationshipId],
      name: 'strategic_topic_objective_objective_fk',
    }).onDelete('cascade'),
    unique('strategic_topic_objective_once').on(table.topicId, table.objectiveId),
  ],
);

export const planApprovalRoles = ['sro', 'sponsor'] as const;
export const planApprovalDecisions = ['approved', 'returned'] as const;

/**
 * Entscheidung über einen eingereichten Plan (SPL-07), käuferprivat. Je Runde entscheidet jede
 * Person einmal; Zurückgeben braucht eine Begründung.
 */
export const planApproval = pgTable(
  'plan_approval',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid('relationship_id')
      .notNull()
      .references(() => relationship.id),
    planId: uuid('plan_id').notNull(),
    round: integer().notNull(),
    userId: text('user_id').notNull(),
    userName: text('user_name').notNull(),
    role: text({ enum: planApprovalRoles }).notNull(),
    decision: text({ enum: planApprovalDecisions }).notNull(),
    comment: text(),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.planId, table.relationshipId],
      foreignColumns: [supplierPlan.id, supplierPlan.relationshipId],
      name: 'plan_approval_plan_relationship_fk',
    }).onDelete('cascade'),
    check('plan_approval_role', sql`${table.role} in ('sro', 'sponsor')`),
    check('plan_approval_decision', sql`${table.decision} in ('approved', 'returned')`),
    check(
      'plan_approval_reason',
      sql`${table.decision} = 'approved' or length(trim(coalesce(${table.comment}, ''))) > 0`,
    ),
    unique('plan_approval_once').on(table.planId, table.round, table.userId),
  ],
);
