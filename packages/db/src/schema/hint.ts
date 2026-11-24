import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
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
// KI-16: Regeln der Frühwarnung, zusätzlich zu FS-01
export const earlyWarningRuleKeys = [
  'performance_drop',
  'supplier_commitment_overdue',
  'dependency',
  'feedback_drop',
  'public_event',
] as const;
export const allHintRuleKeys = [...hintRuleKeys, ...earlyWarningRuleKeys] as const;
export const hintStatuses = ['open', 'in_progress', 'accepted', 'dismissed', 'resolved'] as const;
export const hintSeverities = ['high', 'medium', 'low'] as const;

export const hint = pgTable(
  'hint',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    relationshipId: uuid().references(() => relationship.id),
    ruleKey: text({ enum: allHintRuleKeys }).notNull(),
    fingerprint: text().notNull(),
    detail: jsonb().notNull().default({}),
    status: text({ enum: hintStatuses }).notNull().default('open'),
    reason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    decidedBy: text(),
    decidedAt: timestamp({ withTimezone: true }),
    // KI-16: Frühwarnung mit Schwere, Wirkung für die Sortierung, Beleg und nächstem Schritt
    ruleVersion: integer().notNull().default(1),
    severity: text({ enum: hintSeverities }).notNull().default('medium'),
    score: integer().notNull().default(0),
    title: text(),
    evidence: jsonb().notNull().default({}),
    explanationDraftId: uuid(),
    suggestedAction: text(),
    feedback: text({ enum: ['helpful', 'not_helpful'] }),
    ownerUserId: text(),
    firstSeenAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    resolvedAt: timestamp({ withTimezone: true }),
    resolvedReason: text(),
  },
  (table) => [
    check(
      'hint_rule_key',
      sql`${table.ruleKey} in ('segment_spend_only', 'weak_focus', 'unexplained_deviation',
        'too_many_focus', 'no_operational_function', 'cadence_missed', 'no_feedback',
        'plan_missing', 'right_without_obligation', 'buyer_commitments_overdue',
        'performance_drop', 'supplier_commitment_overdue', 'dependency', 'feedback_drop',
        'public_event')`,
    ),
    check(
      'hint_status',
      sql`${table.status} in ('open', 'in_progress', 'accepted', 'dismissed', 'resolved')`,
    ),
    check('hint_severity', sql`${table.severity} in ('high', 'medium', 'low')`),
    check(
      'hint_feedback',
      sql`${table.feedback} is null or ${table.feedback} in ('helpful', 'not_helpful')`,
    ),
    // Verwerfen verlangt eine Begründung.
    check(
      'hint_reason',
      sql`${table.status} <> 'dismissed' or length(trim(coalesce(${table.reason}, ''))) > 0`,
    ),
    index('hint_org_status').on(table.orgId, table.status),
    index('hint_rule').on(table.orgId, table.ruleKey, table.relationshipId),
  ],
);
