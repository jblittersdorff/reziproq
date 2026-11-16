import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// SEG-11 (auch PUL-08, SPL-10, QBR-07): Entwürfe der KI. Nur die eigene Organisation sieht sie
// (org_private), der Lieferant nie. Ein Entwurf bleibt Entwurf, bis ihn jemand übernimmt.
// object_type und object_id nennen, wozu der Entwurf gehört (bei SEG-11 die Bewertungsrunde),
// subject den Teil davon (bei SEG-11 das Kriterium). PUL-08: Themen der Freitexte einer Welle
// (object_type survey_wave), nur für die Seite, die sie erzeugt. SPL-10: Strategie-Zusammenfassung
// eines Lieferantenplans (object_type supplier_plan), nur beim Käufer. Kein Fremdschlüssel auf das Objekt, weil
// die Tabelle für mehrere Arten dient.
export const aiDraftKinds = ['deviation_explanation', 'feedback_themes', 'plan_summary'] as const;
export const aiDraftStatuses = ['draft', 'accepted', 'discarded'] as const;

export const aiDraft = pgTable(
  'ai_draft',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    relationshipId: uuid().references(() => relationship.id),
    kind: text({ enum: aiDraftKinds }).notNull(),
    objectType: text().notNull(),
    objectId: uuid().notNull(),
    subject: text(),
    content: text().notNull(),
    model: text().notNull(),
    status: text({ enum: aiDraftStatuses }).notNull().default('draft'),
    createdBy: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    decidedBy: text(),
    decidedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    check('ai_draft_kind', sql`${table.kind} in ('deviation_explanation', 'feedback_themes', 'plan_summary')`),
    check('ai_draft_status', sql`${table.status} in ('draft', 'accepted', 'discarded')`),
    index('ai_draft_object').on(table.orgId, table.kind, table.objectId),
  ],
);
