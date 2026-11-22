import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { appUser } from './app-user.js';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

export const note = pgTable(
  'note',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    authorUserId: text()
      .notNull()
      .references(() => appUser.id),
    visibility: text({ enum: ['team', 'private'] }).notNull(),
    kind: text({ enum: ['note', 'call'] }).notNull(),
    text: text().notNull(),
    pinned: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('note_visibility', sql`${table.visibility} in ('team','private')`),
    check('note_kind', sql`${table.kind} in ('note','call')`),
    index('note_relationship_date').on(table.relationshipId, table.createdAt),
  ],
);
