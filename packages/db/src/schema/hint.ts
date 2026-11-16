import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// FS-01: Hinweise auf typische Fehler im Lieferantenmanagement. Nur die eigene Organisation sieht
// sie (org_private), der Lieferant nie. Der fingerprint beschreibt die Lage; ein verworfener Hinweis
// kommt erst wieder, wenn sich die Lage ändert. detail hält die Zahlen für den Satz, warum.
export const hintRuleKeys = [
  'segment_spend_only',
  'weak_focus',
  'unexplained_deviation',
  'too_many_focus',
  'no_operational_function',
  'cadence_missed',
  'no_feedback',
  'plan_missing',
  'right_without_obligation',
  'buyer_commitments_overdue',
] as const;
export const hintStatuses = ['open', 'accepted', 'dismissed'] as const;

export const hint = pgTable(
  'hint',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    relationshipId: uuid().references(() => relationship.id),
    ruleKey: text({ enum: hintRuleKeys }).notNull(),
    fingerprint: text().notNull(),
    detail: jsonb().notNull().default({}),
    status: text({ enum: hintStatuses }).notNull().default('open'),
    reason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    decidedBy: text(),
    decidedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    check(
      'hint_rule_key',
      sql`${table.ruleKey} in ('segment_spend_only', 'weak_focus', 'unexplained_deviation',
        'too_many_focus', 'no_operational_function', 'cadence_missed', 'no_feedback',
        'plan_missing', 'right_without_obligation', 'buyer_commitments_overdue')`,
    ),
    check('hint_status', sql`${table.status} in ('open', 'accepted', 'dismissed')`),
    // Verwerfen verlangt eine Begründung.
    check(
      'hint_reason',
      sql`${table.status} <> 'dismissed' or length(trim(coalesce(${table.reason}, ''))) > 0`,
    ),
    index('hint_org_status').on(table.orgId, table.status),
    index('hint_rule').on(table.orgId, table.ruleKey, table.relationshipId),
  ],
);
