import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { appUser, userFunctions } from './app-user.js';
import { businessUnit, materialGroup } from './master-data.js';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// SEG-03: Bewertungsrunden. Die Runde gehört der Käuferorganisation (org_private); die
// Zuordnungen hängen an der Beziehung (buyer_private). Beides sieht der Lieferant nie.

export const roundStatuses = ['draft', 'open', 'closed'] as const;
export const assignmentStatuses = ['open', 'in_progress', 'submitted'] as const;
// WG-18: Eine Runde gilt dem ganzen Portfolio oder einer Warengruppe.
export const roundScopes = ['portfolio', 'category'] as const;

export const segmentationRound = pgTable(
  'segmentation_round',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organization.id),
    name: text().notNull(),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    status: text({ enum: roundStatuses }).notNull().default('draft'),
    scope: text({ enum: roundScopes }).notNull().default('portfolio'),
    materialGroupId: uuid('material_group_id').references(() => materialGroup.id),
    // Die beim Start aktive Modellversion; spätere Aktivierungen ändern sie nicht.
    modelVersion: smallint('model_version'),
    createdBy: text('created_by')
      .notNull()
      .references(() => appUser.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    // Gesetzt von der Konsolidierung (SEG-06); danach sehen alle Käufer-Nutzer alle Bewertungen.
    consolidatedAt: timestamp('consolidated_at', { withTimezone: true }),
  },
  (table) => [
    check('segmentation_round_status', sql`${table.status} in ('draft', 'open', 'closed')`),
    check(
      'segmentation_round_model_version',
      sql`(${table.status} = 'draft' and ${table.modelVersion} is null) or
        (${table.status} in ('open', 'closed') and ${table.modelVersion} > 0)`,
    ),
    check(
      'segmentation_round_scope',
      sql`(${table.scope} = 'portfolio' and ${table.materialGroupId} is null) or
        (${table.scope} = 'category' and ${table.materialGroupId} is not null)`,
    ),
    index('segmentation_round_org').on(table.orgId),
  ],
);

export const ratingAssignment = pgTable(
  'rating_assignment',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    roundId: uuid('round_id')
      .notNull()
      .references(() => segmentationRound.id),
    relationshipId: uuid('relationship_id')
      .notNull()
      .references(() => relationship.id),
    businessUnitId: uuid('business_unit_id')
      .notNull()
      .references(() => businessUnit.id),
    materialGroupId: uuid('material_group_id').references(() => materialGroup.id),
    function: text({ enum: userFunctions }).notNull(),
    // Im Entwurf darf die Stelle noch unbesetzt sein; beim Start muss jede besetzt sein.
    raterUserId: text('rater_user_id').references(() => appUser.id),
    status: text({ enum: assignmentStatuses }).notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('rating_assignment_status', sql`${table.status} in ('open', 'in_progress', 'submitted')`),
    check(
      'rating_assignment_function',
      sql`${table.function} in ('purchasing', 'quality', 'engineering', 'logistics', 'programs', 'after_sales')`,
    ),
    uniqueIndex('rating_assignment_once').on(
      table.roundId,
      table.relationshipId,
      table.businessUnitId,
      sql`coalesce(${table.materialGroupId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      table.function,
    ),
    index('rating_assignment_rater').on(table.raterUserId),
    index('rating_assignment_round').on(table.roundId),
  ],
);

// SEG-04: Eine Zeile je Zuordnung und Kriterium. Ist und Soll sind im Entwurf einzeln leer
// möglich; beim Abgeben müssen alle Kriterien beide Werte haben.
export const rating = pgTable(
  'rating',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => ratingAssignment.id),
    relationshipId: uuid('relationship_id')
      .notNull()
      .references(() => relationship.id),
    criterionKey: text('criterion_key').notNull(),
    modelVersion: smallint('model_version').notNull(),
    ist: integer(),
    soll: integer(),
    comment: text(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
  },
  (table) => [
    check('rating_ist', sql`${table.ist} is null or ${table.ist} between 0 and 100`),
    check('rating_soll', sql`${table.soll} is null or ${table.soll} between 0 and 100`),
    uniqueIndex('rating_once').on(table.assignmentId, table.criterionKey),
    index('rating_relationship').on(table.relationshipId),
  ],
);

// WG-18: `category` ist das Segment in einer Warengruppe; es hat eine eigene Versionsfolge je
// Lieferant und Warengruppe und zählt nie zur Konsolidierung aus SEG-06.
export const decisionScopes = ['total', 'bu_mg', 'category'] as const;
export const decisionOrigins = ['round', 'manual', 'merged'] as const;

// SEG-06: Die Unternehmenssicht des SRO. Jede Konsolidierung schreibt Zeilen mit höherer
// Version; alte Zeilen bleiben unverändert (nur anfügen). Typen stehen als Stufen je Achse,
// weil ein Typ erst mit der Modellversion eindeutig ist.
export const segmentDecision = pgTable(
  'segment_decision',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid('relationship_id')
      .notNull()
      .references(() => relationship.id),
    scope: text({ enum: decisionScopes }).notNull(),
    businessUnitId: uuid('business_unit_id').references(() => businessUnit.id),
    materialGroupId: uuid('material_group_id').references(() => materialGroup.id),
    istImpactLevel: smallint('ist_impact_level').notNull(),
    istQualityLevel: smallint('ist_quality_level').notNull(),
    sollImpactLevel: smallint('soll_impact_level').notNull(),
    sollQualityLevel: smallint('soll_quality_level').notNull(),
    reason: text().notNull(),
    modelVersion: smallint('model_version').notNull(),
    decidedBy: text('decided_by')
      .notNull()
      .references(() => appUser.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer().notNull(),
    origin: text({ enum: decisionOrigins }).notNull().default('round'),
  },
  (table) => [
    check('segment_decision_scope', sql`${table.scope} in ('total', 'bu_mg', 'category')`),
    check(
      'segment_decision_target',
      sql`(${table.scope} = 'total' and ${table.businessUnitId} is null) or
        (${table.scope} = 'bu_mg' and ${table.businessUnitId} is not null) or
        (${table.scope} = 'category' and ${table.businessUnitId} is null and ${table.materialGroupId} is not null)`,
    ),
    check('segment_decision_origin', sql`${table.origin} in ('round', 'manual', 'merged')`),
    check(
      'segment_decision_levels',
      sql`${table.istImpactLevel} between 1 and 3 and ${table.istQualityLevel} between 1 and 3
        and ${table.sollImpactLevel} between 1 and 3 and ${table.sollQualityLevel} between 1 and 3`,
    ),
    check('segment_decision_reason', sql`length(btrim(${table.reason})) > 0`),
    index('segment_decision_relationship').on(table.relationshipId, table.version),
    // Je Lieferant und Warengruppe gilt die höchste Version; jede Version gibt es nur einmal.
    uniqueIndex('segment_decision_category_version')
      .on(table.relationshipId, table.materialGroupId, table.version)
      .where(sql`${table.scope} = 'category'`),
  ],
);
