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
    // E-K0-33 (K2-b.1): Größe der Matrix je Modell, 2 × 2 oder 3 × 3. Bei 2 × 2 trennt lowMax die
    // beiden Stufen, midMax bleibt 100. Die Achsen heißen je Kunde, z. B. Versorgungsrisiko und
    // Wertbeitrag statt Business Impact und Beziehungsqualität.
    gridSize: smallint('grid_size').notNull().default(3),
    impactLabel: text('impact_label').notNull().default('Business Impact'),
    qualityLabel: text('quality_label').notNull().default('Beziehungsqualität'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`app_now()`),
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
    check('segment_model_grid_size', sql`${table.gridSize} in (2, 3)`),
    check('segment_model_grid_boundaries', sql`${table.gridSize} = 3 or ${table.midMax} = 100`),
    check(
      'segment_model_axis_labels',
      sql`length(trim(${table.impactLabel})) between 1 and 80 and length(trim(${table.qualityLabel})) between 1 and 80`,
    ),
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
    // HE-01, E-K0-17: Gewicht des Segmenttyps in der Punktzahl der Triage. Start 1,0, für den
    // strategischen Typ (höchste Wirkung, beste Beziehung) 2,0; je Modell einstellbar.
    triageWeight: numeric('triage_weight', { precision: 4, scale: 2, mode: 'number' })
      .notNull()
      .default(1),
  },
  (table) => [
    check('segment_type_triage_weight', sql`${table.triageWeight} between 0.1 and 10`),
    check(
      'segment_type_levels',
      sql`${table.impactLevel} between 1 and 3 and ${table.qualityLevel} between 1 and 3`,
    ),
    unique('segment_type_cell').on(table.modelId, table.impactLevel, table.qualityLevel),
    index('segment_type_model').on(table.modelId),
  ],
);
