import { sql } from 'drizzle-orm';
import { check, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Eine Organisation ist ein Mandant: eine Firma, die Reziproq nutzt oder als Lieferant vorkommt.
// Sie hat keinen festen Typ (PLT-02): Ob sie Käufer oder Lieferant ist, ergibt sich aus der
// jeweiligen Beziehung; ob sie Käuferfunktionen nutzen darf, steht in organization_feature.
// Ein Lieferant existiert genau einmal und kann mehreren Käufern zugeordnet sein.
// Row-Level Security: Policies in drizzle/0004_rls.sql und drizzle/0007_organisationen.sql.
export const organization = pgTable(
  'organization',
  {
    // uuidv7() ist ab PostgreSQL 18 eingebaut und zeitlich sortierbar.
    id: uuid().primaryKey().default(sql`uuidv7()`),
    name: text().notNull(),
    // ISO-3166-1-Code, z. B. DE
    country: text(),
    // USt-IdNr., DUNS und Zitadel-Organisation sind optional, aber jeweils nur einmal vergeben.
    vatId: text('vat_id').unique('organization_vat_id_eindeutig'),
    duns: text().unique('organization_duns_eindeutig'),
    // Resource ID der Organisation in Zitadel; darüber ordnet der Login Nutzer zu (PLT-02).
    zitadelOrgId: text('zitadel_org_id').unique('organization_zitadel_org_id_eindeutig'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('organization_country_iso', sql`${table.country} ~ '^[A-Z]{2}$'`)],
);

/** Funktionen, die eine Organisation freigeschaltet hat (CLAUDE.md: Freischalt-Tabelle). */
export const organizationFeatures = ['buyer'] as const;
export type OrganizationFeature = (typeof organizationFeatures)[number];

// Freischaltungen je Organisation. Erster Eintrag: buyer (Käuferfunktionen); später Add-ons.
export const organizationFeature = pgTable(
  'organization_feature',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    feature: text().$type<OrganizationFeature>().notNull(),
    enabledAt: timestamp('enabled_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.feature] })],
);
