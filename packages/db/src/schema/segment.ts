import { sql } from 'drizzle-orm';
import {
  check,
  index,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organization } from './organization.js';

export const segmentModel = pgTable(
  'segment_model',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organization.id),
    version: smallint().notNull(),
    status: text().$type<'draft' | 'active' | 'retired'>().notNull(),
    lowMax: smallint('low_max').notNull(),
    midMax: smallint('mid_max').notNull(),
    // SEG-07: Ab dieser Abweichung (Punkte von 100) gilt sie im Portfolio als ungeklärt.
    deviationThreshold: smallint('deviation_threshold').notNull().default(30),
    // SEG-02: Fokus-Vorschlag, wenn die größten Lieferanten zusammen diesen Prozentsatz des Spends ausmachen.
    focusSpendShare: smallint('focus_spend_share').notNull().default(80),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
  },
  (table) => [
    check('segment_model_status', sql`${table.status} in ('draft', 'active', 'retired')`),
    check(
      'segment_model_boundaries',
      sql`${table.lowMax} >= 0 and ${table.lowMax} < ${table.midMax} and ${table.midMax} <= 100`,
    ),
    check('segment_model_deviation', sql`${table.deviationThreshold} between 1 and 100`),
    check('segment_model_focus_share', sql`${table.focusSpendShare} between 1 and 100`),
    check('segment_model_version', sql`${table.version} > 0`),
    check(
      'segment_model_activation',
      sql`(${table.status} = 'draft' and ${table.activatedAt} is null) or
        (${table.status} in ('active', 'retired') and ${table.activatedAt} is not null)`,
    ),
    unique('segment_model_org_version').on(table.orgId, table.version),
    uniqueIndex('segment_model_one_active').on(table.orgId).where(sql`${table.status} = 'active'`),
    uniqueIndex('segment_model_one_draft').on(table.orgId).where(sql`${table.status} = 'draft'`),
  ],
);

export const segmentCriterion = pgTable(
  'segment_criterion',
  {
    modelId: uuid('model_id')
      .notNull()
      .references(() => segmentModel.id, { onDelete: 'cascade' }),
    axis: text().$type<'impact' | 'quality'>().notNull(),
    key: text().notNull(),
    name: text().notNull(),
    description: text().notNull(),
    weight: numeric({ precision: 5, scale: 2, mode: 'number' }).notNull(),
    position: smallint().notNull(),
  },
  (table) => [
    check('segment_criterion_axis', sql`${table.axis} in ('impact', 'quality')`),
    check('segment_criterion_weight', sql`${table.weight} >= 0 and ${table.weight} <= 100`),
    check('segment_criterion_position', sql`${table.position} > 0`),
    unique('segment_criterion_key').on(table.modelId, table.key),
    unique('segment_criterion_position_unique').on(table.modelId, table.axis, table.position),
    index('segment_criterion_model').on(table.modelId),
  ],
);

export const segmentType = pgTable(
  'segment_type',
  {
    modelId: uuid('model_id')
      .notNull()
      .references(() => segmentModel.id, { onDelete: 'cascade' }),
    impactLevel: smallint('impact_level').notNull(),
    qualityLevel: smallint('quality_level').notNull(),
    name: text().notNull(),
    description: text().notNull(),
  },
  (table) => [
    check(
      'segment_type_levels',
      sql`${table.impactLevel} between 1 and 3 and ${table.qualityLevel} between 1 and 3`,
    ),
    unique('segment_type_cell').on(table.modelId, table.impactLevel, table.qualityLevel),
    index('segment_type_model').on(table.modelId),
  ],
);
