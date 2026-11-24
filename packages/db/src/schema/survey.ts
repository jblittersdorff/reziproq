import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// PUL-01: Fragebogen je Organisation und Art (Puls, Jahres-Feedback). Jede Änderung legt eine neue
// Version mit allen Fragen an; Versionen sind nur anfügbar, damit laufende Wellen (PUL-02) ihre
// Version behalten. Die Fragen stehen als JSON in der Version (Schlüssel bleibt über Versionen).

export const surveyTemplate = pgTable(
  'survey_template',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    kind: text({ enum: ['pulse', 'annual'] }).notNull(),
    version: integer().notNull(),
    /** [{ key, dimension, textDe, textEn, active, custom }] */
    questions: jsonb().notNull(),
    /** null für Version 1 aus dem Standard von Reziproq */
    createdBy: text(),
    createdByName: text(),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    unique('survey_template_version').on(table.orgId, table.kind, table.version),
    check('survey_template_kind', sql`${table.kind} in ('pulse', 'annual')`),
    check('survey_template_version_positive', sql`${table.version} >= 1`),
    check('survey_template_questions_array', sql`jsonb_typeof(${table.questions}) = 'array'`),
  ],
);

/**
 * PUL-02: Feedback-Welle einer Beziehung (geteilt, angelegt vom Käufer). Die Vorlage ist
 * käuferprivat; die Welle merkt sich ihre ID und Version ohne Fremdschlüssel (keine Verweise von
 * geteilt auf privat). Jede Seite schließt ihre Teilnahme selbst ab (app_survey_close).
 */
export const surveyWave = pgTable(
  'survey_wave',
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
    templateId: uuid().notNull(),
    templateVersion: integer().notNull(),
    kind: text({ enum: ['pulse', 'annual'] }).notNull(),
    dueDate: date().notNull(),
    buyerClosedAt: timestamp({ withTimezone: true }),
    supplierClosedAt: timestamp({ withTimezone: true }),
    revealedAt: timestamp({ withTimezone: true }),
    createdBy: text().notNull(),
    createdByName: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    check('survey_wave_kind', sql`${table.kind} in ('pulse', 'annual')`),
    index('survey_wave_relationship').on(table.relationshipId, table.createdAt),
  ],
);

/**
 * PUL-02: Teilnehmende einer Welle. Geteilte Ebene, aber immer intern: Nur die einladende Seite
 * sieht ihre Einladungen. Den Rücklauf beider Seiten zählt app_survey_turnout, nur als Anzahl.
 * Gespeichert ist nur der Hash des persönlichen Links; Antworten verweisen nie hierher.
 */
export const surveyParticipant = pgTable(
  'survey_participant',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    waveId: uuid()
      .notNull()
      .references(() => surveyWave.id, { onDelete: 'cascade' }),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('internal'),
    side: text({ enum: ['buyer', 'supplier'] }).notNull(),
    email: text().notNull(),
    name: text(),
    function: text().notNull(),
    tokenHash: text().notNull(),
    invitedBy: text().notNull(),
    invitedAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    completedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    check('survey_participant_side', sql`${table.side} in ('buyer', 'supplier')`),
    check('survey_participant_email', sql`position('@' in ${table.email}) > 1`),
    index('survey_participant_wave').on(table.waveId),
    index('survey_participant_token').on(table.tokenHash),
  ],
);

/**
 * PUL-02b: Ein Antwortbogen, privat bei der antwortenden Seite (org_private). Anonym durch Bauart:
 * kein Verweis auf die teilnehmende Person, keine Zeitstempel und eine zufällige ID (uuid v4 statt
 * v7), damit sich der Bogen nicht über die Zeit mit completed_at verbinden lässt. Schreiben nur
 * über app_umfrage_absenden; nur anfügbar.
 */
export const surveyResponse = pgTable(
  'survey_response',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    waveId: uuid()
      .notNull()
      .references(() => surveyWave.id, { onDelete: 'cascade' }),
    side: text({ enum: ['buyer', 'supplier'] }).notNull(),
    function: text().notNull(),
    /** { <Frage>: { current: 1–5 | null, target: 1–5 | null } }; null heißt „Kann ich nicht beurteilen“ */
    answers: jsonb().notNull(),
    comment: text(),
  },
  (table) => [
    check('survey_response_side', sql`${table.side} in ('buyer', 'supplier')`),
    check('survey_response_answers_object', sql`jsonb_typeof(${table.answers}) = 'object'`),
    check(
      'survey_response_comment',
      sql`${table.comment} is null or length(${table.comment}) <= 2000`,
    ),
    index('survey_response_wave').on(table.waveId),
  ],
);

/**
 * PUL-03: Ergebnis einer Welle, entsteht einmal bei der Aufdeckung (app_survey_reveal) und ist
 * dann für beide Seiten gleich. Gruppen (Seite, Funktion) erst ab drei Antworten; kleinere Gruppen
 * stecken nur in „gesamt“ (function leer). question_key leer = Mittel der Dimension. Die Texte der
 * Fragen stehen mit drin, weil die Vorlage käuferprivat ist.
 */
export const surveyResult = pgTable(
  'survey_result',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    waveId: uuid()
      .notNull()
      .references(() => surveyWave.id, { onDelete: 'cascade' }),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('shared'),
    side: text({ enum: ['buyer', 'supplier'] }).notNull(),
    function: text(),
    dimension: text().notNull(),
    questionKey: text(),
    labelDe: text(),
    labelEn: text(),
    istMean: numeric({ precision: 4, scale: 2 }),
    sollMean: numeric({ precision: 4, scale: 2 }),
    n: integer().notNull(),
  },
  (table) => [
    check('survey_result_side', sql`${table.side} in ('buyer', 'supplier')`),
    check('survey_result_n', sql`${table.n} >= 3`),
    index('survey_result_wave').on(table.waveId),
  ],
);

/** PUL-03: Freitexte einer Seite ab drei Antworten, ohne Funktion, in zufälliger Reihenfolge. */
export const surveyFreeText = pgTable(
  'survey_free_text',
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    waveId: uuid()
      .notNull()
      .references(() => surveyWave.id, { onDelete: 'cascade' }),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('shared'),
    side: text({ enum: ['buyer', 'supplier'] }).notNull(),
    text: text().notNull(),
    position: integer().notNull(),
  },
  (table) => [
    check('survey_free_text_side', sql`${table.side} in ('buyer', 'supplier')`),
    index('survey_free_text_wave').on(table.waveId),
  ],
);
