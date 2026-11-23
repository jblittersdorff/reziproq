import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { materialGroup } from './master-data.js';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// KI-15 Import und Zuordnung: Lieferantenstamm und Spend aus dem ERP als Stapel, je Käufer privat
// (org_private). Lieferant = Organisation mit Beziehung des Käufers (relationship_id), Warengruppe =
// material_group (Entscheidung F14). Aliasse und Regeln lernen aus jeder Entscheidung.

export const importBatchKinds = ['supplier_master', 'spend'] as const;
export const importBatchStatuses = [
  'uploaded',
  'mapped',
  'processing',
  'review',
  'committed',
  'reverted',
  'failed',
  'discarded',
] as const;

export const importBatch = pgTable(
  'import_batch',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    kind: text({ enum: importBatchKinds }).notNull(),
    fileName: text().notNull(),
    fileHash: text().notNull(),
    headers: jsonb().$type<string[]>().notNull().default([]),
    columnMap: jsonb().$type<Record<string, string | null>>().notNull().default({}),
    suggestedMap: jsonb().$type<Record<string, string | null>>().notNull().default({}),
    status: text({ enum: importBatchStatuses }).notNull().default('uploaded'),
    rowsTotal: integer().notNull().default(0),
    rowsOk: integer().notNull().default(0),
    rowsReview: integer().notNull().default(0),
    rowsError: integer().notNull().default(0),
    runId: uuid(),
    // Was das Übernehmen geändert hat, damit es sich 30 Tage lang rückgängig machen lässt
    undo: jsonb().$type<Record<string, unknown>>(),
    createdBy: text().notNull(),
    createdByName: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    committedBy: text(),
    committedAt: timestamp({ withTimezone: true }),
    revertedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    check('import_batch_kind', sql`${table.kind} in ('supplier_master', 'spend')`),
    check(
      'import_batch_status',
      sql`${table.status} in ('uploaded', 'mapped', 'processing', 'review', 'committed', 'reverted', 'failed', 'discarded')`,
    ),
    check('import_batch_rows', sql`${table.rowsTotal} between 0 and 50000`),
    // Dieselbe Datei wird nicht zweimal übernommen.
    uniqueIndex('import_batch_datei_einmal')
      .on(table.orgId, table.fileHash)
      .where(sql`${table.status} = 'committed'`),
    index('import_batch_org').on(table.orgId, table.createdAt),
  ],
);

export const importMatchMethods = [
  'alias',
  'vat_id',
  'duns',
  'fuzzy',
  'model',
  'manual',
  'new',
] as const;
export const importCategoryMethods = ['rule', 'model', 'manual'] as const;
export const importRowStatuses = ['ok', 'review', 'error', 'skipped'] as const;

export const importRow = pgTable(
  'import_row',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    batchId: uuid()
      .notNull()
      .references(() => importBatch.id, { onDelete: 'cascade' }),
    rowNo: integer().notNull(),
    raw: jsonb().$type<Record<string, string>>().notNull(),
    normalized: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    relationshipId: uuid().references(() => relationship.id),
    matchMethod: text({ enum: importMatchMethods }),
    matchScore: real(),
    matchReason: text(),
    // Vorschlag aus Kandidaten oder Modell; wird nie ohne Entscheidung eines Menschen übernommen
    suggestion: jsonb().$type<Record<string, unknown>>(),
    candidates: jsonb()
      .$type<{ relationshipId: string; name: string; score: number }[]>()
      .notNull()
      .default([]),
    materialGroupId: uuid().references(() => materialGroup.id),
    categoryMethod: text({ enum: importCategoryMethods }),
    categoryConfidence: real(),
    categorySuggestion: jsonb().$type<Record<string, unknown>>(),
    // Beim Übernehmen neu anlegen, optional im Konzernverbund
    createNew: boolean().notNull().default(false),
    parentRelationshipId: uuid().references(() => relationship.id),
    amountCents: bigint({ mode: 'number' }),
    status: text({ enum: importRowStatuses }).notNull(),
    error: text(),
    decidedBy: text(),
  },
  (table) => [
    check('import_row_status', sql`${table.status} in ('ok', 'review', 'error', 'skipped')`),
    check(
      'import_row_match_method',
      sql`${table.matchMethod} is null or ${table.matchMethod} in ('alias', 'vat_id', 'duns', 'fuzzy', 'model', 'manual', 'new')`,
    ),
    check(
      'import_row_category_method',
      sql`${table.categoryMethod} is null or ${table.categoryMethod} in ('rule', 'model', 'manual')`,
    ),
    index('import_row_batch').on(table.batchId, table.status, table.rowNo),
  ],
);

/** Gelernte Zuordnung: Lieferantennummer eines Quellsystems oder Namensvariante → Beziehung */
export const supplierAlias = pgTable(
  'supplier_alias',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    sourceSystem: text().notNull().default('erp'),
    externalNumber: text(),
    nameVariant: text(),
    createdFromRowId: uuid(),
    createdBy: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'supplier_alias_schluessel',
      sql`${table.externalNumber} is not null or ${table.nameVariant} is not null`,
    ),
    unique('supplier_alias_nummer').on(table.orgId, table.sourceSystem, table.externalNumber),
    index('supplier_alias_name').on(table.orgId, table.nameVariant),
  ],
);

export const categoryRuleFields = ['material_group', 'account', 'description'] as const;

/** Gelernte Regel: ERP-Materialgruppe, Konto oder Text → Warengruppe des Kunden */
export const categoryRule = pgTable(
  'category_rule',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    materialGroupId: uuid()
      .notNull()
      .references(() => materialGroup.id),
    field: text({ enum: categoryRuleFields }).notNull(),
    pattern: text().notNull(),
    createdFromRowId: uuid(),
    createdBy: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'category_rule_field',
      sql`${table.field} in ('material_group', 'account', 'description')`,
    ),
    check('category_rule_pattern', sql`length(trim(${table.pattern})) between 1 and 200`),
    unique('category_rule_je_muster').on(table.orgId, table.field, table.pattern),
  ],
);
