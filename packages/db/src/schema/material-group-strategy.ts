import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { appUser } from './app-user.js';
import { materialGroup } from './master-data.js';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// WG-04, WG-06: Strategie je Warengruppe und Jahr in zehn Schritten, mit Leitfragen, „Beobachtung
// und Erklärung“ je Schritt und Sicht, Meilensteinen, Kennzahlen und Zielen. Alles org_private:
// nur die eigene Organisation, der Lieferant nie. In den Specs heißen die Tabellen category_*.

export const strategyStatuses = ['draft', 'resubmit', 'approved'] as const;

export const materialGroupStrategy = pgTable(
  'material_group_strategy',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    materialGroupId: uuid()
      .notNull()
      .references(() => materialGroup.id),
    year: integer().notNull(),
    status: text({ enum: strategyStatuses }).notNull().default('draft'),
    version: integer().notNull().default(1),
    lastSubmittedAt: timestamp({ withTimezone: true }),
    changedSinceSubmission: boolean().notNull().default(false),
    approvedAt: timestamp({ withTimezone: true }),
    createdBy: text()
      .notNull()
      .references(() => appUser.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'material_group_strategy_status',
      sql`${table.status} in ('draft', 'resubmit', 'approved')`,
    ),
    check('material_group_strategy_year', sql`${table.year} between 2000 and 2100`),
    unique('material_group_strategy_once').on(table.materialGroupId, table.year, table.version),
    index('material_group_strategy_org').on(table.orgId, table.year),
  ],
);

/** Leitfragen je Schritt und Sicht; Startbestand aus WG-startdaten.md, je Kunde änderbar */
export const materialGroupQuestion = pgTable(
  'material_group_question',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    step: integer().notNull(),
    view: text(),
    text: text().notNull(),
    position: integer().notNull(),
  },
  (table) => [
    check('material_group_question_step', sql`${table.step} between 1 and 10`),
    index('material_group_question_org').on(table.orgId, table.step),
  ],
);

/** „Beobachtung und Erklärung“ je Schritt und Sicht; nicht zutreffend nur mit Begründung */
export const materialGroupNote = pgTable(
  'material_group_note',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    step: integer().notNull(),
    view: text().notNull().default(''),
    text: text().notNull().default(''),
    notApplicable: boolean().notNull().default(false),
    updatedBy: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('material_group_note_step', sql`${table.step} between 1 and 10`),
    check(
      'material_group_note_reason',
      sql`not ${table.notApplicable} or length(trim(${table.text})) > 0`,
    ),
    uniqueIndex('material_group_note_once').on(table.strategyId, table.step, table.view),
  ],
);

/** Nächste Meilensteine aus dem Aufsetzen (WG-04 Schritt 1) */
export const materialGroupMilestone = pgTable(
  'material_group_milestone',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    dueOn: date().notNull(),
  },
  (table) => [index('material_group_milestone_strategy').on(table.strategyId)],
);

/** WG-06: feste Kennzahlen je Dimension (Zielkategorie); Startbestand zwei je Dimension */
export const materialGroupKpi = pgTable(
  'material_group_kpi',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    dimension: text().notNull(),
    name: text().notNull(),
    description: text(),
    unit: text(),
    source: text(),
    active: boolean().notNull().default(true),
  },
  (table) => [
    uniqueIndex('material_group_kpi_name').on(
      table.orgId,
      table.dimension,
      sql`lower(${table.name})`,
    ),
  ],
);

/** WG-06: Ziel der Strategie an genau einer Kennzahl; zurückgestellt nur mit Begründung */
export const materialGroupGoal = pgTable(
  'material_group_goal',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    kpiId: uuid()
      .notNull()
      .references(() => materialGroupKpi.id),
    text: text().notNull().default(''),
    actual: numeric({ precision: 14, scale: 4 }),
    targetNextYear: numeric({ precision: 14, scale: 4 }),
    targetFinal: numeric({ precision: 14, scale: 4 }),
    targetQuarter: integer(),
    targetYear: integer(),
    deferred: boolean().notNull().default(false),
    deferredReason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'material_group_goal_deferred',
      sql`not ${table.deferred} or length(trim(coalesce(${table.deferredReason}, ''))) > 0`,
    ),
    check('material_group_goal_text', sql`${table.deferred} or length(trim(${table.text})) > 0`),
    check(
      'material_group_goal_quarter',
      sql`${table.targetQuarter} is null or ${table.targetQuarter} between 1 and 4`,
    ),
    index('material_group_goal_strategy').on(table.strategyId),
  ],
);

// WG-07: Sieben Sichten der Analysen (Schritte 3 und 4). data folgt dem Schema der Sicht aus
// @reziproq/shared; Umsatzwerte rechnet der Dienst aus dem Spend, sie stehen nicht hier.
export const analysisViews = [
  'volume',
  'supply_chain',
  'cost',
  'technology',
  'revenue_finance',
  'quality',
  'footprint',
] as const;

export const materialGroupAnalysis = pgTable(
  'material_group_analysis',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    view: text({ enum: analysisViews }).notNull(),
    data: jsonb().notNull().default({}),
    updatedBy: text()
      .notNull()
      .references(() => appUser.id),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'material_group_analysis_view',
      sql`${table.view} in ('volume', 'supply_chain', 'cost', 'technology', 'revenue_finance', 'quality', 'footprint')`,
    ),
    // Kartellrecht: In der Kostensicht steht nie ein Lieferant (WG-07).
    check(
      'material_group_analysis_cost_supplier',
      sql`${table.view} <> 'cost' or not (${table.data}::text ~* '"(relationship_?id|supplier[a-z_]*)"')`,
    ),
    uniqueIndex('material_group_analysis_once').on(table.strategyId, table.view),
  ],
);

/**
 * WG-07 (Schritt 24): Lead oder Commodity Manager weist einer Person mit Funktion im Team einzelne
 * Sichten zu; sie kommentiert nur diese. Die Kostensicht wird nie zugewiesen.
 */
export const materialGroupViewAssignment = pgTable(
  'material_group_view_assignment',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    view: text({ enum: analysisViews }).notNull(),
    userId: text()
      .notNull()
      .references(() => appUser.id),
    assignedBy: text()
      .notNull()
      .references(() => appUser.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('material_group_view_assignment_once').on(table.strategyId, table.view, table.userId),
    check('material_group_view_assignment_no_cost', sql`${table.view} <> 'cost'`),
  ],
);

/** WG-07 (Schritt 24): Kommentar zu einer Sicht der Strategie, nur für das Team */
export const materialGroupViewComment = pgTable(
  'material_group_view_comment',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    view: text({ enum: analysisViews }).notNull(),
    authorUserId: text()
      .notNull()
      .references(() => appUser.id),
    body: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('material_group_view_comment_strategy').on(table.strategyId, table.view),
    check(
      'material_group_view_comment_body',
      sql`length(trim(${table.body})) between 1 and 2000`,
    ),
  ],
);

/** WG-07 Footprint: weitere verfügbare Lieferanten, die noch nicht zur Basis gehören */
export const materialGroupCandidate = pgTable(
  'material_group_candidate',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    site: text(),
    // Zusätzlich zur Spec: Land des Standorts, damit „Als Lieferant anlegen“ ein Land hat
    country: text(),
    revenueCents: bigint({ mode: 'number' }),
    currency: text().notNull().default('EUR'),
    isSupplier: boolean().notNull().default(false),
    comment: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('material_group_candidate_name', sql`length(trim(${table.name})) > 0`),
    check(
      'material_group_candidate_country',
      sql`${table.country} is null or ${table.country} ~ '^[A-Z]{2}$'`,
    ),
    check(
      'material_group_candidate_revenue',
      sql`${table.revenueCents} is null or ${table.revenueCents} >= 0`,
    ),
    index('material_group_candidate_strategy').on(table.strategyId),
  ],
);

// WG-09: Sechs Marktkräfte je Strategie. Ein Entwurf (draft) wird erst durch eine Person bestätigt;
// ein neuer Entwurf neben bestätigtem Stand liegt in proposal und ersetzt nichts stillschweigend.
export const marketForces = [
  'supplier_power',
  'customer_power',
  'new_entrants',
  'substitutes',
  'external_factors',
  'rivalry',
] as const;
export const marketForceStatuses = ['draft', 'confirmed'] as const;

export const materialGroupMarketForce = pgTable(
  'material_group_market_force',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    force: text({ enum: marketForces }).notNull(),
    today: text({ enum: ['low', 'high'] }),
    future: text({ enum: ['low', 'high'] }),
    relevant: boolean(),
    // [{ text, sourceIds }]
    points: jsonb().notNull().default([]),
    status: text({ enum: marketForceStatuses }).notNull().default('draft'),
    confirmedBy: text().references(() => appUser.id),
    confirmedAt: timestamp({ withTimezone: true }),
    // Neuer Entwurf neben bestätigtem Stand: { today, future, relevant, points, draftId }
    proposal: jsonb(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'material_group_market_force_force',
      sql`${table.force} in ('supplier_power', 'customer_power', 'new_entrants', 'substitutes', 'external_factors', 'rivalry')`,
    ),
    check(
      'material_group_market_force_levels',
      sql`(${table.today} is null or ${table.today} in ('low', 'high')) and (${table.future} is null or ${table.future} in ('low', 'high'))`,
    ),
    check('material_group_market_force_status', sql`${table.status} in ('draft', 'confirmed')`),
    check(
      'material_group_market_force_confirmed',
      sql`${table.status} <> 'confirmed' or (${table.today} is not null and ${table.future} is not null and ${table.relevant} is not null and ${table.confirmedBy} is not null)`,
    ),
    uniqueIndex('material_group_market_force_once').on(table.strategyId, table.force),
  ],
);

// WG-10: Profil aus Stärken, Schwächen, Chancen und Risiken; Paarung je ein interner und ein externer
// Eintrag mit einem Hebel aus dem Katalog des Kunden. In der Spec category_swot_item, lever,
// category_lever_choice.
export const swotTypes = ['strength', 'weakness', 'opportunity', 'threat'] as const;

export const materialGroupSwotItem = pgTable(
  'material_group_swot_item',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    type: text({ enum: swotTypes }).notNull(),
    code: text().notNull(),
    text: text().notNull(),
    originStep: integer(),
    originView: text(),
    status: text({ enum: ['draft', 'confirmed'] })
      .notNull()
      .default('confirmed'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'material_group_swot_item_type',
      sql`${table.type} in ('strength', 'weakness', 'opportunity', 'threat')`,
    ),
    check('material_group_swot_item_status', sql`${table.status} in ('draft', 'confirmed')`),
    check('material_group_swot_item_text', sql`length(trim(${table.text})) > 0`),
    check('material_group_swot_item_code', sql`${table.code} ~ '^[SWOT][0-9]+$'`),
    uniqueIndex('material_group_swot_item_code_once').on(table.strategyId, table.code),
  ],
);

export const strategyLever = pgTable(
  'lever',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    name: text().notNull(),
    description: text().notNull().default(''),
    // Zieldimensionen (WG-06), die erste ist die Hauptwirkung
    dimensions: text().array().notNull().default(sql`'{}'::text[]`),
    active: boolean().notNull().default(true),
    custom: boolean().notNull().default(false),
    // Ein eigener Hebel verlangt eine Begründung (WG-10).
    reason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('lever_name', sql`length(trim(${table.name})) > 0`),
    check(
      'lever_custom_reason',
      sql`not ${table.custom} or length(trim(coalesce(${table.reason}, ''))) > 0`,
    ),
    uniqueIndex('lever_name_once').on(table.orgId, sql`lower(${table.name})`),
  ],
);

export const leverChoiceStatuses = ['proposed', 'chosen', 'dismissed'] as const;

export const materialGroupLeverChoice = pgTable(
  'material_group_lever_choice',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    internalItemId: uuid()
      .notNull()
      .references(() => materialGroupSwotItem.id, { onDelete: 'cascade' }),
    externalItemId: uuid()
      .notNull()
      .references(() => materialGroupSwotItem.id, { onDelete: 'cascade' }),
    leverId: uuid()
      .notNull()
      .references(() => strategyLever.id),
    reason: text().notNull().default(''),
    status: text({ enum: leverChoiceStatuses }).notNull().default('chosen'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'material_group_lever_choice_status',
      sql`${table.status} in ('proposed', 'chosen', 'dismissed')`,
    ),
    check(
      'material_group_lever_choice_reason',
      sql`${table.status} <> 'chosen' or length(trim(${table.reason})) > 0`,
    ),
    index('material_group_lever_choice_strategy').on(table.strategyId),
  ],
);

/**
 * WG-12 (Schritt 27): Initiative der Warengruppe. Zahlt auf genau ein Ziel ein und gehört zu genau
 * einer gewählten Hebelwahl. Privat; sie ist nicht die geteilte `initiative` des Impact-Ledgers.
 */
export const materialGroupInitiative = pgTable(
  'material_group_initiative',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    goalId: uuid()
      .notNull()
      .references(() => materialGroupGoal.id, { onDelete: 'cascade' }),
    leverChoiceId: uuid()
      .notNull()
      .references(() => materialGroupLeverChoice.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    effect: text().notNull().default(''),
    actual: numeric({ precision: 14, scale: 4 }),
    target: numeric({ precision: 14, scale: 4 }),
    ownerUserId: text().references(() => appUser.id),
    targetQuarter: integer(),
    targetYear: integer(),
    // Fortschritt in Prozent, meldet die verantwortliche Person
    progress: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('material_group_initiative_name', sql`length(trim(${table.name})) between 1 and 200`),
    check('material_group_initiative_progress', sql`${table.progress} between 0 and 100`),
    check(
      'material_group_initiative_quarter',
      sql`${table.targetQuarter} is null or ${table.targetQuarter} between 1 and 4`,
    ),
    index('material_group_initiative_strategy').on(table.strategyId),
  ],
);

/** WG-12: Lieferanten der Warengruppe an einer Initiative (je Beziehung, Entscheidung vom 23.11.) */
export const materialGroupInitiativeSupplier = pgTable(
  'material_group_initiative_supplier',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    initiativeId: uuid()
      .notNull()
      .references(() => materialGroupInitiative.id, { onDelete: 'cascade' }),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
  },
  (table) => [
    unique('material_group_initiative_supplier_once').on(table.initiativeId, table.relationshipId),
  ],
);

/** WG-12: Quartals-Review einer freigegebenen Strategie; je Strategie und Fälligkeit genau eines */
export const materialGroupReview = pgTable(
  'material_group_review',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    dueOn: date().notNull(),
    heldAt: timestamp({ withTimezone: true }),
    heldBy: text().references(() => appUser.id),
    summary: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('material_group_review_once').on(table.strategyId, table.dueOn),
    check(
      'material_group_review_held',
      sql`${table.heldAt} is null or length(trim(coalesce(${table.summary}, ''))) > 0`,
    ),
  ],
);


/**
 * WG-15: Zeile der Supplier Map je Strategie und Lieferant (Beziehung). Standort, Umsatzanteil Soll
 * (ganze Prozent) und Zieljahr gehören der Map; der Soll-Typ ist das Soll der Segmententscheidung
 * der Warengruppe (Gründer, 23.11.2026). Nur „beenden“ steht hier, weil eine Segmententscheidung
 * immer ein Segment trägt.
 */
export const materialGroupSupplierMapRow = pgTable(
  'material_group_supplier_map_row',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    site: text(),
    shareTarget: integer(),
    targetYear: integer(),
    ended: boolean().notNull().default(false),
    updatedBy: text().references(() => appUser.id),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('material_group_supplier_map_row_once').on(table.strategyId, table.relationshipId),
    check(
      'material_group_supplier_map_row_share',
      sql`${table.shareTarget} is null or ${table.shareTarget} between 0 and 100`,
    ),
    check(
      'material_group_supplier_map_row_year',
      sql`${table.targetYear} is not null or (${table.shareTarget} is null and not ${table.ended})`,
    ),
  ],
);

/**
 * WG-14: Vergabe im Vergabeplan einer Strategie. Anfragezeitraum als Balken, Vergabedatum als Punkt;
 * gleicher `bundle_key` heißt gebündelt. Die Auswahl selbst fällt außerhalb von Reziproq.
 */
export const materialGroupAward = pgTable(
  'material_group_award',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    volumeCents: bigint({ mode: 'number' }),
    currency: text().notNull().default('EUR'),
    requestFrom: date(),
    requestTo: date(),
    awardDate: date(),
    bundleKey: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('material_group_award_name', sql`length(trim(${table.name})) > 0`),
    check(
      'material_group_award_volume',
      sql`${table.volumeCents} is null or ${table.volumeCents} >= 0`,
    ),
    check(
      'material_group_award_request',
      sql`${table.requestFrom} is null or ${table.requestTo} is null or ${table.requestFrom} <= ${table.requestTo}`,
    ),
    index('material_group_award_strategy').on(table.strategyId),
  ],
);

/**
 * WG-14: möglicher Lieferant einer Vergabe: eine Beziehung der Warengruppe oder ein Kandidat aus
 * der Lieferkettensicht (WG-07; Gründer, 23.11.2026), genau eins von beiden.
 */
export const materialGroupAwardSupplier = pgTable(
  'material_group_award_supplier',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    awardId: uuid()
      .notNull()
      .references(() => materialGroupAward.id, { onDelete: 'cascade' }),
    relationshipId: uuid().references(() => relationship.id),
    candidateId: uuid().references(() => materialGroupCandidate.id, { onDelete: 'cascade' }),
    note: text(),
  },
  (table) => [
    check(
      'material_group_award_supplier_one',
      sql`(${table.relationshipId} is null) <> (${table.candidateId} is null)`,
    ),
    unique('material_group_award_supplier_relationship').on(table.awardId, table.relationshipId),
    unique('material_group_award_supplier_candidate').on(table.awardId, table.candidateId),
  ],
);

/**
 * WG-16: Strategische Relevanz einer Warengruppe je Jahr. Zehn Einschätzungen 1 bis 6, je
 * Zieldimension „Wirkung“ und „Risiko“ (Gründer, 23.11.2026); `score` ist ihr Mittelwert. Admins
 * übersteuern mit Begründung.
 */
export const materialGroupRelevance = pgTable(
  'material_group_relevance',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    materialGroupId: uuid()
      .notNull()
      .references(() => materialGroup.id),
    year: integer().notNull(),
    scores: jsonb().notNull().default({}),
    score: numeric({ precision: 3, scale: 2 }),
    override: text({ enum: ['high', 'low'] }),
    overrideReason: text(),
    updatedBy: text().references(() => appUser.id),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('material_group_relevance_once').on(table.materialGroupId, table.year),
    check(
      'material_group_relevance_override',
      sql`${table.override} is null or (${table.override} in ('high', 'low') and length(trim(coalesce(${table.overrideReason}, ''))) > 0)`,
    ),
  ],
);

/** WG-16: Zusammenfassung der Strategie in drei Teilen; vorlegen erst, wenn bestätigt */
export const materialGroupSummary = pgTable(
  'material_group_summary',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    statusQuo: text().notNull().default(''),
    targetState: text().notNull().default(''),
    roadmap: text().notNull().default(''),
    status: text({ enum: ['draft', 'confirmed'] })
      .notNull()
      .default('draft'),
    /** Stand der drei Teile bei der letzten Vorlage, für „geändert seit der letzten Vorlage“ */
    submitted: jsonb(),
    updatedBy: text().references(() => appUser.id),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('material_group_summary_once').on(table.strategyId),
    check('material_group_summary_status', sql`${table.status} in ('draft', 'confirmed')`),
  ],
);

/**
 * WG-16: Unterschrift je Vorlage: Lead, Commodity Manager und Freigebende des Freigabewegs. Alle
 * Eingestellten unterschreiben (Gründer, 23.11.2026); `submitted_at` ordnet sie einer Vorlage zu.
 */
export const materialGroupApproval = pgTable(
  'material_group_approval',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    submittedAt: timestamp({ withTimezone: true }).notNull(),
    role: text({ enum: ['lead', 'commodity_manager', 'approver'] }).notNull(),
    userId: text()
      .notNull()
      .references(() => appUser.id),
    status: text({ enum: ['open', 'signed', 'returned'] })
      .notNull()
      .default('open'),
    comment: text(),
    decidedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    unique('material_group_approval_once').on(
      table.strategyId,
      table.submittedAt,
      table.role,
      table.userId,
    ),
    check(
      'material_group_approval_role',
      sql`${table.role} in ('lead', 'commodity_manager', 'approver')`,
    ),
    check('material_group_approval_status', sql`${table.status} in ('open', 'signed', 'returned')`),
    check(
      'material_group_approval_comment',
      sql`${table.status} <> 'returned' or length(trim(coalesce(${table.comment}, ''))) > 0`,
    ),
    index('material_group_approval_user').on(table.userId, table.status),
  ],
);

/**
 * WG-20: Widerspruch zwischen Warengruppen je Lieferant (Beziehung). `fingerprint` beschreibt die
 * Lage; ein abgestimmter oder hingenommener Widerspruch kommt nur mit neuer Lage wieder. Die
 * Zeilen bleiben als Verlauf stehen.
 */
export const materialGroupConflict = pgTable(
  'material_group_conflict',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ruleKey: text().notNull(),
    fingerprint: text().notNull(),
    materialGroupIds: uuid().array().notNull(),
    status: text({ enum: ['open', 'aligned', 'accepted'] })
      .notNull()
      .default('open'),
    note: text(),
    decidedBy: text().references(() => appUser.id),
    decidedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('material_group_conflict_once').on(table.relationshipId, table.ruleKey, table.fingerprint),
    check(
      'material_group_conflict_rule',
      sql`${table.ruleKey} in ('phase_out_vs_growth', 'relationship_mixed', 'concentration', 'award_vs_target')`,
    ),
    check('material_group_conflict_status', sql`${table.status} in ('open', 'aligned', 'accepted')`),
    check(
      'material_group_conflict_note',
      sql`${table.status} = 'open' or length(trim(coalesce(${table.note}, ''))) > 0`,
    ),
    index('material_group_conflict_relationship').on(table.relationshipId, table.status),
  ],
);
