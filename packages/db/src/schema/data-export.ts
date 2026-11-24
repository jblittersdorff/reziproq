import { sql } from 'drizzle-orm';
import { check, customType, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organization } from './organization.js';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

// QS-03: Gesamtexport einer Organisation. Ein Admin fordert ihn an, ein Job baut die ZIP-Datei in
// der Mandanten-Session der Organisation und legt sie hier ab; nach 24 Stunden ist sie nicht mehr
// abrufbar. Technische Tabelle, keine Fachdaten; nur die eigene Organisation sieht sie.
export const dataExportStatuses = ['pending', 'running', 'done', 'failed'] as const;

export const dataExport = pgTable(
  'data_export',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    requestedBy: text().notNull(),
    status: text({ enum: dataExportStatuses }).notNull().default('pending'),
    // Lieferanten arbeiten im Kontext je eines Kunden; der Job liest jeden davon (LIF-02).
    customerOrgIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
    fileName: text(),
    file: bytea(),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    check('data_export_status', sql`${table.status} in ('pending', 'running', 'done', 'failed')`),
    check(
      'data_export_file',
      sql`(${table.status} = 'done') = (${table.file} is not null and ${table.expiresAt} is not null)`,
    ),
    index('data_export_org').on(table.orgId, table.createdAt),
  ],
);
