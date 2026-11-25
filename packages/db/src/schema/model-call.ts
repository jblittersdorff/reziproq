import { sql } from 'drizzle-orm';
import {
  bigint,
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

export const modelClasses = ['small', 'standard', 'synthesis'] as const;
export const modelProviders = ['bedrock_eu', 'fake', 'anthropic'] as const;
export const modelCallOutcomes = ['ok', 'failed', 'rejected_region', 'rejected_budget'] as const;

/**
 * KI-01: eine Zeile je Modellaufruf über das Gateway, org_private. Kosten in Mikrocent (1/1.000.000
 * Cent) als Ganzzahl, weil ein kurzer Aufruf weit unter einem Cent kostet; die Oberfläche zeigt
 * Cent. outcome hält auch abgelehnte Aufrufe fest (Region außerhalb der EU, Budget erreicht), dann
 * ohne Tokens und Kosten. run_id ohne Fremdschlüssel, bis KI-04 die Läufe bringt.
 */
export const modelCall = pgTable(
  'model_call',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    // Das Protokoll gehört zur Organisation und geht mit ihr.
    orgId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    runId: uuid(),
    feature: text().notNull(),
    modelClass: text({ enum: modelClasses }).notNull(),
    provider: text({ enum: modelProviders }).notNull(),
    modelId: text().notNull(),
    region: text().notNull(),
    outcome: text({ enum: modelCallOutcomes }).notNull(),
    inputTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    costMicrocents: bigint({ mode: 'number' }).notNull().default(0),
    latencyMs: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    check('model_call_class', sql`${table.modelClass} in ('small', 'standard', 'synthesis')`),
    check('model_call_provider', sql`${table.provider} in ('bedrock_eu', 'fake', 'anthropic')`),
    check(
      'model_call_outcome',
      sql`${table.outcome} in ('ok', 'failed', 'rejected_region', 'rejected_budget')`,
    ),
    check(
      'model_call_amounts',
      sql`${table.inputTokens} >= 0 and ${table.outputTokens} >= 0 and ${table.costMicrocents} >= 0`,
    ),
    index('model_call_org_run').on(table.orgId, table.runId),
    index('model_call_org_month').on(table.orgId, table.createdAt),
  ],
);

/**
 * DM-01, KI-01 (K1-b.1): Aufgezeichnete Modellantwort im Demo-Mandanten. Im Modus record speichert
 * das Gateway jede Antwort zum Hash ihrer Eingabe; im Modus replay liefert es sie wieder, ohne das
 * Modell aufzurufen. IDs in Eingabe und Antwort stehen als Platzhalter, damit eine Aufzeichnung
 * nach „Zurücksetzen“ mit neuen IDs wieder passt. Nur Demo-Mandanten (Policy in Migration 0136).
 */
export const modelCallRecording = pgTable(
  'model_call_recording',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    feature: text().notNull(),
    inputHash: text().notNull(),
    /** Antwort des Modells (Inhalt, Ende, strukturierter Text), IDs als Platzhalter */
    response: jsonb().notNull(),
    modelId: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    unique('model_call_recording_eingabe').on(table.orgId, table.feature, table.inputHash),
  ],
);
