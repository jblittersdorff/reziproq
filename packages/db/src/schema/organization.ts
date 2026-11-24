import { sql } from 'drizzle-orm';
import { boolean, check, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`app_now()`),
    // DM-01: Demo-Mandant mit eigener Uhr und Modus der Modellantworten. Nur ein Demo-Mandant darf
    // von „live“ abweichen oder eine eigene Uhr haben (CHECK unten). Umschalten nur der Betrieb.
    isDemo: boolean('is_demo').notNull().default(false),
    aiMode: text('ai_mode', { enum: ['fake', 'record', 'replay', 'live'] })
      .notNull()
      .default('live'),
    demoNow: timestamp('demo_now', { withTimezone: true }),
  },
  (table) => [
    check('organization_country_iso', sql`${table.country} ~ '^[A-Z]{2}$'`),
    check('organization_ai_mode', sql`${table.aiMode} in ('fake', 'record', 'replay', 'live')`),
    check('organization_demo_modus', sql`${table.aiMode} = 'live' or ${table.isDemo}`),
    check('organization_demo_uhr', sql`${table.demoNow} is null or ${table.isDemo}`),
  ],
);

/** DM-01, KI-01: Modus der Modellantworten je Organisation */
export const aiModes = ['fake', 'record', 'replay', 'live'] as const;
export type AiMode = (typeof aiModes)[number];

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
    enabledAt: timestamp('enabled_at', { withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.feature] })],
);

/** UX-20: Module je Organisation; ohne Zeile gilt der Standard (claims, risk, contract aus). */
export const orgModules = [
  'claims',
  'risk',
  'contract',
  'value_finder',
  'category_strategy',
] as const;
export type OrgModule = (typeof orgModules)[number];

export const orgModule = pgTable(
  'org_module',
  {
    orgId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    module: text({ enum: orgModules }).notNull(),
    enabled: boolean().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    primaryKey({ columns: [table.orgId, table.module] }),
    check(
      'org_module_module',
      sql`${table.module} in ('claims', 'risk', 'contract', 'value_finder', 'category_strategy')`,
    ),
  ],
);
