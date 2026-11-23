import { sql } from 'drizzle-orm';
import { check, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { organization } from './organization.js';

/**
 * AW-01, NAV-10: Aussage von Reziproq je Seite. Gespeichert je Person (Entscheidung F3 vom
 * 23.11.2026), damit niemand eine Zusammenfassung aus Zahlen sieht, die er nicht sehen darf. Neu
 * geschrieben nur bei geänderten Fakten (facts_hash), höchstens einmal je Stunde. org_private.
 */
export const insightSummary = pgTable(
  'insight_summary',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text().notNull(),
    pageKey: text().notNull(),
    scopeType: text({ enum: ['org', 'relationship', 'category'] }).notNull(),
    scopeId: uuid(),
    period: text().notNull(),
    facts: jsonb().$type<unknown[]>().notNull(),
    factsHash: text().notNull(),
    headline: text(),
    body: text(),
    sentences: jsonb().$type<Record<string, string>>().notNull().default({}),
    status: text({ enum: ['shown', 'suppressed'] }).notNull(),
    suppressedReason: text(),
    reportedAt: timestamp({ withTimezone: true }),
    generatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('insight_summary_status', sql`${table.status} in ('shown', 'suppressed')`),
    check('insight_summary_scope', sql`${table.scopeType} in ('org', 'relationship', 'category')`),
    check(
      'insight_summary_shown',
      sql`${table.status} <> 'shown' or (${table.headline} is not null and ${table.body} is not null)`,
    ),
    unique('insight_summary_once')
      .on(table.orgId, table.userId, table.pageKey, table.scopeType, table.scopeId, table.period)
      .nullsNotDistinct(),
  ],
);
