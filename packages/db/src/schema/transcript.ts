import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { meeting } from './meeting.js';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// IN-05: Transkripte aus Teams, Meet oder Upload, nur beim Käufer (org_private). Reziproq holt nur
// Text, nie Audio, Video oder Aufzeichnungen. Das Rohtranskript liegt verschlüsselt in der
// Dateiablage (entries_ref) und wird nach der Aufbewahrungsfrist gelöscht; Entwürfe bleiben.

export const transcriptSources = ['teams', 'meet', 'upload'] as const;
export const transcriptStatuses = ['pending', 'fetched', 'unavailable', 'deleted'] as const;

export interface TranscriptSpeaker {
  /** Name im Transkript */
  label: string;
  /** Zugeordneter Teilnehmer, sonst „Teilnehmer 1, 2 …“ */
  name: string;
  side: 'buyer' | 'supplier' | 'unknown';
}

export const meetingTranscript = pgTable(
  'meeting_transcript',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id, { onDelete: 'cascade' }),
    meetingId: uuid()
      .notNull()
      .references(() => meeting.id, { onDelete: 'cascade' }),
    source: text({ enum: transcriptSources }).notNull(),
    externalId: text(),
    language: text(),
    durationS: integer(),
    speakers: jsonb().$type<TranscriptSpeaker[]>().notNull().default([]),
    // Verschlüsselte Datei in der Ablage (Zeit, Sprecher, Text); leer nach dem Löschen
    entriesRef: text(),
    keyRef: text(),
    fetchedAt: timestamp({ withTimezone: true }),
    deleteAfter: timestamp({ withTimezone: true }),
    status: text({ enum: transcriptStatuses }).notNull(),
    unavailableReason: text(),
    // Meet: Abruf bis 48 Stunden nach Ende wiederholen
    attempts: integer().notNull().default(0),
    lastAttemptAt: timestamp({ withTimezone: true }),
    // Rohtext auch für Teilnehmer der Käuferseite, wenn der SRO ihn freigibt
    releasedToParticipants: boolean().notNull().default(false),
    createdBy: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    check('meeting_transcript_source', sql`${table.source} in ('teams', 'meet', 'upload')`),
    check(
      'meeting_transcript_status',
      sql`${table.status} in ('pending', 'fetched', 'unavailable', 'deleted')`,
    ),
    index('meeting_transcript_meeting').on(table.meetingId, table.createdAt),
    index('meeting_transcript_delete').on(table.status, table.deleteAfter),
  ],
);
