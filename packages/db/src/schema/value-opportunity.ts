import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

const orgId = () =>
  uuid()
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' });
const relationshipId = () =>
  uuid()
    .notNull()
    .references(() => relationship.id);
const time = () => timestamp({ withTimezone: true });

export const valueOpportunityStatuses = [
  'new',
  'adopted',
  'dismissed',
  'superseded',
  'realized',
] as const;

/**
 * KI-11: Wertpotenzial je Beziehung und Hebel-Vorlage, org_private. Zahlen rechnet nur der Code
 * nach der Vorlage; inputs hält je Eingabe Spanne und Herkunft. run_id verweist auf agent_run
 * ohne Fremdschlüssel, adopted_topic_id auf das geteilte JBP-Thema.
 */
export const valueOpportunity = pgTable(
  'value_opportunity',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: orgId(),
    relationshipId: relationshipId(),
    runId: uuid(),
    templateKey: text().notNull(),
    templateVersion: integer().notNull(),
    title: text().notNull(),
    reason: text().notNull(),
    impactType: text({ enum: ['ebit', 'cash', 'cost_avoidance'] }).notNull(),
    buyerLowCents: bigint({ mode: 'number' }).notNull(),
    buyerHighCents: bigint({ mode: 'number' }).notNull(),
    supplierLowCents: bigint({ mode: 'number' }),
    supplierHighCents: bigint({ mode: 'number' }),
    supplierEffect: text(),
    currency: text().notNull().default('EUR'),
    confidence: text({ enum: ['high', 'medium', 'low'] }).notNull(),
    confidenceReason: text().notNull(),
    inputs: jsonb().$type<Record<string, unknown>>().notNull(),
    signalIds: jsonb().$type<string[]>().notNull().default([]),
    status: text({ enum: valueOpportunityStatuses }).notNull().default('new'),
    dismissReason: text(),
    adoptedTopicId: uuid(),
    initiativeId: uuid(),
    createdAt: time().notNull().defaultNow(),
    decidedBy: text(),
    decidedAt: time(),
  },
  (table) => [
    check('value_opportunity_impact', sql`${table.impactType} in ('ebit', 'cash', 'cost_avoidance')`),
    check('value_opportunity_confidence', sql`${table.confidence} in ('high', 'medium', 'low')`),
    check(
      'value_opportunity_status',
      sql`${table.status} in ('new', 'adopted', 'dismissed', 'superseded', 'realized')`,
    ),
    check(
      'value_opportunity_range',
      sql`${table.buyerLowCents} <= ${table.buyerHighCents}
        and (${table.supplierLowCents} is null) = (${table.supplierHighCents} is null)
        and (${table.supplierLowCents} is null or ${table.supplierLowCents} <= ${table.supplierHighCents})`,
    ),
    check(
      'value_opportunity_dismiss',
      sql`${table.status} <> 'dismissed' or length(trim(coalesce(${table.dismissReason}, ''))) > 0`,
    ),
    index('value_opportunity_relationship').on(table.relationshipId, table.status),
  ],
);

export const valueSignalKinds = [
  'raw_material',
  'market_capacity',
  'supplier_public',
  'tariff_regulation',
  'technology',
] as const;
export const valueSignalOutcomes = ['opportunity', 'topic', 'data_gap', 'no_effect'] as const;

/** KI-11: Marktsignal mit datierter Quelle und genau einem Ergebnis, org_private. */
export const valueMarketSignal = pgTable(
  'value_market_signal',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: orgId(),
    relationshipId: relationshipId(),
    runId: uuid(),
    kind: text({ enum: valueSignalKinds }).notNull(),
    title: text().notNull(),
    summary: text().notNull(),
    direction: text({ enum: ['relief', 'burden', 'neutral'] }).notNull(),
    sources: jsonb()
      .$type<{ title: string; url: string; publishedOn: string; excerpt: string }[]>()
      .notNull(),
    outcome: text({ enum: valueSignalOutcomes }).notNull(),
    outcomeReason: text().notNull(),
    observedAt: time().notNull().defaultNow(),
  },
  (table) => [
    check(
      'value_market_signal_kind',
      sql`${table.kind} in ('raw_material', 'market_capacity', 'supplier_public', 'tariff_regulation', 'technology')`,
    ),
    check(
      'value_market_signal_outcome',
      sql`${table.outcome} in ('opportunity', 'topic', 'data_gap', 'no_effect')`,
    ),
    check('value_market_signal_direction', sql`${table.direction} in ('relief', 'burden', 'neutral')`),
    check('value_market_signal_sources', sql`jsonb_array_length(${table.sources}) > 0`),
    index('value_market_signal_relationship').on(table.relationshipId, table.observedAt),
  ],
);

/** KI-11: fehlende Eingabe statt eines Potenzials, org_private. */
export const valueDataGap = pgTable(
  'value_data_gap',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: orgId(),
    relationshipId: relationshipId(),
    runId: uuid(),
    dataKey: text().notNull(),
    description: text().notNull(),
    templatesBlocked: jsonb().$type<string[]>().notNull(),
    signalId: uuid(),
    status: text({ enum: ['open', 'requested', 'closed'] }).notNull().default('open'),
    createdAt: time().notNull().defaultNow(),
  },
  (table) => [
    check('value_data_gap_status', sql`${table.status} in ('open', 'requested', 'closed')`),
    index('value_data_gap_relationship').on(table.relationshipId, table.status),
  ],
);
