import { sql } from 'drizzle-orm';
import { check, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { organization } from './organization.js';

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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('survey_template_version').on(table.orgId, table.kind, table.version),
    check('survey_template_kind', sql`${table.kind} in ('pulse', 'annual')`),
    check('survey_template_version_positive', sql`${table.version} >= 1`),
    check('survey_template_questions_array', sql`jsonb_typeof(${table.questions}) = 'array'`),
  ],
);
