import { apiObjectTypes, maxApiRows } from '@reziproq/shared';

/** IN-07: Beschreibung der Import-API (OpenAPI 3.1), ausgeliefert unter /api/v1/openapi.json */
export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Reziproq Import-API',
    version: '1.0.0',
    description:
      'Lieferantenstamm und Spend aus der Middleware des Kunden. Alles läuft in dieselbe Prüfung wie der Datei-Import. Beträge als Dezimalzahl mit Punkt, Monate als YYYY-MM, Datumswerte nach ISO 8601. Felder außerhalb des Modells werden ignoriert und gemeldet. Höchstens 60 Aufrufe je Minute und Schlüssel (sonst 429 mit Retry-After).',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
    schemas: {
      Supplier: {
        type: 'object',
        required: ['external_number', 'name', 'country'],
        properties: {
          external_number: { type: 'string' },
          name: { type: 'string' },
          country: { type: 'string', description: 'ISO 3166-1 alpha-2' },
          vat_id: { type: 'string', description: 'vat_id oder duns ist Pflicht' },
          duns: { type: 'string' },
          parent_external_number: { type: 'string' },
        },
      },
      Spend: {
        type: 'object',
        required: ['supplier_external_number', 'period', 'amount', 'currency'],
        properties: {
          supplier_external_number: { type: 'string' },
          period: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' },
          amount: { type: 'string', description: 'Dezimalzahl mit Punkt, z. B. 1234.56' },
          currency: { type: 'string', description: 'ISO 4217; heute nur EUR' },
          material_group: { type: 'string', description: 'material_group oder account ist Pflicht' },
          account: { type: 'string' },
          business_unit: { type: 'string' },
        },
      },
      BatchRequest: {
        type: 'object',
        required: ['object_type', 'idempotency_key', 'rows'],
        properties: {
          object_type: {
            type: 'string',
            enum: [...apiObjectTypes],
            description: 'Heute übernommen: supplier, spend. Die anderen antworten mit 422.',
          },
          idempotency_key: {
            type: 'string',
            description: 'Gleicher Schlüssel innerhalb von 24 Stunden ergibt dieselbe Antwort.',
          },
          rows: { type: 'array', maxItems: maxApiRows, items: { type: 'object' } },
          batch_id: { type: 'string', format: 'uuid', description: 'Weitere Teile einer Lieferung' },
          final: { type: 'boolean', default: true },
        },
      },
      BatchResponse: {
        type: 'object',
        properties: {
          batch_id: { type: 'string', format: 'uuid' },
          object_type: { type: 'string' },
          status: { type: 'string', enum: ['receiving', 'processing', 'review', 'committed', 'failed'] },
          rows: {
            type: 'object',
            properties: {
              received: { type: 'integer' },
              ok: { type: 'integer' },
              review: { type: 'integer' },
              error: { type: 'integer' },
            },
          },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                row: { type: 'integer' },
                field: { type: 'string' },
                reason: { type: 'string' },
              },
            },
          },
          ignored_fields: { type: 'array', items: { type: 'string' } },
          review_batch_id: { type: ['string', 'null'], format: 'uuid' },
        },
      },
    },
  },
  security: [{ bearer: [] }],
  paths: {
    '/batches': {
      post: {
        summary: 'Lieferung anlegen oder fortsetzen',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/BatchRequest' } } },
        },
        responses: {
          '202': {
            description: 'Angenommen, Verarbeitung im Hintergrund',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/BatchResponse' } },
            },
          },
          '401': { description: 'Schlüssel fehlt, unbekannt oder widerrufen' },
          '403': { description: 'Objektart für diesen Schlüssel nicht erlaubt' },
          '422': { description: 'Objektart wird noch nicht übernommen' },
          '429': { description: 'Zu viele Aufrufe; Retry-After nennt die Sekunden' },
        },
      },
    },
    '/batches/{id}': {
      get: {
        summary: 'Stand, Zeilen je Status und Fehler je Zeile einer eigenen Lieferung',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Stand der Lieferung',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/BatchResponse' } },
            },
          },
          '404': { description: 'Keine eigene Lieferung' },
        },
      },
    },
  },
} as const;
