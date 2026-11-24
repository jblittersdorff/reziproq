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
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { meeting } from './meeting.js';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// IN-03: Termine aus Outlook, Eingangsadresse und Kalender. Alles org_private beim Käufer; der
// Lieferant sieht nichts davon (Entscheidung F6: daraus entstehen interne Termine).

const orgId = () =>
  uuid()
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' });
const time = () => timestamp({ withTimezone: true });

/** Teilnehmer eines Termins mit Mail und Seite; nur beim Käufer. */
export const meetingAttendee = pgTable(
  'meeting_attendee',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: orgId(),
    meetingId: uuid()
      .notNull()
      .references(() => meeting.id, { onDelete: 'cascade' }),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id, { onDelete: 'cascade' }),
    email: text().notNull(),
    name: text(),
    side: text({ enum: ['buyer', 'supplier', 'unknown'] }).notNull(),
    userId: text(),
    supplierContactId: uuid(),
    response: text(),
  },
  (table) => [
    check('meeting_attendee_side', sql`${table.side} in ('buyer', 'supplier', 'unknown')`),
    index('meeting_attendee_meeting').on(table.meetingId),
  ],
);

/** Mail-Domains eines Lieferanten: aus Kontakten, von Hand oder gelernt aus „Neu eingegangen“. */
export const supplierDomain = pgTable(
  'supplier_domain',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: orgId(),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id, { onDelete: 'cascade' }),
    domain: text().notNull(),
    source: text({ enum: ['contact', 'manual', 'learned'] }).notNull(),
    createdBy: text(),
    createdAt: time().notNull().default(sql`app_now()`),
  },
  (table) => [
    unique('supplier_domain_eindeutig').on(table.orgId, table.relationshipId, table.domain),
    check('supplier_domain_source', sql`${table.source} in ('contact', 'manual', 'learned')`),
    index('supplier_domain_domain').on(table.orgId, table.domain),
  ],
);

export interface InboundDetails {
  method: 'REQUEST' | 'CANCEL';
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  onlineMeetingUrl: string | null;
  organizerEmail: string | null;
  organizerName: string | null;
  attendees: { email: string; name: string | null; response: string | null }[];
  // IN-04: weitergeleitete Mail, die noch zugeordnet wird (Text ohne HTML, Anhänge in der Ablage).
  // Nach dem Zuordnen oder Ignorieren wird sie hier gelöscht.
  mail?: {
    messageId: string;
    fromEmail: string;
    fromName: string | null;
    toEmails: string[];
    sentAt: string;
    bodyText: string;
    forwardedBy: string;
    attachments: { fileName: string; mime: string; size: number; fileKey: string | null }[];
  };
}

/**
 * Eingang: eine Einladung oder ein Kalendertermin, der noch zugeordnet wird oder schon zugeordnet
 * ist. Vom Mailtext wird nur der iCalendar-Teil gelesen; Rohdaten werden nicht gespeichert.
 */
export const inboundItem = pgTable(
  'inbound_item',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: orgId(),
    kind: text({ enum: ['meeting', 'mail'] })
      .notNull()
      .default('meeting'),
    source: text({ enum: ['outlook_addin', 'inbound_mail', 'calendar_sync'] }).notNull(),
    receivedAt: time().notNull().default(sql`app_now()`),
    fromEmail: text(),
    subject: text().notNull(),
    icalUid: text(),
    sequence: integer().notNull().default(0),
    details: jsonb().$type<InboundDetails>().notNull(),
    suggestedRelationshipIds: jsonb().$type<string[]>().notNull().default([]),
    suggestionKind: text({ enum: ['supplier', 'several', 'event', 'none'] }).notNull(),
    suggestionReason: text(),
    suggestedType: text().notNull().default('other'),
    status: text({
      enum: ['auto_assigned', 'needs_review', 'assigned', 'ignored', 'rejected'],
    }).notNull(),
    // Wer zuordnet: die einladende Person, ohne Zugriff der SRO des Lieferanten
    ownerUserId: text(),
    assigneeUserId: text(),
    assignedBy: text(),
    assignedAt: time(),
    objectType: text({ enum: ['meeting', 'event', 'filed_mail'] }),
    objectIds: jsonb().$type<string[]>().notNull().default([]),
    registrationId: uuid(),
  },
  (table) => [
    check(
      'inbound_item_status',
      sql`${table.status} in ('auto_assigned', 'needs_review', 'assigned', 'ignored', 'rejected')`,
    ),
    check(
      'inbound_item_source',
      sql`${table.source} in ('outlook_addin', 'inbound_mail', 'calendar_sync')`,
    ),
    index('inbound_item_org').on(table.orgId, table.status, table.receivedAt),
    index('inbound_item_uid').on(table.orgId, table.icalUid),
  ],
);

/** Was das Outlook-Add-in beim Speichern festhält; die Einladung wird später damit verknüpft. */
export const addinRegistration = pgTable(
  'addin_registration',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: orgId(),
    userId: text().notNull(),
    organizerEmail: text().notNull(),
    subject: text().notNull(),
    startAt: time().notNull(),
    relationshipId: uuid().references(() => relationship.id, { onDelete: 'cascade' }),
    meetingType: text().notNull(),
    briefOptIn: boolean().notNull().default(true),
    transcriptOptIn: boolean().notNull().default(false),
    insertAgenda: boolean().notNull().default(false),
    eventId: text(),
    createdAt: time().notNull().default(sql`app_now()`),
    matchedMeetingId: uuid(),
  },
  (table) => [
    index('addin_registration_match').on(table.orgId, table.organizerEmail, table.startAt),
  ],
);
