import { z } from 'zod';

// IN-01: Integrationsschicht. Die Registry der Anbindungen steht im Code (apps/api), hier nur die
// Schlüssel und die Antworten für die Oberfläche.

export const connectorKeys = [
  'microsoft365',
  'google_workspace',
  'inbound_mail',
  'import_api',
  'files',
  'slack',
  'zoom',
  'sap_s4',
] as const;
export type ConnectorKey = (typeof connectorKeys)[number];

export const connectionStatuses = ['pending', 'active', 'error', 'revoked'] as const;

export const connectionViewSchema = z.object({
  id: z.uuid(),
  scope: z.enum(['org', 'user']),
  status: z.enum(connectionStatuses),
  parts: z.array(z.string()),
  connectedByName: z.string(),
  connectedAt: z.iso.datetime(),
  /** Nur für Webhook-Anbindungen: die Adresse, an die der Anbieter sendet (ohne Geheimnis) */
  hookPath: z.string().nullable(),
  /** IN-03: Eingangsadresse und zugelassene Absender-Domains (nur Eingangsadresse) */
  inboundAddress: z.string().nullable().default(null),
  allowedDomains: z.array(z.string()).default([]),
  lastJob: z
    .object({
      status: z.enum(['queued', 'running', 'done', 'failed']),
      itemsIn: z.number().int(),
      itemsOk: z.number().int(),
      itemsFailed: z.number().int(),
      finishedAt: z.iso.datetime().nullable(),
    })
    .nullable(),
});

export const connectorViewSchema = z.object({
  key: z.enum(connectorKeys),
  group: z.enum(['workplace', 'purchasing']),
  stage: z.union([z.literal(1), z.literal(2)]),
  parts: z.array(z.string()),
  personal: z.boolean(),
  /** fake: Anbieter zum Testen ohne echtes Konto; live kommt je Anbindung mit IN-02 bis IN-07 */
  provider: z.enum(['fake', 'live']),
  connection: connectionViewSchema.nullable(),
});

export const syncEventViewSchema = z.object({
  id: z.uuid(),
  connectorKey: z.enum(connectorKeys),
  kind: z.string(),
  status: z.enum(['applied', 'ignored', 'rejected', 'failed']),
  reason: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const integrationsSchema = z.object({
  connectors: z.array(connectorViewSchema),
  events: z.array(syncEventViewSchema),
  /** Wichtigster offener Punkt für die Tinte-Karte */
  issue: z
    .object({ kind: z.enum(['error', 'failed_items']), connectorKey: z.enum(connectorKeys), count: z.number().int() })
    .nullable(),
});
export type Integrations = z.infer<typeof integrationsSchema>;

export const myConnectionsSchema = z.object({
  connections: z.array(
    z.object({ connectorKey: z.enum(connectorKeys), connection: connectionViewSchema }),
  ),
  /** Anbindungen, die eine Person für sich verbinden kann (Kalender, Outlook-Add-in) */
  available: z.array(z.enum(connectorKeys)),
});
export type MyConnections = z.infer<typeof myConnectionsSchema>;

export const connectRequestSchema = z
  .object({
    scope: z.enum(['org', 'user']).default('org'),
    parts: z.array(z.string().min(1).max(40)).max(10).optional(),
  })
  .strict();
export type ConnectRequest = z.infer<typeof connectRequestSchema>;

export const updatePartsSchema = z.object({ parts: z.array(z.string().min(1).max(40)).max(10) }).strict();

// IN-02 Anmeldung über Microsoft und Google

export const ssoProviders = ['entra', 'google'] as const;
export type SsoProvider = (typeof ssoProviders)[number];

export const ssoDomainSchema = z.object({
  domain: z.string(),
  /** DNS-Eintrag (TXT) zur Bestätigung */
  recordName: z.string(),
  recordValue: z.string(),
  verifiedAt: z.iso.datetime().nullable(),
});

export const ssoSettingsSchema = z.object({
  provider: z.enum(ssoProviders),
  tenantId: z.string().nullable(),
  hostedDomain: z.string().nullable(),
  domains: z.array(ssoDomainSchema),
  defaultRole: z.enum(['admin', 'member', 'viewer']),
  passwordLoginAllowed: z.boolean(),
  status: z.enum(['draft', 'active']),
});
export type SsoSettings = z.infer<typeof ssoSettingsSchema>;

export const ssoOverviewSchema = z.object({
  entra: ssoSettingsSchema.nullable(),
  google: ssoSettingsSchema.nullable(),
});
export type SsoOverview = z.infer<typeof ssoOverviewSchema>;

const domainName = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, 'domain');

export const saveSsoSchema = z
  .object({
    tenantId: z.string().trim().min(1).max(100).nullable().default(null),
    hostedDomain: domainName.nullable().default(null),
    domains: z.array(domainName).min(1).max(20),
    defaultRole: z.enum(['admin', 'member', 'viewer']).default('viewer'),
    passwordLoginAllowed: z.boolean().default(true),
  })
  .strict();
export type SaveSso = z.input<typeof saveSsoSchema>;

/** Anmeldeseite: führt eine Mail zu Microsoft oder Google? */
export const ssoHintRequestSchema = z.object({ email: z.email() }).strict();
export const ssoHintSchema = z.object({
  provider: z.enum(ssoProviders).nullable(),
  /** Scope für Zitadel, der direkt zum Anbieter führt */
  scope: z.string().nullable(),
});
export type SsoHint = z.infer<typeof ssoHintSchema>;
