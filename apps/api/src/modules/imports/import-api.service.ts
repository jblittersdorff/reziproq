import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq, schema, sql, systemTime, type TenantTransaction } from '@reziproq/db';
import {
  type ApiBatchRequest,
  type ApiBatchResponse,
  type ApiObjectType,
  apiCallsPerMinute,
  maxImportRows,
  supportedApiObjectTypes,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { actorIn } from '../integrations/actor.js';
import type { ApiPrincipal } from '../integrations/api-keys.service.js';
import { IntegrationsService } from '../integrations/integrations.service.js';
import { type DeliveryJob, ImportApiQueue } from './import-api.queue.js';
import {
  type ApiRowError,
  apiColumnMap,
  apiKinds,
  fieldOfImportError,
  mapApiRow,
} from './import-api.rules.js';
import { ImportsService } from './imports.service.js';

const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const idempotencyHours = 24;

type BatchRow = typeof schema.importBatch.$inferSelect;

/** Ratenbegrenzung je Schlüssel: höchstens 60 Aufrufe in 60 Sekunden (im Prozess) */
export class KeyRateLimit {
  private readonly calls = new Map<string, number[]>();

  constructor(private readonly limit = apiCallsPerMinute) {}

  /** Sekunden bis zum nächsten erlaubten Aufruf; 0, wenn der Aufruf zählt */
  take(key: string, now = systemTime().getTime()): number {
    const recent = (this.calls.get(key) ?? []).filter((time) => now - time < 60_000);
    if (recent.length >= this.limit) {
      this.calls.set(key, recent);
      return Math.max(1, Math.ceil(((recent[0] ?? now) + 60_000 - now) / 1000));
    }
    recent.push(now);
    this.calls.set(key, recent);
    return 0;
  }
}

/**
 * IN-07 Import-API: Lieferungen der Middleware laufen in denselben Stapel wie der Datei-Import
 * (KI-15). Antwort sofort, Verarbeitung im Job: Zuordnung, Prüfwarteschlange, Übernahme. Zeilen zur
 * Prüfung wandern in eine eigene Lieferung, der Rest wird übernommen.
 */
@Injectable()
export class ImportApiService {
  private readonly logger = new Logger(ImportApiService.name);
  readonly rateLimit = new KeyRateLimit();

  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(ImportsService) private readonly imports: ImportsService,
    @Inject(IntegrationsService) private readonly integrations: IntegrationsService,
    @Inject(ImportApiQueue) private readonly queue: ImportApiQueue,
  ) {}

  private session(principal: ApiPrincipal) {
    return { userId: principal.actor.userId, organizationId: principal.orgId };
  }

  async deliver(principal: ApiPrincipal, input: ApiBatchRequest): Promise<ApiBatchResponse> {
    const type = input.object_type;
    if (!principal.scopes.includes(type)) {
      throw new ForbiddenException({ statusCode: 403, code: 'objektart_nicht_erlaubt' });
    }
    if (!(supportedApiObjectTypes as readonly string[]).includes(type)) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'objektart_folgt',
        message: `Reziproq übernimmt ${type} noch nicht. Heute: supplier und spend.`,
      });
    }
    const kind = apiKinds[type as keyof typeof apiKinds];
    const session = this.session(principal);
    const result = await this.tenant.run(session, async (tx) => {
      // Gleiche idempotency_key in 24 Stunden: dieselbe Antwort, nichts Neues
      const [earlier] = await tx
        .select({ response: schema.importBatch.apiResponse })
        .from(schema.importBatch)
        .where(
          and(
            eq(schema.importBatch.orgId, principal.orgId),
            eq(schema.importBatch.apiKeyId, principal.keyId),
            sql`${schema.importBatch.apiResponse} ? ${input.idempotency_key}`,
            sql`${schema.importBatch.createdAt} > app_system_now() - make_interval(hours => ${idempotencyHours})`,
          ),
        );
      const replay = earlier?.response?.[input.idempotency_key];
      if (replay) return { response: replay as ApiBatchResponse, queue: false };

      let batch: BatchRow | undefined;
      if (input.batch_id) {
        [batch] = await tx
          .select()
          .from(schema.importBatch)
          .where(
            and(
              eq(schema.importBatch.id, input.batch_id),
              eq(schema.importBatch.orgId, principal.orgId),
              eq(schema.importBatch.apiKeyId, principal.keyId),
            ),
          );
        if (!batch) throw notFound();
        if (batch.status !== 'uploaded' || batch.kind !== kind) {
          throw new ConflictException({ statusCode: 409, code: 'lieferung_abgeschlossen' });
        }
      }
      const base = batch ? batch.rowsTotal + batch.apiErrors.length : 0;
      if (base + input.rows.length > maxImportRows) {
        throw new PayloadTooLargeException({ statusCode: 413, code: 'zu_viele_zeilen' });
      }
      const ignored = new Set<string>(batch?.ignoredFields ?? []);
      const errors: ApiRowError[] = [...(batch?.apiErrors ?? [])];
      const accepted: { rowNo: number; raw: Record<string, string> }[] = [];
      input.rows.forEach((row, index) => {
        const rowNo = base + index + 1;
        const mapped = mapApiRow(type, row, rowNo, ignored);
        if ('errors' in mapped) errors.push(...mapped.errors);
        else accepted.push({ rowNo, raw: mapped.raw });
      });
      const status = input.final ? 'mapped' : 'uploaded';
      if (!batch) {
        const map = apiColumnMap(type);
        [batch] = await tx
          .insert(schema.importBatch)
          .values({
            orgId: principal.orgId,
            kind,
            fileName: principal.keyName,
            fileHash: `api:${principal.keyId}:${input.idempotency_key}`,
            headers: Object.values(map),
            columnMap: map,
            suggestedMap: map,
            status,
            rowsTotal: accepted.length,
            createdBy: principal.actor.userId,
            createdByName: principal.keyName,
            source: 'api',
            apiKeyId: principal.keyId,
            idempotencyKey: input.idempotency_key,
            apiErrors: errors,
            ignoredFields: [...ignored].sort(),
          })
          .returning();
      } else {
        [batch] = await tx
          .update(schema.importBatch)
          .set({
            status,
            rowsTotal: batch.rowsTotal + accepted.length,
            apiErrors: errors,
            ignoredFields: [...ignored].sort(),
          })
          .where(eq(schema.importBatch.id, batch.id))
          .returning();
      }
      if (!batch) throw notFound();
      for (let start = 0; start < accepted.length; start += 1000) {
        await tx.insert(schema.importRow).values(
          accepted.slice(start, start + 1000).map((row) => ({
            orgId: principal.orgId,
            batchId: batch?.id ?? '',
            rowNo: row.rowNo,
            raw: row.raw,
            status: 'review' as const,
          })),
        );
      }
      const response = this.response(batch, type, null, null);
      await tx
        .update(schema.importBatch)
        .set({
          apiResponse: sql`coalesce(${schema.importBatch.apiResponse}, '{}'::jsonb) || ${JSON.stringify({ [input.idempotency_key]: response })}::jsonb`,
        })
        .where(eq(schema.importBatch.id, batch.id));
      return { response, queue: input.final };
    });
    if (result.queue) {
      await this.queue.send({ orgId: principal.orgId, batchId: result.response.batch_id });
    }
    return result.response;
  }

  /** Stand einer eigenen Lieferung; Lieferungen anderer Schlüssel und Kunden gibt es hier nicht. */
  async status(principal: ApiPrincipal, id: string): Promise<ApiBatchResponse> {
    return this.tenant.run(
      this.session(principal),
      async (tx) => {
        const [batch] = await tx
          .select()
          .from(schema.importBatch)
          .where(
            and(
              eq(schema.importBatch.id, id),
              eq(schema.importBatch.orgId, principal.orgId),
              eq(schema.importBatch.apiKeyId, principal.keyId),
              eq(schema.importBatch.source, 'api'),
            ),
          );
        if (!batch || batch.deliveryId) throw notFound();
        const [follow] = await tx
          .select()
          .from(schema.importBatch)
          .where(
            and(
              eq(schema.importBatch.orgId, principal.orgId),
              eq(schema.importBatch.deliveryId, id),
            ),
          );
        const type = (Object.entries(apiKinds).find(([, kind]) => kind === batch.kind)?.[0] ??
          'spend') as ApiObjectType;
        return this.response(batch, type, follow ?? null, await this.rowErrors(tx, type, id));
      },
      { readOnly: true },
    );
  }

  private async rowErrors(tx: TenantTransaction, type: ApiObjectType, batchId: string) {
    const rows = await tx
      .select({ rowNo: schema.importRow.rowNo, error: schema.importRow.error })
      .from(schema.importRow)
      .where(and(eq(schema.importRow.batchId, batchId), eq(schema.importRow.status, 'error')))
      .orderBy(schema.importRow.rowNo)
      .limit(1000);
    return rows.map((row) => ({
      row: row.rowNo,
      field: fieldOfImportError(type, row.error ?? ''),
      reason: row.error ?? 'Fehler',
    }));
  }

  private response(
    batch: BatchRow,
    type: ApiObjectType,
    follow: BatchRow | null,
    rowErrors: ApiRowError[] | null,
  ): ApiBatchResponse {
    const status =
      batch.status === 'uploaded'
        ? 'receiving'
        : batch.status === 'committed'
          ? 'committed'
          : batch.status === 'failed'
            ? 'failed'
            : batch.status === 'review' && follow === null && rowErrors !== null
              ? 'review'
              : 'processing';
    const errors = [...batch.apiErrors, ...(rowErrors ?? [])].sort((a, b) => a.row - b.row);
    return {
      batch_id: batch.id,
      object_type: type,
      status,
      rows: {
        received: batch.rowsTotal + (follow?.rowsTotal ?? 0) + batch.apiErrors.length,
        ok: batch.status === 'committed' ? batch.rowsOk : 0,
        review: follow?.rowsReview ?? 0,
        error: errors.length,
      },
      errors: errors.slice(0, 1000),
      ignored_fields: batch.ignoredFields,
      review_batch_id: follow?.id ?? null,
    };
  }

  /** Im Job: zuordnen (KI-15), offene Zeilen abspalten, den Rest übernehmen, Stand melden. */
  async runDelivery(job: DeliveryJob): Promise<void> {
    const [batch] = await this.tenant.run(
      { userId: 'system:import-api', organizationId: job.orgId },
      (tx) => tx.select().from(schema.importBatch).where(eq(schema.importBatch.id, job.batchId)),
    );
    if (batch?.status !== 'mapped') return;
    const actor = await this.tenant.run(
      { userId: batch.createdBy, organizationId: job.orgId },
      (tx) => actorIn(tx, job.orgId, batch.createdBy),
    );
    try {
      if (!actor) throw new Error('person_fehlt');
      await this.imports.process(actor, batch.id);
      await this.imports.splitOpenRows(actor, batch.id);
      await this.imports.commit(actor, batch.id);
    } catch (error) {
      const code =
        error instanceof HttpException
          ? ((error.getResponse() as { code?: string }).code ?? 'fehler')
          : error instanceof Error
            ? error.message
            : 'fehler';
      this.logger.warn(`Lieferung ${batch.id} gescheitert: ${code}`);
      await this.tenant.run({ userId: 'system:import-api', organizationId: job.orgId }, (tx) =>
        tx
          .update(schema.importBatch)
          .set({ status: 'failed' })
          .where(eq(schema.importBatch.id, batch.id)),
      );
    }
    const [done] = await this.tenant.run(
      { userId: 'system:import-api', organizationId: job.orgId },
      (tx) => tx.select().from(schema.importBatch).where(eq(schema.importBatch.id, job.batchId)),
    );
    if (!done) return;
    await this.integrations.recordDelivery(job.orgId, {
      itemsIn: done.rowsTotal + done.apiErrors.length,
      itemsOk: done.status === 'committed' ? done.rowsOk : 0,
      itemsFailed: done.rowsError + done.apiErrors.length,
    });
  }
}
