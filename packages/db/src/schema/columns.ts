import { sql } from 'drizzle-orm';
import { type AnyPgColumn, check, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// ZA-01: Herkunft und Bestätigung an Objekten einer Beziehung. Die Spalten entstehen je Tabelle
// neu (Drizzle braucht je Tabelle eigene Spalten-Objekte), deshalb Funktionen statt Konstanten.

/** Wer ein Objekt erzeugt hat (ZA-01 Regel 5) */
export const origins = ['human', 'reziproq', 'engine', 'import'] as const;
export type Origin = (typeof origins)[number];

/** Ob beide Seiten ein geteiltes Objekt bestätigt haben (ZA-01 Regel 4) */
export const confirmStates = [
  'draft',
  'buyer_confirmed',
  'supplier_confirmed',
  'both_confirmed',
] as const;
export type ConfirmState = (typeof confirmStates)[number];

const inList = (column: AnyPgColumn, values: readonly string[]) =>
  sql`${column} in (${sql.raw(values.map((value) => `'${value}'`).join(', '))})`;

/**
 * origin, origin_run_id (Lauf, wenn origin = reziproq) und origin_user_id (wer angelegt oder
 * übernommen hat). Personen haben in Reziproq Text-IDs aus Zitadel, deshalb text statt uuid.
 */
export function originColumns() {
  return {
    origin: text({ enum: origins }).notNull().default('human'),
    originRunId: uuid(),
    originUserId: text(),
  };
}

/** Bestätigung je Seite mit Person und Zeit; zählt in Quote und Wert erst mit both_confirmed */
export function confirmColumns() {
  return {
    confirmState: text({ enum: confirmStates }).notNull().default('draft'),
    buyerConfirmedBy: text(),
    buyerConfirmedAt: timestamp({ withTimezone: true }),
    supplierConfirmedBy: text(),
    supplierConfirmedAt: timestamp({ withTimezone: true }),
  };
}

/** CHECK für origin */
export function originConstraint(table: string, column: AnyPgColumn) {
  return check(`${table}_origin`, inList(column, origins));
}

/** CHECK für confirm_state */
export function confirmConstraint(table: string, column: AnyPgColumn) {
  return check(`${table}_confirm_state`, inList(column, confirmStates));
}
