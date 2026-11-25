import { z } from 'zod';

// IN-07 Import-API: Objektarten, Schlüssel und Lieferungen. Die Lieferungen laufen in denselben
// Stapel wie der Datei-Import (KI-15).

export const apiObjectTypes = [
  'supplier',
  'category_map',
  'spend',
  'order_line',
  'goods_receipt',
  'credit_note',
  'contract',
  'quality_notification',
] as const;
export type ApiObjectType = (typeof apiObjectTypes)[number];

/** Objektarten, die Reziproq heute übernimmt; die anderen folgen mit KI-19 (Schritt 35) */
export const supportedApiObjectTypes = ['supplier', 'spend'] as const satisfies ApiObjectType[];

/** Höchstens so viele Zeilen je Aufruf */
export const maxApiRows = 10_000;
/** Aufrufe je Minute und Schlüssel */
export const apiCallsPerMinute = 60;

export const apiKeyViewSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** Anfang des Schlüssels zum Wiedererkennen, nie der ganze Schlüssel */
  prefix: z.string(),
  scopes: z.array(z.enum(apiObjectTypes)),
  createdByName: z.string(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
});
export type ApiKeyView = z.infer<typeof apiKeyViewSchema>;

export const apiKeysSchema = z.object({
  keys: z.array(apiKeyViewSchema),
  /** Letzte Lieferung über die API, für die Seite Anbindungen */
  lastDelivery: z
    .object({
      batchId: z.uuid(),
      createdAt: z.iso.datetime(),
      status: z.string(),
      rowsTotal: z.number().int(),
      rowsError: z.number().int(),
    })
    .nullable(),
});
export type ApiKeys = z.infer<typeof apiKeysSchema>;

export const createApiKeySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    scopes: z.array(z.enum(apiObjectTypes)).min(1),
  })
  .strict();
export type CreateApiKey = z.infer<typeof createApiKeySchema>;

/** Antwort beim Erzeugen: der Schlüssel steht nur hier im Klartext, ein einziges Mal */
export const createdApiKeySchema = apiKeysSchema.extend({ secret: z.string() });
export type CreatedApiKey = z.infer<typeof createdApiKeySchema>;

/** POST /api/v1/batches */
export const apiBatchRequestSchema = z.object({
  object_type: z.enum(apiObjectTypes),
  idempotency_key: z.string().min(1).max(200),
  rows: z.array(z.record(z.string(), z.unknown())).max(maxApiRows),
  /** Weitere Teile einer Lieferung an eine offene Lieferung anhängen */
  batch_id: z.uuid().optional(),
  /** Ohne final: true bleibt die Lieferung offen für weitere Teile */
  final: z.boolean().default(true),
});
export type ApiBatchRequest = z.infer<typeof apiBatchRequestSchema>;

export const apiBatchStatuses = [
  'receiving',
  'processing',
  'review',
  'committed',
  'failed',
] as const;

export const apiBatchResponseSchema = z.object({
  batch_id: z.uuid(),
  object_type: z.enum(apiObjectTypes),
  status: z.enum(apiBatchStatuses),
  rows: z.object({
    received: z.number().int(),
    ok: z.number().int(),
    review: z.number().int(),
    error: z.number().int(),
  }),
  errors: z.array(z.object({ row: z.number().int(), field: z.string(), reason: z.string() })),
  ignored_fields: z.array(z.string()),
  /** Lieferung mit den Zeilen, die auf Prüfung warten (Einstellungen › Daten › Import) */
  review_batch_id: z.uuid().nullable(),
});
export type ApiBatchResponse = z.infer<typeof apiBatchResponseSchema>;
