import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// SEG-11 (auch PUL-08, SPL-10, QBR-07): Entwürfe der KI. Nur die eigene Organisation sieht sie
// (org_private), der Lieferant nie. Ein Entwurf bleibt Entwurf, bis ihn jemand übernimmt.
// object_type und object_id nennen, wozu der Entwurf gehört (bei SEG-11 die Bewertungsrunde),
// subject den Teil davon (bei SEG-11 das Kriterium). PUL-08: Themen der Freitexte einer Welle
// (object_type survey_wave), nur für die Seite, die sie erzeugt. SPL-10: Strategie-Zusammenfassung
// eines Lieferantenplans (object_type supplier_plan), nur beim Käufer. QBR-07: Zusammenfassung im
// Pre-Read eines Termins (object_type meeting), je Seite getrennt. Kein Fremdschlüssel auf das Objekt, weil
// die Tabelle für mehrere Arten dient.
// WG-09: market_analysis, sechs Marktkräfte und Zusammenschau als JSON (object_type material_group_strategy).
export const aiDraftKinds = [
  'deviation_explanation',
  'feedback_themes',
  'plan_summary',
  'pre_read',
  'market_analysis',
  // KI-11: Anfrage an den Lieferanten zu einer Datenlücke (object_type value_data_gap)
  'data_request',
  // KI-07: interne QBR-Vorbereitung je Termin (object_type meeting)
  'qbr_topics',
  'qbr_risks',
  'qbr_open_points',
  // KI-16: Begründung eines Hinweises (object_type hint)
  'hint_explanation',
] as const;
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
    // Alte Entwürfe haben keine belastbare Zuordnung von Quellen zu Aussagen.
    claims: jsonb().$type<{ key: string; text: string }[]>(),
    runId: uuid(),
    edited: boolean().notNull().default(false),
    dismissReason: text(),
    model: text().notNull(),
    status: text({ enum: aiDraftStatuses }).notNull().default('draft'),
    createdBy: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    decidedBy: text(),
    decidedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    check(
      'ai_draft_kind',
      sql`${table.kind} in ('deviation_explanation', 'feedback_themes', 'plan_summary', 'pre_read', 'market_analysis', 'data_request', 'qbr_topics', 'qbr_risks', 'qbr_open_points', 'hint_explanation')`,
    ),
    check('ai_draft_status', sql`${table.status} in ('draft', 'accepted', 'discarded')`),
    index('ai_draft_run').on(table.orgId, table.runId),
    index('ai_draft_object').on(table.orgId, table.kind, table.objectId),
  ],
);

// WG-23 (für WG-09 gebaut): Quellen eines Entwurfs. Jede Aussage der KI nennt mindestens eine Quelle;
// eigene Daten (own_data) oder öffentliche (public). Nur die eigene Organisation sieht sie.
export const aiSourceKinds = ['own_data', 'public'] as const;

export const aiSource = pgTable(
  'ai_source',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    draftId: uuid().references(() => aiDraft.id, { onDelete: 'cascade' }),
    claimKey: text(),
    objectType: text(),
    objectId: uuid(),
    excerpt: text(),
    targetType: text().notNull(),
    targetId: uuid().notNull(),
    kind: text({ enum: aiSourceKinds }).notNull(),
    title: text().notNull(),
    url: text(),
    publishedAt: date({ mode: 'string' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('ai_source_kind', sql`${table.kind} in ('own_data', 'public')`),
    check('ai_source_title', sql`length(trim(${table.title})) > 0`),
    check(
      'ai_source_claim',
      sql`${table.claimKey} is null or (${table.draftId} is not null and
        ((${table.kind} = 'own_data' and ${table.objectType} is not null and ${table.objectId} is not null)
         or (${table.kind} = 'public' and ${table.url} is not null)))`,
    ),
    index('ai_source_draft_claim').on(table.orgId, table.draftId, table.claimKey),
    index('ai_source_target').on(table.targetType, table.targetId),
  ],
);
