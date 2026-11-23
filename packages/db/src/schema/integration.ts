import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organization } from './organization.js';

const orgId = () =>
  uuid()
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' });
const time = () => timestamp({ withTimezone: true });

/**
 * IN-01: Verbindung einer Organisation oder einer Person zu einer Anbindung aus der Registry im
 * Code (connector_key). org_private; Zugangsdaten stehen getrennt in connection_secret.
 */
export const connection = pgTable(
  'connection',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: orgId(),
    connectorKey: text().notNull(),
    scope: text({ enum: ['org', 'user'] }).notNull(),
    userId: text(),
    status: text({ enum: ['pending', 'active', 'error', 'revoked'] }).notNull().default('pending'),
    parts: jsonb().$type<string[]>().notNull().default([]),
    settings: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    connectedBy: text().notNull(),
    connectedAt: time().notNull().defaultNow(),
    revokedAt: time(),
  },
  (table) => [
    unique('connection_org_id').on(table.orgId, table.id),
    check('connection_scope', sql`(${table.scope} = 'user') = (${table.userId} is not null)`),
    check('connection_status', sql`${table.status} in ('pending', 'active', 'error', 'revoked')`),
    index('connection_org').on(table.orgId, table.connectorKey),
  ],
);

/** Verschlüsselte Zugangsdaten; nur die Integrationsschicht liest sie. org_private. */
export const connectionSecret = pgTable(
  'connection_secret',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: orgId(),
    connectionId: uuid()
      .notNull()
      .references(() => connection.id, { onDelete: 'cascade' }),
    kind: text({ enum: ['oauth', 'api_key', 'webhook_secret'] }).notNull(),
    ciphertext: text().notNull(),
    keyRef: text().notNull(),
    expiresAt: time(),
    rotatedAt: time(),
  },
  (table) => [
    check('connection_secret_kind', sql`${table.kind} in ('oauth', 'api_key', 'webhook_secret')`),
    index('connection_secret_connection').on(table.connectionId),
  ],
);

/** Abgleich im Hintergrund; ein Fehler in einem Element stoppt den Job nicht. org_private. */
export const syncJob = pgTable(
  'sync_job',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: orgId(),
    connectionId: uuid()
      .notNull()
      .references(() => connection.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    status: text({ enum: ['queued', 'running', 'done', 'failed'] }).notNull().default('queued'),
    itemsIn: integer().notNull().default(0),
    itemsOk: integer().notNull().default(0),
    itemsFailed: integer().notNull().default(0),
    startedAt: time(),
    finishedAt: time(),
    error: text(),
    createdAt: time().notNull().defaultNow(),
  },
  (table) => [
    check('sync_job_status', sql`${table.status} in ('queued', 'running', 'done', 'failed')`),
    index('sync_job_connection').on(table.connectionId, table.createdAt),
  ],
);

/** Ereignis je Element; idempotent über external_id (nur ein angewandtes je Element). org_private. */
export const syncEvent = pgTable(
  'sync_event',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: orgId(),
    connectionId: uuid()
      .notNull()
      .references(() => connection.id, { onDelete: 'cascade' }),
    jobId: uuid(),
    direction: text({ enum: ['in', 'out'] }).notNull(),
    kind: text().notNull(),
    externalId: text(),
    objectType: text(),
    objectId: uuid(),
    status: text({ enum: ['applied', 'ignored', 'rejected', 'failed'] }).notNull(),
    reason: text(),
    createdAt: time().notNull().defaultNow(),
  },
  (table) => [
    check('sync_event_direction', sql`${table.direction} in ('in', 'out')`),
    check('sync_event_status', sql`${table.status} in ('applied', 'ignored', 'rejected', 'failed')`),
    uniqueIndex('sync_event_applied_once')
      .on(table.connectionId, table.kind, table.externalId)
      .where(sql`${table.status} = 'applied'`),
    index('sync_event_org_time').on(table.orgId, table.createdAt),
  ],
);

/** Adresse für eingehende Webhooks; das Geheimnis liegt in connection_secret. org_private. */
export const inboundHook = pgTable(
  'inbound_hook',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: orgId(),
    connectionId: uuid()
      .notNull()
      .references(() => connection.id, { onDelete: 'cascade' }),
    pathToken: text().notNull(),
    secretRef: uuid().notNull(),
    lastSeenAt: time(),
  },
  (table) => [unique('inbound_hook_token').on(table.pathToken)],
);

/**
 * IN-07: Technischer Zugang für die Import-API. Der Schlüssel wird einmal angezeigt und nur als
 * Hash (SHA-256) gespeichert; scopes sind die erlaubten Objektarten. org_private.
 */
export const apiKey = pgTable(
  'api_key',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: orgId(),
    name: text().notNull(),
    prefix: text().notNull(),
    hash: text().notNull(),
    scopes: jsonb().$type<string[]>().notNull().default([]),
    createdBy: text().notNull(),
    createdAt: time().notNull().defaultNow(),
    lastUsedAt: time(),
    revokedAt: time(),
  },
  (table) => [unique('api_key_hash').on(table.hash), index('api_key_org').on(table.orgId)],
);
