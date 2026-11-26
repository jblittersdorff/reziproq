import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// QS-02: Kommentare an Initiativen, Zusagen, Maßnahmen, Terminen, Themen und Spielregeln. Geteilt
// oder intern (visibility); jede Seite schreibt nur ihre eigenen Zeilen (PLT-04). Das Objekt steht
// als Art und ID ohne Fremdschlüssel, wie bei audit_event. Personen stehen als ID und Name ohne
// Fremdschlüssel auf app_user (privat). Gelöscht wird nur weich: deleted_at, der Text wird leer.

export const commentObjectTypes = [
  'initiative',
  'commitment',
  'task',
  'meeting',
  'topic',
  'rule_set',
] as const;

export const comment = pgTable(
  'comment',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('shared'),
    objectType: text({ enum: commentObjectTypes }).notNull(),
    objectId: uuid().notNull(),
    authorId: text().notNull(),
    authorName: text().notNull(),
    body: text().notNull(),
    // Erwähnte Personen (IDs); die Mail und der Eintrag auf Start laufen über comment_mention.
    mentions: text().array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    editedAt: timestamp({ withTimezone: true }),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    check(
      'comment_object_type',
      sql`${table.objectType} in ('initiative', 'commitment', 'task', 'meeting', 'topic', 'rule_set')`,
    ),
    // Text 1 bis 2000 Zeichen; gelöscht ist er leer.
    check(
      'comment_body',
      sql`(${table.deletedAt} is null and length(trim(${table.body})) between 1 and 2000)
        or (${table.deletedAt} is not null and ${table.body} = '')`,
    ),
    index('comment_object').on(table.objectType, table.objectId, table.createdAt),
    index('comment_relationship').on(table.relationshipId),
  ],
);

// QS-02: Eine Erwähnung je Person und Kommentar. Gehört der Organisation der erwähnten Person
// (org_private); bis opened_at steht sie auf Start unter „Fällig bei mir“. Angelegt nur über die
// Funktion app_kommentar_erwaehnen, auch für Personen der anderen Seite.
export const commentMention = pgTable(
  'comment_mention',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    commentId: uuid()
      .notNull()
      .references(() => comment.id, { onDelete: 'cascade' }),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    userId: text().notNull(),
    openedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    unique('comment_mention_je_person').on(table.commentId, table.userId),
    index('comment_mention_user').on(table.userId, table.openedAt),
  ],
);
