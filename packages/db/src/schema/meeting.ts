import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { organization } from './organization.js';
import { relationship } from './relationship.js';
import { ruleSetItem } from './rule-set.js';

// QBR-01: Termine einer Beziehung. Alles außer den Notizen ist shared mit visibility shared; jede
// Seite ändert nur Zeilen, deren owner_org_id sie ist (PLT-04). Personen stehen als Name ohne
// Fremdschlüssel auf app_user, denn app_user ist für die andere Seite privat.

const sharedColumns = () => ({
  relationshipId: uuid()
    .notNull()
    .references(() => relationship.id),
  ownerOrgId: uuid()
    .notNull()
    .references(() => organization.id),
  visibility: text({ enum: ['internal', 'shared'] })
    .notNull()
    .default('shared'),
});

export const meeting = pgTable(
  'meeting',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    ...sharedColumns(),
    type: text({
      enum: [
        'quarterly_review',
        'strategy_dialogue',
        'jbp',
        'negotiation',
        'site_visit',
        'escalation',
        'format',
        'other',
      ],
    }).notNull(),
    // Format aus den Spielregeln (PLB-03); geteilte Tabelle auf geteilte Tabelle.
    ruleSetItemId: uuid().references(() => ruleSetItem.id, { onDelete: 'set null' }),
    title: text().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    // KI-07: Dauer in Minuten; die Agenda des Briefings füllt sie genau
    durationMinutes: integer().notNull().default(60),
    location: text(),
    status: text({ enum: ['planned', 'held', 'closed'] })
      .notNull()
      .default('planned'),
    protocol: text(),
    createdBy: text().notNull(),
    createdByName: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'meeting_type',
      sql`${table.type} in ('quarterly_review', 'strategy_dialogue', 'jbp', 'negotiation', 'site_visit', 'escalation', 'format', 'other')`,
    ),
    check('meeting_duration', sql`${table.durationMinutes} between 15 and 600`),
    check('meeting_status', sql`${table.status} in ('planned', 'held', 'closed')`),
    check('meeting_title', sql`length(trim(${table.title})) between 1 and 200`),
    index('meeting_relationship').on(table.relationshipId, table.startsAt),
  ],
);

export const meetingParticipant = pgTable(
  'meeting_participant',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    meetingId: uuid()
      .notNull()
      .references(() => meeting.id, { onDelete: 'cascade' }),
    ...sharedColumns(),
    name: text().notNull(),
    position: integer().notNull(),
  },
  (table) => [index('meeting_participant_meeting').on(table.meetingId)],
);

export const meetingAgendaItem = pgTable(
  'meeting_agenda_item',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    meetingId: uuid()
      .notNull()
      .references(() => meeting.id, { onDelete: 'cascade' }),
    ...sharedColumns(),
    title: text().notNull(),
    // KI-07: Zeit, wer führt und Fragen an die andere Seite aus dem geteilten Briefing
    detail: text(),
    position: integer().notNull(),
    linkedObjectType: text(),
    linkedObjectId: uuid(),
  },
  (table) => [index('meeting_agenda_item_meeting').on(table.meetingId)],
);

export const meetingDecision = pgTable(
  'meeting_decision',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    meetingId: uuid()
      .notNull()
      .references(() => meeting.id, { onDelete: 'cascade' }),
    ...sharedColumns(),
    text: text().notNull(),
    position: integer().notNull(),
  },
  (table) => [index('meeting_decision_meeting').on(table.meetingId)],
);

/** Interne Notiz einer Seite zum Termin (org_private); eine je Organisation und Termin. */
export const meetingNote = pgTable(
  'meeting_note',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    meetingId: uuid()
      .notNull()
      .references(() => meeting.id, { onDelete: 'cascade' }),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    text: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('meeting_note_per_org').on(table.meetingId, table.orgId)],
);

/**
 * KI-17: Notizen nach dem Termin, aus denen Reziproq Ergebnisse entwirft (org_private). Der
 * Lieferant sieht sie nie. Jede Auswertung liest die jüngste Zeile; file_key bleibt leer, bis es
 * einen Dateispeicher gibt (KI-18).
 */
export const meetingCapture = pgTable(
  'meeting_capture',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    meetingId: uuid()
      .notNull()
      .references(() => meeting.id, { onDelete: 'cascade' }),
    source: text({ enum: ['typed', 'pasted', 'file'] }).notNull(),
    text: text().notNull(),
    fileKey: text(),
    runId: uuid(),
    createdBy: text().notNull(),
    createdByName: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    // Wann der SRO das Protokoll aus dieser Auswertung geteilt hat
    protocolSharedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    check('meeting_capture_source', sql`${table.source} in ('typed', 'pasted', 'file')`),
    check('meeting_capture_text', sql`length(${table.text}) between 1 and 200000`),
    index('meeting_capture_meeting').on(table.orgId, table.meetingId, table.createdAt),
  ],
);

/**
 * QBR-01b: eingefrorener Stand der Live-Abschnitte beim Abschließen. Ein Archiv, kein zweiter Ort:
 * einer je Termin, danach unveränderlich (Trigger in der Migration).
 */
export const meetingSnapshot = pgTable(
  'meeting_snapshot',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    meetingId: uuid()
      .notNull()
      .references(() => meeting.id, { onDelete: 'cascade' }),
    ...sharedColumns(),
    frozenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    content: jsonb().notNull(),
  },
  // Je Termin einer: Die API setzt erst den Status auf closed (geht nur einmal, Trigger
  // app_meeting_closed_unchanged) und schreibt dann den Stand.
  (table) => [index('meeting_snapshot_meeting').on(table.meetingId)],
);
