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
import { apiKey } from './integration.js';
import { materialGroup } from './master-data.js';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// KI-15 Import und Zuordnung: Lieferantenstamm und Spend aus dem ERP als Stapel, je Käufer privat
// (org_private). Lieferant = Organisation mit Beziehung des Käufers (relationship_id), Warengruppe =
// material_group (Entscheidung F14). Aliasse und Regeln lernen aus jeder Entscheidung.

export const importBatchKinds = ['supplier_master', 'spend'] as const;
export const importBatchSources = ['file', 'api'] as const;
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
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    committedBy: text(),
    committedAt: timestamp({ withTimezone: true }),
    revertedAt: timestamp({ withTimezone: true }),
    // IN-07: Lieferung über die Import-API statt Datei; gleiche idempotency_key in 24 Stunden gibt
    // dieselbe Antwort (api_response). Zeilen, die schon die Prüfung der API ablehnt, stehen in
    // api_errors, Felder außerhalb des Modells in ignored_fields. delivery_id ist die erste Lieferung,
    // aus der eine Nachprüfung (Zeilen zur Prüfung) abgespalten wurde.
    source: text({ enum: importBatchSources }).notNull().default('file'),
    apiKeyId: uuid().references(() => apiKey.id),
    idempotencyKey: text(),
    apiResponse: jsonb().$type<Record<string, unknown>>(),
    apiErrors: jsonb()
      .$type<{ row: number; field: string; reason: string }[]>()
      .notNull()
      .default([]),
    ignoredFields: jsonb().$type<string[]>().notNull().default([]),
    deliveryId: uuid(),
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
      .where(sql`${table.status} = 'committed' and ${table.source} = 'file'`),
    index('import_batch_org').on(table.orgId, table.createdAt),
    check('import_batch_source', sql`${table.source} in ('file', 'api')`),
    index('import_batch_idempotency').on(table.orgId, table.apiKeyId, table.idempotencyKey),
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
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
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
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
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

/**
 * IN-07: Spend je Monat aus der Import-API. Eine Lieferung ersetzt die Monate früherer Lieferungen
 * derselben Herkunft; die Jahressumme je Lieferant und Warengruppe steht danach in
 * relationship_spend (Quelle import). org_private.
 */
export const spendPeriod = pgTable(
  'spend_period',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    period: text().notNull(),
    materialGroupId: uuid().references(() => materialGroup.id),
    amountCents: bigint({ mode: 'number' }).notNull(),
    currency: text().notNull().default('EUR'),
    source: text().notNull().default('api'),
    deliveryId: uuid().notNull(),
    batchId: uuid()
      .notNull()
      .references(() => importBatch.id, { onDelete: 'cascade' }),
  },
  (table) => [
    check('spend_period_format', sql`${table.period} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check('spend_period_positiv', sql`${table.amountCents} >= 0`),
    index('spend_period_org').on(table.orgId, table.source, table.period),
    index('spend_period_relationship').on(table.relationshipId, table.period),
  ],
);
