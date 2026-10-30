import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { organization } from './organization.js';

// Die Beziehung zwischen einem Käufer und einem Lieferanten (Grundlage für PLT-03).
// Geteilte Ebene: enthält nur, was beide Seiten wissen dürfen.
export const beziehung = pgTable(
  'beziehung',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    kaeuferOrgId: uuid('kaeufer_org_id')
      .notNull()
      .references(() => organization.id),
    lieferantOrgId: uuid('lieferant_org_id')
      .notNull()
      .references(() => organization.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('beziehung_paar').on(table.kaeuferOrgId, table.lieferantOrgId)],
);

// Käuferprivate Ebene einer Beziehung: Warengruppe und Spend sieht nur der Käufer, nie der
// Lieferant. Der Verweis geht von privat auf geteilt, nie umgekehrt (CLAUDE.md).
// Genau eine Zeile je Beziehung mit dem aktuellen Spend; eine Historie kommt mit PLT-07.
export const beziehungKaeufer = pgTable(
  'beziehung_kaeufer',
  {
    beziehungId: uuid('beziehung_id')
      .primaryKey()
      .references(() => beziehung.id, { onDelete: 'cascade' }),
    // Freitext, bis PLT-06 eine gepflegte Liste bringt.
    warengruppe: text().notNull(),
    // Geld immer als ganze Cent; bigint, weil integer nur bis etwa 21 Mio. Euro reicht.
    jahresspendCent: bigint('jahresspend_cent', { mode: 'number' }).notNull(),
    spendJahr: integer('spend_jahr').notNull(),
    waehrung: text().notNull().default('EUR'),
  },
  (table) => [
    check('beziehung_kaeufer_spend_positiv', sql`${table.jahresspendCent} >= 0`),
    check('beziehung_kaeufer_waehrung_iso', sql`${table.waehrung} ~ '^[A-Z]{3}$'`),
  ],
);
