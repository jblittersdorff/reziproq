import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { appUser } from './app-user.js';
import { organization } from './organization.js';

// IN-06: Benachrichtigungen in Teams und per Mail. Einstellungen und Teams-Verbindung gehören der
// Person (nur sie liest und ändert sie, Policies *_self); das Protokoll gehört der Organisation.
// Der Lieferant bekommt keine dieser Nachrichten.

export const notificationChannels = ['teams', 'mail'] as const;
export const notificationKinds = [
  'hint_high',
  'drafts_ready',
  'brief_ready',
  'results_ready',
  'commitment_due',
  'inbound_review',
  'meeting_reminder',
  'digest',
] as const;
export const notificationModes = ['now', 'digest', 'off'] as const;
export const notificationStatuses = ['queued', 'sent', 'failed', 'suppressed'] as const;

const orgId = () =>
  uuid()
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' });
const userId = () =>
  text()
    .notNull()
    .references(() => appUser.id, { onDelete: 'cascade' });

/** Ruhezeiten: von, bis (HH:MM, Ortszeit Europe/Berlin) und ob das Wochenende ruhig ist */
export interface QuietHours {
  from: string;
  to: string;
  weekend: boolean;
}

export const notificationPref = pgTable(
  'notification_pref',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: orgId(),
    userId: userId(),
    channel: text({ enum: notificationChannels }).notNull(),
    kind: text({ enum: notificationKinds }).notNull(),
    mode: text({ enum: notificationModes }).notNull(),
    // Gleich für alle Zeilen einer Person; gespeichert wird sie mit jeder Änderung
    quietHours: jsonb().$type<QuietHours>(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('notification_pref_channel', sql`${table.channel} in ('teams', 'mail')`),
    check('notification_pref_mode', sql`${table.mode} in ('now', 'digest', 'off')`),
    unique('notification_pref_eindeutig').on(table.userId, table.channel, table.kind),
  ],
);

/** Teams-Verbindung einer Person: Gesprächsverweis des Bots (fake: aus dem Testanbieter) */
export const notificationChannel = pgTable(
  'notification_channel',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: orgId(),
    userId: userId(),
    channel: text({ enum: notificationChannels }).notNull(),
    conversationRef: text().notNull(),
    linkedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('notification_channel_eindeutig').on(table.userId, table.channel)],
);

/** Jede Benachrichtigung: gesendet, gebündelt, in die Zusammenfassung verschoben oder unterdrückt */
export const notification = pgTable(
  'notification',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: orgId(),
    userId: userId(),
    channel: text({ enum: notificationChannels }).notNull(),
    kind: text({ enum: notificationKinds }).notNull(),
    objectType: text().notNull(),
    objectId: text().notNull(),
    // Art und Person: Anlässe derselben Art innerhalb von 15 Minuten teilen sich eine Karte
    bundleKey: text().notNull(),
    // now: sofort; digest: wartet auf die Zusammenfassung
    delivery: text({ enum: ['now', 'digest'] }).notNull(),
    status: text({ enum: notificationStatuses }).notNull(),
    // Nur Titel, eine Zeile Kontext und Link; nie private Inhalte
    title: text().notNull(),
    line: text(),
    href: text().notNull(),
    // Karte in Teams, in der dieser Anlass steht (beim Bündeln dieselbe)
    messageRef: text(),
    reason: text(),
    sentAt: timestamp({ withTimezone: true }),
    actionTaken: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('notification_channel', sql`${table.channel} in ('teams', 'mail')`),
    check('notification_delivery', sql`${table.delivery} in ('now', 'digest')`),
    check(
      'notification_status',
      sql`${table.status} in ('queued', 'sent', 'failed', 'suppressed')`,
    ),
    index('notification_user').on(table.userId, table.createdAt),
    index('notification_bundle').on(table.bundleKey, table.createdAt),
  ],
);
