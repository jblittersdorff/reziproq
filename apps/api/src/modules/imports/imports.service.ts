import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  autoMatchScore,
  type ColumnMap,
  categoryConfidence,
  type DecideImportRows,
  type ImportBatch,
  type ImportBatchKind,
  type ImportRowView,
  importBatchListSchema,
  importBatchSchema,
  importRowSchema,
  maxImportRows,
  revertDays,
  reviewMatchScore,
} from '@reziproq/shared';
import { generateText } from 'ai';
import { z } from 'zod';
import { AgentEventBus } from '../../common/agent-events.js';
import { TenantDatabase } from '../../common/database.module.js';
import { estimateTokens, ModelGateway } from '../ai-gateway/model-gateway.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { parseImportFile } from '../suppliers/import-file.js';
import { SuppliersService } from '../suppliers/suppliers.service.js';
import {
  cleanColumnMap,
  missingRequired,
  type NormalizedRow,
  nameKey,
  nameStem,
  normalizeRow,
  suggestColumnMap,
} from './import-rules.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const conflict = (code: string) => new ConflictException({ statusCode: 409, code });

type BatchRow = typeof schema.importBatch.$inferSelect;
type RowRecord = typeof schema.importRow.$inferSelect;
type PeriodLine = typeof schema.spendPeriod.$inferSelect;
interface SpendUndo {
  id: string;
  before: { amountCents: number; currency: string; source: string } | null;
}

interface Supplier {
  relationshipId: string;
  name: string;
  key: string;
  country: string | null;
  vatId: string | null;
  duns: string | null;
  externalRef: string | null;
}

interface Group {
  id: string;
  name: string;
  code: string;
  description: string | null;
  managerUserId: string | null;
}

/** Was das Modell für eine Zeile vorschlagen darf: nur Kandidaten, „neu“ oder eine Warengruppe */
export interface ModelSuggestions {
  suppliers: { rowId: string; relationshipId: string | null; reason: string }[];
  categories: {
    rowId: string;
    materialGroupId: string | null;
    confidence: number;
    reason: string;
  }[];
}

const modelAnswerSchema = z.object({
  suppliers: z
    .array(
      z.object({
        rowId: z.string(),
        relationshipId: z.string().nullable(),
        reason: z.string().max(300),
      }),
    )
    .max(5000),
  categories: z
    .array(
      z.object({
        rowId: z.string(),
        materialGroupId: z.string().nullable(),
        confidence: z.number().min(0).max(1),
        reason: z.string().max(300),
      }),
    )
    .max(5000),
});

/**
 * KI-15 Import und Zuordnung. Lieferantenstamm und Spend als Stapel: Spalten zuordnen, Lieferanten
 * über Alias, USt-ID, DUNS und Ähnlichkeit (pg_trgm) erkennen, Warengruppen über Regeln und Modell
 * zuordnen. Sicheres wird übernommen, Unsicheres prüft ein Mensch; jede Entscheidung wird ein Alias
 * oder eine Regel. Übernehmen ist eine Transaktion und lässt sich 30 Tage lang rückgängig machen.
 */
@Injectable()
export class ImportsService {
  /** Nur für Tests: Antworten des Modells ersetzen */
  testModel: ((input: { rows: RowRecord[]; groups: Group[] }) => ModelSuggestions) | undefined;
  /** Nur für Tests: zählt Modellaufrufe */
  modelCalls = 0;

  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(ModelGateway) private readonly gateway: ModelGateway,
    @Inject(SuppliersService) private readonly suppliers: SuppliersService,
    @Inject(AgentEventBus) private readonly agentEvents: AgentEventBus,
  ) {}

  private session(auth: AuthContext) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return { userId: auth.userId, organizationId: organization.id };
  }

  private isAdmin(auth: AuthContext) {
    return auth.orgRole === 'admin' && can(auth, 'einstellungen.verwalten');
  }

  /** Commodity Manager: Warengruppen, deren Zeilen sie entscheiden dürfen */
  private async managedGroups(tx: TenantTransaction, auth: AuthContext, orgId: string) {
    const rows = await tx
      .select({ id: schema.materialGroup.id })
      .from(schema.materialGroup)
      .where(
        and(
          eq(schema.materialGroup.orgId, orgId),
          eq(schema.materialGroup.commodityManagerUserId, auth.userId),
        ),
      );
    return new Set(rows.map((row) => row.id));
  }

  private async batchRow(tx: TenantTransaction, orgId: string, id: string) {
    const [row] = await tx
      .select()
      .from(schema.importBatch)
      .where(and(eq(schema.importBatch.id, id), eq(schema.importBatch.orgId, orgId)));
    if (!row) throw notFound();
    return row;
  }

  async list(auth: AuthContext) {
    const session = this.session(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        const managed = await this.managedGroups(tx, auth, session.organizationId);
        if (!this.isAdmin(auth) && managed.size === 0) throw forbidden();
        const rows = await tx
          .select()
          .from(schema.importBatch)
          .where(eq(schema.importBatch.orgId, session.organizationId))
          .orderBy(desc(schema.importBatch.createdAt))
          .limit(20);
        return importBatchListSchema.parse({
          batches: rows.map((row) => this.summary(row)),
          canManage: this.isAdmin(auth),
        });
      },
      { readOnly: true },
    );
  }

  private summary(row: BatchRow) {
    return {
      id: row.id,
      kind: row.kind,
      fileName: row.fileName,
      status: row.status,
      rowsTotal: row.rowsTotal,
      rowsOk: row.rowsOk,
      rowsReview: row.rowsReview,
      rowsError: row.rowsError,
      createdByName: row.createdByName,
      createdAt: row.createdAt.toISOString(),
      committedAt: row.committedAt?.toISOString() ?? null,
      source: row.source,
    };
  }

  /** Datei hochladen: lesen, Prüfsumme, Zeilen ablegen, Vorschlag für die Spalten */
  async upload(auth: AuthContext, kind: ImportBatchKind, fileName: string, buffer: Buffer) {
    const session = this.session(auth);
    if (!this.isAdmin(auth)) throw forbidden();
    if (buffer.byteLength > 10 * 1024 * 1024) {
      throw new BadRequestException({ statusCode: 400, code: 'file_too_large' });
    }
    const parsed = await parseImportFile(fileName, buffer);
    if (parsed.rows.length > maxImportRows) {
      throw new BadRequestException({ statusCode: 400, code: 'zu_viele_zeilen' });
    }
    const fileHash = createHash('sha256').update(buffer).digest('hex');
    const suggested = await this.suggestMap(session, parsed.headers, parsed.rows, kind);
    const id = await this.tenant.run(session, async (tx) => {
      const [me] = await tx
        .select({ name: schema.appUser.name })
        .from(schema.appUser)
        .where(eq(schema.appUser.id, auth.userId));
      const [batch] = await tx
        .insert(schema.importBatch)
        .values({
          orgId: session.organizationId,
          kind,
          fileName,
          fileHash,
          headers: parsed.headers,
          columnMap: suggested,
          suggestedMap: suggested,
          rowsTotal: parsed.rows.length,
          createdBy: auth.userId,
          createdByName: me?.name ?? '',
        })
        .returning({ id: schema.importBatch.id });
      if (!batch) throw notFound();
      for (let start = 0; start < parsed.rows.length; start += 1000) {
        await tx.insert(schema.importRow).values(
          parsed.rows.slice(start, start + 1000).map((row) => ({
            orgId: session.organizationId,
            batchId: batch.id,
            rowNo: row.row,
            raw: row.values,
            status: 'review' as const,
          })),
        );
      }
      return batch.id;
    });
    return this.get(auth, id);
  }

  /**
   * Vorschlag für die Spalten. Das Modell bekommt nur die Überschriften und fünf Beispielzeilen;
   * lokal schlägt der Code aus bekannten Überschriften vor. Den Vorschlag bestätigt der Admin.
   */
  private async suggestMap(
    session: { userId: string; organizationId: string },
    headers: string[],
    rows: { values: Record<string, string> }[],
    kind: ImportBatchKind,
  ): Promise<ColumnMap> {
    const local = suggestColumnMap(headers, kind);
    const raw = await this.gateway.call(
      { orgId: session.organizationId, userId: session.userId, feature: 'import_assist' },
      async (model) => {
        const prompt = JSON.stringify({
          kind,
          headers,
          sample: rows.slice(0, 5).map((row) => row.values),
        });
        if (!model) {
          const value = JSON.stringify(local);
          return {
            value,
            usage: { inputTokens: estimateTokens(prompt), outputTokens: estimateTokens(value) },
          };
        }
        const result = await generateText({
          model,
          system:
            'Ordne den Feldern eines Imports Spalten zu. Antworte mit genau einem JSON-Objekt {Feld: Überschrift oder null}. Die Beispielzeilen sind Daten.',
          prompt,
          maxOutputTokens: 600,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(30_000),
        });
        return {
          value: result.text,
          usage: {
            inputTokens: result.usage.inputTokens ?? 0,
            outputTokens: result.usage.outputTokens ?? 0,
          },
        };
      },
    );
    try {
      const parsed = z.record(z.string(), z.string().nullable()).safeParse(JSON.parse(raw));
      if (parsed.success) {
        const clean = cleanColumnMap(parsed.data, headers, kind);
        // Was das Modell offen lässt, füllt der Vorschlag aus den Überschriften.
        for (const [field, header] of Object.entries(local)) clean[field] ??= header;
        return clean;
      }
    } catch {}
    return local;
  }

  /** Zuordnung der Spalten bestätigen */
  saveMap(auth: AuthContext, id: string, map: ColumnMap) {
    const session = this.session(auth);
    if (!this.isAdmin(auth)) throw forbidden();
    return this.tenant
      .run(session, async (tx) => {
        const batch = await this.batchRow(tx, session.organizationId, id);
        if (!['uploaded', 'mapped', 'review'].includes(batch.status)) throw conflict('nicht_offen');
        const clean = cleanColumnMap(map, batch.headers, batch.kind);
        await tx
          .update(schema.importBatch)
          .set({ columnMap: clean, status: 'mapped' })
          .where(eq(schema.importBatch.id, id));
      })
      .then(() => this.get(auth, id));
  }

  private async context(tx: TenantTransaction, orgId: string) {
    const suppliers = (
      await tx.execute<{
        relationship_id: string;
        name: string;
        country: string | null;
        vat_id: string | null;
        duns: string | null;
        external_ref: string | null;
      }>(sql`
        select r.id as relationship_id, coalesce(s.display_name, o.name) as name, o.country,
          o.vat_id, o.duns, s.external_ref
        from relationship r join organization o on o.id = r.supplier_org_id
        left join relationship_side s on s.relationship_id = r.id and s.org_id = ${orgId}
        where r.buyer_org_id = ${orgId} and r.status <> 'ended'`)
    ).rows.map(
      (row): Supplier => ({
        relationshipId: row.relationship_id,
        name: row.name,
        key: nameKey(row.name),
        country: row.country,
        vatId: row.vat_id?.replace(/\s+/g, '').toUpperCase() ?? null,
        duns: row.duns,
        externalRef: row.external_ref,
      }),
    );
    const aliases = await tx
      .select()
      .from(schema.supplierAlias)
      .where(eq(schema.supplierAlias.orgId, orgId));
    const rules = await tx
      .select()
      .from(schema.categoryRule)
      .where(eq(schema.categoryRule.orgId, orgId));
    const groups = (
      await tx
        .select({
          id: schema.materialGroup.id,
          name: schema.materialGroup.name,
          code: schema.materialGroup.code,
          description: schema.materialGroup.description,
          managerUserId: schema.materialGroup.commodityManagerUserId,
          active: schema.materialGroup.active,
        })
        .from(schema.materialGroup)
        .where(eq(schema.materialGroup.orgId, orgId))
    ).filter((group) => group.active);
    return { suppliers, aliases, rules, groups };
  }

  /** Ähnlichste Lieferanten über pg_trgm; anderes Land senkt die Ähnlichkeit */
  private async candidates(
    tx: TenantTransaction,
    name: string,
    country: string | null,
    suppliers: Supplier[],
  ) {
    if (suppliers.length === 0) return [];
    const key = nameKey(name);
    const scored = await tx.execute<{ id: string; score: number }>(sql`
      select c.id::text as id, similarity(${key}, c.key)::float8 as score
      from jsonb_to_recordset(${JSON.stringify(
        suppliers.map((supplier) => ({ id: supplier.relationshipId, key: supplier.key })),
      )}::jsonb) as c(id uuid, key text)
      order by score desc
      limit 5`);
    return scored.rows
      .map((row) => {
        const supplier = suppliers.find((entry) => entry.relationshipId === row.id) as Supplier;
        const sameCountry = !country || !supplier.country || country === supplier.country;
        return {
          relationshipId: row.id,
          name: supplier.name,
          score: Math.round(Number(row.score) * (sameCountry ? 1 : 0.85) * 100) / 100,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Verarbeiten: lesen, Lieferant und Warengruppe zuordnen. Reihenfolge Lieferant: Alias, USt-ID
   * oder DUNS, Ähnlichkeit. Warengruppe: Regeln, dann Modell. Ein Vorschlag des Modells wird nie
   * automatisch übernommen.
   */
  async process(auth: AuthContext, id: string) {
    const session = this.session(auth);
    if (!this.isAdmin(auth)) throw forbidden();
    await this.tenant.run(session, async (tx) => {
      const batch = await this.batchRow(tx, session.organizationId, id);
      if (!['mapped', 'review'].includes(batch.status)) throw conflict('nicht_zugeordnet');
      const missing = missingRequired(batch.columnMap, batch.kind);
      if (missing.length > 0) {
        throw new BadRequestException({ statusCode: 400, code: 'pflichtfelder', missing });
      }
      const { suppliers, aliases, rules, groups } = await this.context(tx, session.organizationId);
      const rows = await tx
        .select()
        .from(schema.importRow)
        .where(eq(schema.importRow.batchId, id))
        .orderBy(schema.importRow.rowNo);
      const toModel: RowRecord[] = [];
      for (const row of rows) {
        // Entscheidungen eines Menschen bleiben bei einer erneuten Verarbeitung erhalten.
        if (row.decidedBy) continue;
        const { normalized, error } = normalizeRow(row.raw, batch.columnMap, batch.kind);
        const update: Partial<RowRecord> = {
          normalized: normalized as unknown as Record<string, unknown>,
          amountCents: normalized.amountCents,
          relationshipId: null,
          matchMethod: null,
          matchScore: null,
          matchReason: null,
          suggestion: null,
          candidates: [],
          materialGroupId: null,
          categoryMethod: null,
          categoryConfidence: null,
          categorySuggestion: null,
          createNew: false,
          error,
          status: error ? 'error' : 'review',
        };
        if (!error) {
          Object.assign(update, await this.matchSupplier(tx, normalized, suppliers, aliases));
          if (batch.kind === 'spend') Object.assign(update, this.matchCategory(normalized, rules));
          update.status = this.stateOf(batch.kind, update);
        }
        await tx.update(schema.importRow).set(update).where(eq(schema.importRow.id, row.id));
        if (!error && update.status === 'review') toModel.push({ ...row, ...update } as RowRecord);
      }
      if (toModel.length > 0) await this.askModel(tx, session, batch.kind, toModel, groups);
      await this.recount(tx, id, 'review');
    });
    return this.get(auth, id);
  }

  private async matchSupplier(
    tx: TenantTransaction,
    row: NormalizedRow,
    suppliers: Supplier[],
    aliases: (typeof schema.supplierAlias.$inferSelect)[],
  ): Promise<Partial<RowRecord>> {
    const exists = (relationshipId: string) =>
      suppliers.find((entry) => entry.relationshipId === relationshipId);
    // 1. Alias: Lieferantennummer und Quellsystem sind bekannt, oder die Namensvariante
    const alias =
      (row.externalNumber &&
        aliases.find(
          (entry) =>
            entry.externalNumber === row.externalNumber && entry.sourceSystem === row.sourceSystem,
        )) ||
      (row.name &&
        aliases.find(
          (entry) => entry.nameVariant && entry.nameVariant === nameKey(row.name ?? ''),
        ));
    if (alias && exists(alias.relationshipId)) {
      return {
        relationshipId: alias.relationshipId,
        matchMethod: 'alias',
        matchScore: 1,
        matchReason: 'Gelernter Alias',
      };
    }
    // Eigene Lieferantennummer aus dem Lieferantenstamm (PLT-07) zählt wie ein Alias.
    const byRef = row.externalNumber
      ? suppliers.filter((entry) => entry.externalRef === row.externalNumber)
      : [];
    if (byRef.length === 1 && byRef[0]) {
      return {
        relationshipId: byRef[0].relationshipId,
        matchMethod: 'alias',
        matchScore: 1,
        matchReason: 'Eigene Lieferantennummer',
      };
    }
    // 2. Eindeutige Kennung: USt-ID oder DUNS
    const byVat = row.vatId ? suppliers.filter((entry) => entry.vatId === row.vatId) : [];
    if (byVat.length === 1 && byVat[0]) {
      return {
        relationshipId: byVat[0].relationshipId,
        matchMethod: 'vat_id',
        matchScore: 1,
        matchReason: 'Gleiche USt-ID',
      };
    }
    const byDuns = row.duns ? suppliers.filter((entry) => entry.duns === row.duns) : [];
    if (byDuns.length === 1 && byDuns[0]) {
      return {
        relationshipId: byDuns[0].relationshipId,
        matchMethod: 'duns',
        matchScore: 1,
        matchReason: 'Gleiche DUNS',
      };
    }
    // 3. Unscharf über pg_trgm
    if (!row.name) {
      return { matchReason: 'Kein Name zum Vergleichen', candidates: [] };
    }
    const candidates = await this.candidates(tx, row.name, row.country, suppliers);
    const [best] = candidates;
    if (best && best.score >= autoMatchScore) {
      return {
        relationshipId: best.relationshipId,
        matchMethod: 'fuzzy',
        matchScore: best.score,
        matchReason: `Ähnlichkeit ${best.score.toFixed(2)}`,
        candidates,
      };
    }
    if (best && best.score >= reviewMatchScore) {
      return {
        matchScore: best.score,
        matchReason: `Ähnlichkeit ${best.score.toFixed(2)} zu ${best.name}`,
        candidates,
        suggestion: {
          relationshipId: best.relationshipId,
          name: best.name,
          reason: `Ähnlichkeit ${best.score.toFixed(2)}`,
          parentRelationshipId: null,
          parentName: null,
        },
      };
    }
    // Neuer Lieferant zur Prüfung, mit Vorschlag für einen Konzernverbund bei gleichem Namensstamm
    const stem = nameStem(row.name);
    const parent = stem
      ? suppliers.find((entry) => entry.key.split(' ').includes(stem))
      : undefined;
    return {
      matchScore: best?.score ?? 0,
      matchReason: 'Kein ähnlicher Lieferant',
      candidates,
      suggestion: {
        relationshipId: null,
        name: null,
        reason: parent
          ? `Gleicher Namensstamm wie ${parent.name}. Ein Verbund entsteht nur, wenn du ihn bestätigst.`
          : 'Neu anlegen',
        parentRelationshipId: parent?.relationshipId ?? null,
        parentName: parent?.name ?? null,
      },
    };
  }

  /** Regeln: zuerst ERP-Materialgruppe, dann Konto, dann Text */
  private matchCategory(
    row: NormalizedRow,
    rules: (typeof schema.categoryRule.$inferSelect)[],
  ): Partial<RowRecord> {
    const lower = (value: string | null) => value?.toLocaleLowerCase('de').trim() ?? '';
    const rule =
      rules.find(
        (entry) =>
          entry.field === 'material_group' && lower(entry.pattern) === lower(row.erpMaterialGroup),
      ) ??
      rules.find(
        (entry) => entry.field === 'account' && lower(entry.pattern) === lower(row.account),
      ) ??
      rules.find(
        (entry) =>
          entry.field === 'description' &&
          lower(row.description).length > 0 &&
          lower(row.description).includes(lower(entry.pattern)),
      );
    if (rule) {
      return {
        materialGroupId: rule.materialGroupId,
        categoryMethod: 'rule',
        categoryConfidence: 1,
      };
    }
    return {};
  }

  /** Lieferant geklärt (zugeordnet oder neu) und, bei Spend, Warengruppe geklärt */
  private stateOf(kind: ImportBatchKind, row: Partial<RowRecord>): 'ok' | 'review' {
    const supplier = Boolean(row.relationshipId) || Boolean(row.createNew);
    const category =
      kind === 'supplier_master' ||
      (row.categoryMethod !== null && row.categoryMethod !== undefined);
    return supplier && category ? 'ok' : 'review';
  }

  /**
   * Modell der Klasse small für die Zeilen zur Prüfung: Lieferant aus höchstens fünf Kandidaten oder
   * „neu“, Warengruppe nur aus dem Baum des Kunden oder „keine passt“. Ab 0,90 ist die Warengruppe
   * sicher; Lieferanten bleiben immer zur Prüfung.
   */
  private async askModel(
    tx: TenantTransaction,
    session: { userId: string; organizationId: string },
    kind: ImportBatchKind,
    rows: RowRecord[],
    groups: Group[],
  ) {
    this.modelCalls += 1;
    let answer: ModelSuggestions;
    if (this.testModel) {
      answer = this.testModel({ rows, groups });
    } else {
      const input = rows.map((row) => {
        const n = row.normalized as unknown as NormalizedRow;
        return {
          rowId: row.id,
          name: n.name,
          city: n.city,
          country: n.country,
          erpMaterialGroup: n.erpMaterialGroup,
          account: n.account,
          description: n.description,
          candidates: row.candidates.slice(0, 5),
          needsSupplier: !row.relationshipId,
          needsCategory: row.categoryMethod === null,
        };
      });
      const tree = groups.map((group) => ({
        id: group.id,
        name: group.name,
        code: group.code,
        description: group.description,
      }));
      const raw = await this.gateway.call(
        { orgId: session.organizationId, userId: session.userId, feature: 'import_assist' },
        async (model) => {
          const prompt = JSON.stringify({ rows: input, materialGroups: tree });
          if (!model) {
            const value = JSON.stringify(localSuggestions(rows, groups));
            return {
              value,
              usage: { inputTokens: estimateTokens(prompt), outputTokens: estimateTokens(value) },
            };
          }
          const result = await generateText({
            model,
            system:
              'Du ordnest Zeilen eines Imports zu. Lieferant: nur einer der Kandidaten oder null für neu, mit einem Satz Begründung. Warengruppe: nur eine id aus materialGroups oder null, wenn keine passt, mit Konfidenz 0 bis 1. Gib keine Beträge zurück. Antworte mit genau einem JSON-Objekt {"suppliers": [...], "categories": [...]}.',
            prompt,
            maxOutputTokens: 4000,
            maxRetries: 0,
            abortSignal: AbortSignal.timeout(60_000),
          });
          return {
            value: result.text,
            usage: {
              inputTokens: result.usage.inputTokens ?? 0,
              outputTokens: result.usage.outputTokens ?? 0,
            },
          };
        },
      );
      try {
        const parsed = modelAnswerSchema.safeParse(JSON.parse(raw));
        answer = parsed.success ? parsed.data : { suppliers: [], categories: [] };
      } catch {
        answer = { suppliers: [], categories: [] };
      }
    }
    const groupIds = new Map(groups.map((group) => [group.id, group]));
    for (const row of rows) {
      const update: Partial<RowRecord> = {};
      const supplier = answer.suppliers.find((entry) => entry.rowId === row.id);
      if (supplier && !row.relationshipId) {
        // Nur Kandidaten dieser Zeile oder „neu“; nie automatisch übernommen
        const candidate = supplier.relationshipId
          ? row.candidates.find((entry) => entry.relationshipId === supplier.relationshipId)
          : null;
        if (supplier.relationshipId === null || candidate) {
          const existing = (row.suggestion ?? {}) as Record<string, unknown>;
          update.suggestion = {
            relationshipId: candidate?.relationshipId ?? null,
            name: candidate?.name ?? null,
            reason: supplier.reason,
            parentRelationshipId: (existing.parentRelationshipId as string | null) ?? null,
            parentName: (existing.parentName as string | null) ?? null,
          };
          update.matchMethod = 'model';
        }
      }
      const category = answer.categories.find((entry) => entry.rowId === row.id);
      if (category && row.categoryMethod === null) {
        // Nur eine Warengruppe, die der Kunde hat
        const group = category.materialGroupId ? groupIds.get(category.materialGroupId) : null;
        if (category.materialGroupId === null || group) {
          if (group && category.confidence >= categoryConfidence) {
            update.materialGroupId = group.id;
            update.categoryMethod = 'model';
            update.categoryConfidence = category.confidence;
          } else {
            update.categorySuggestion = {
              id: group?.id ?? null,
              name: group?.name ?? null,
              reason: category.reason,
            };
            update.categoryConfidence = category.confidence;
          }
        }
      }
      if (Object.keys(update).length === 0) continue;
      const merged = { ...row, ...update };
      update.status = this.stateOf(kind, merged);
      await tx.update(schema.importRow).set(update).where(eq(schema.importRow.id, row.id));
    }
  }

  private async recount(tx: TenantTransaction, id: string, status: BatchRow['status']) {
    const [counts] = await tx
      .execute<{ ok: string; review: string; error: string }>(sql`
      select count(*) filter (where status = 'ok')::text as ok,
        count(*) filter (where status = 'review')::text as review,
        count(*) filter (where status = 'error')::text as error
      from import_row where batch_id = ${id}`)
      .then((result) => result.rows);
    await tx
      .update(schema.importBatch)
      .set({
        status,
        rowsOk: Number(counts?.ok ?? 0),
        rowsReview: Number(counts?.review ?? 0),
        rowsError: Number(counts?.error ?? 0),
      })
      .where(eq(schema.importBatch.id, id));
  }

  /**
   * Entscheidungen zur Prüfung. Jede Entscheidung legt einen Alias oder eine Regel an, damit der
   * nächste Import ohne Prüfung und ohne Modell zuordnet. Commodity Manager entscheiden nur die
   * Warengruppe in ihren Warengruppen.
   */
  async decide(auth: AuthContext, id: string, input: DecideImportRows) {
    const session = this.session(auth);
    await this.tenant.run(session, async (tx) => {
      const batch = await this.batchRow(tx, session.organizationId, id);
      if (batch.status !== 'review') throw conflict('nicht_in_pruefung');
      const admin = this.isAdmin(auth);
      const managed = await this.managedGroups(tx, auth, session.organizationId);
      if (!admin && (managed.size === 0 || input.action !== 'category')) throw forbidden();
      const { suppliers, groups } = await this.context(tx, session.organizationId);
      const rows = await tx
        .select()
        .from(schema.importRow)
        .where(and(eq(schema.importRow.batchId, id), inArray(schema.importRow.id, input.rowIds)));
      if (rows.length !== input.rowIds.length) throw notFound();
      for (const row of rows) {
        if (row.status === 'error') continue;
        const n = row.normalized as unknown as NormalizedRow;
        const update: Partial<RowRecord> = { decidedBy: auth.userId };
        const suggestion = (row.suggestion ?? {}) as {
          relationshipId?: string | null;
          parentRelationshipId?: string | null;
        };
        const categorySuggestion = (row.categorySuggestion ?? {}) as { id?: string | null };
        const setSupplier = async (relationshipId: string) => {
          if (!suppliers.some((entry) => entry.relationshipId === relationshipId)) throw notFound();
          update.relationshipId = relationshipId;
          update.createNew = false;
          update.parentRelationshipId = null;
          update.matchMethod = 'manual';
          await this.learnAlias(tx, session.organizationId, auth.userId, row, n, relationshipId);
        };
        const setCategory = async (materialGroupId: string | null) => {
          if (materialGroupId && !groups.some((group) => group.id === materialGroupId)) {
            throw notFound();
          }
          if (!admin && !managed.has(materialGroupId ?? (categorySuggestion.id as string) ?? '')) {
            throw forbidden();
          }
          update.materialGroupId = materialGroupId;
          update.categoryMethod = 'manual';
          update.categoryConfidence = 1;
          if (materialGroupId) {
            await this.learnRule(tx, session.organizationId, auth.userId, row, n, materialGroupId);
          }
        };
        switch (input.action) {
          case 'accept':
            if (!row.relationshipId) {
              if (suggestion.relationshipId) await setSupplier(suggestion.relationshipId);
              else {
                update.createNew = true;
                update.matchMethod = 'new';
              }
            }
            if (batch.kind === 'spend' && row.categoryMethod === null) {
              await setCategory(categorySuggestion.id ?? null);
            }
            break;
          case 'supplier':
            if (!input.relationshipId)
              throw new BadRequestException({ statusCode: 400, code: 'lieferant_fehlt' });
            await setSupplier(input.relationshipId);
            break;
          case 'new':
          case 'new_in_group': {
            const parent =
              input.action === 'new_in_group'
                ? (input.relationshipId ?? suggestion.parentRelationshipId ?? null)
                : null;
            if (input.action === 'new_in_group' && !parent) {
              throw new BadRequestException({ statusCode: 400, code: 'verbund_fehlt' });
            }
            update.relationshipId = null;
            update.createNew = true;
            update.parentRelationshipId = parent;
            update.matchMethod = 'new';
            break;
          }
          case 'category':
            await setCategory(input.materialGroupId ?? null);
            break;
          case 'skip':
            update.status = 'skipped';
            break;
        }
        if (update.status !== 'skipped') {
          update.status = this.stateOf(batch.kind, { ...row, ...update });
        }
        await tx.update(schema.importRow).set(update).where(eq(schema.importRow.id, row.id));
      }
      await this.recount(tx, id, 'review');
    });
    return this.get(auth, id);
  }

  private async learnAlias(
    tx: TenantTransaction,
    orgId: string,
    userId: string,
    row: RowRecord,
    n: NormalizedRow,
    relationshipId: string,
  ) {
    await tx
      .insert(schema.supplierAlias)
      .values({
        orgId,
        relationshipId,
        sourceSystem: n.sourceSystem,
        externalNumber: n.externalNumber,
        nameVariant: n.externalNumber ? null : n.name ? nameKey(n.name) : null,
        createdFromRowId: row.id,
        createdBy: userId,
      })
      .onConflictDoNothing();
  }

  private async learnRule(
    tx: TenantTransaction,
    orgId: string,
    userId: string,
    row: RowRecord,
    n: NormalizedRow,
    materialGroupId: string,
  ) {
    const [field, pattern] = n.erpMaterialGroup
      ? (['material_group', n.erpMaterialGroup] as const)
      : n.account
        ? (['account', n.account] as const)
        : n.description
          ? (['description', n.description.slice(0, 200)] as const)
          : [null, null];
    if (!field || !pattern) return;
    await tx
      .insert(schema.categoryRule)
      .values({
        orgId,
        materialGroupId,
        field,
        pattern,
        createdFromRowId: row.id,
        createdBy: userId,
      })
      .onConflictDoNothing();
  }

  /**
   * Übernehmen in einer Transaktion: neue Lieferanten anlegen, Aliasse lernen, Spend je Lieferant,
   * Jahr und Warengruppe schreiben. Offene Zeilen bleiben offen; eine Warengruppe, die keiner hat,
   * bleibt „nicht zugeordnet“. Dieselbe Datei wird nicht zweimal übernommen.
   */
  async commit(auth: AuthContext, id: string) {
    const session = this.session(auth);
    if (!this.isAdmin(auth)) throw forbidden();
    await this.tenant.run(session, async (tx) => {
      const batch = await this.batchRow(tx, session.organizationId, id);
      if (batch.status !== 'review') throw conflict('nicht_in_pruefung');
      // Dieselbe Datei nur einmal; Lieferungen der API ersetzen stattdessen Monate (IN-07)
      const [twin] =
        batch.source !== 'file'
          ? []
          : await tx
              .select({ id: schema.importBatch.id })
              .from(schema.importBatch)
              .where(
                and(
                  eq(schema.importBatch.orgId, session.organizationId),
                  eq(schema.importBatch.fileHash, batch.fileHash),
                  eq(schema.importBatch.status, 'committed'),
                ),
              );
      if (twin) throw conflict('datei_schon_uebernommen');
      const rows = await tx
        .select()
        .from(schema.importRow)
        .where(eq(schema.importRow.batchId, id))
        .orderBy(schema.importRow.rowNo);
      const undo = {
        relationships: [] as string[],
        aliases: [] as string[],
        parents: [] as string[],
        spend: [] as SpendUndo[],
        periods: { inserted: [] as string[], deleted: [] as PeriodLine[] },
      };
      // Neue Lieferanten: gleiche Nummer bzw. gleicher Name und Land werden ein Lieferant.
      const created = new Map<string, string>();
      for (const row of rows) {
        if (!row.createNew || row.status === 'skipped' || row.status === 'error') continue;
        const n = row.normalized as unknown as NormalizedRow;
        const key = n.externalNumber
          ? `nr:${n.sourceSystem}:${n.externalNumber}`
          : `name:${nameKey(n.name ?? '')}:${n.country}`;
        let relationshipId = created.get(key);
        if (!relationshipId) {
          const result = await this.suppliers.createIn(tx, auth, {
            name: (n.name ?? n.externalNumber ?? 'Unbekannt').slice(0, 200),
            country: n.country ?? 'DE',
            vatId: n.vatId ?? undefined,
            duns: n.duns ?? undefined,
            externalRef: n.externalNumber ?? undefined,
          });
          relationshipId = result.relationshipId;
          created.set(key, relationshipId);
          undo.relationships.push(relationshipId);
          if (row.parentRelationshipId) {
            await tx
              .update(schema.relationshipSide)
              .set({ parentRelationshipId: row.parentRelationshipId })
              .where(
                and(
                  eq(schema.relationshipSide.relationshipId, relationshipId),
                  eq(schema.relationshipSide.orgId, session.organizationId),
                ),
              );
          }
        }
        await tx
          .update(schema.importRow)
          .set({ relationshipId })
          .where(eq(schema.importRow.id, row.id));
        row.relationshipId = relationshipId;
      }
      // Aliasse für alle zugeordneten Zeilen mit Nummer, damit der nächste Import ohne Prüfung greift
      for (const row of rows) {
        const n = row.normalized as unknown as NormalizedRow;
        if (
          !row.relationshipId ||
          !n.externalNumber ||
          row.status === 'error' ||
          row.status === 'skipped'
        )
          continue;
        const [alias] = await tx
          .insert(schema.supplierAlias)
          .values({
            orgId: session.organizationId,
            relationshipId: row.relationshipId,
            sourceSystem: n.sourceSystem,
            externalNumber: n.externalNumber,
            createdFromRowId: row.id,
            createdBy: auth.userId,
          })
          .onConflictDoNothing()
          .returning({ id: schema.supplierAlias.id });
        if (alias) undo.aliases.push(alias.id);
      }
      if (batch.kind === 'spend' && batch.source === 'api') {
        await this.commitApiSpend(tx, batch, rows, undo);
      } else if (batch.kind === 'spend') {
        // Summe je Lieferant, Jahr und Warengruppe; Zeilen ohne Lieferant bleiben offen.
        const sums = new Map<
          string,
          { relationshipId: string; year: number; groupId: string | null; cents: number }
        >();
        for (const row of rows) {
          const n = row.normalized as unknown as NormalizedRow;
          if (row.status === 'error' || row.status === 'skipped' || !row.relationshipId) continue;
          if (n.amountCents === null || n.year === null) continue;
          const groupId =
            row.categoryMethod !== null || row.materialGroupId ? row.materialGroupId : null;
          const key = `${row.relationshipId}|${n.year}|${groupId ?? ''}`;
          const entry = sums.get(key) ?? {
            relationshipId: row.relationshipId,
            year: n.year,
            groupId,
            cents: 0,
          };
          entry.cents += n.amountCents;
          sums.set(key, entry);
        }
        for (const entry of sums.values()) await this.writeYearly(tx, entry, undo.spend);
      }
      await tx
        .update(schema.importBatch)
        .set({ status: 'committed', committedBy: auth.userId, committedAt: new Date(), undo })
        .where(eq(schema.importBatch.id, id));
      // KI-09: Ereignis „Spend-Import fertig“ für eigene Agenten
      if (batch.kind === 'spend')
        this.agentEvents.defer(session.organizationId, 'spend_import_done', null);
    });
    return this.get(auth, id);
  }

  /**
   * Rückgängig machen, 30 Tage lang: Spend auf den Stand davor, gelernte Aliasse des Übernehmens
   * entfernen, neu angelegte Lieferanten löschen. Hängen an ihnen schon Folgedaten, geht es nicht.
   */
  /** Jahressumme je Lieferant und Warengruppe setzen; der alte Wert steht in undo (Rückgängig). */
  private async writeYearly(
    tx: TenantTransaction,
    entry: { relationshipId: string; year: number; groupId: string | null; cents: number },
    undo: SpendUndo[],
  ) {
    const [existing] = await tx
      .select()
      .from(schema.relationshipSpend)
      .where(
        and(
          eq(schema.relationshipSpend.relationshipId, entry.relationshipId),
          eq(schema.relationshipSpend.year, entry.year),
          eq(schema.relationshipSpend.kind, 'actual'),
          sql`${schema.relationshipSpend.businessUnitId} is null`,
          sql`${schema.relationshipSpend.productGroupId} is null`,
          entry.groupId
            ? eq(schema.relationshipSpend.materialGroupId, entry.groupId)
            : sql`${schema.relationshipSpend.materialGroupId} is null`,
        ),
      );
    if (existing) {
      undo.push({
        id: existing.id,
        before: {
          amountCents: existing.amountCents,
          currency: existing.currency,
          source: existing.source,
        },
      });
      await tx
        .update(schema.relationshipSpend)
        .set({ amountCents: entry.cents, currency: 'EUR', source: 'import' })
        .where(eq(schema.relationshipSpend.id, existing.id));
    } else {
      const [row] = await tx
        .insert(schema.relationshipSpend)
        .values({
          relationshipId: entry.relationshipId,
          year: entry.year,
          amountCents: entry.cents,
          currency: 'EUR',
          source: 'import',
          kind: 'actual',
          materialGroupId: entry.groupId,
        })
        .returning({ id: schema.relationshipSpend.id });
      if (row) undo.push({ id: row.id, before: null });
    }
  }

  /**
   * IN-07: Spend aus der API je Monat. Eine Lieferung ersetzt die Monate älterer Lieferungen;
   * kam für einen Monat schon eine neuere Lieferung, ändert diese ihn nicht mehr. Danach stimmen die
   * Jahressummen der betroffenen Lieferanten wieder mit der Summe der Monate.
   */
  private async commitApiSpend(
    tx: TenantTransaction,
    batch: BatchRow,
    rows: RowRecord[],
    undo: { spend: SpendUndo[]; periods: { inserted: string[]; deleted: PeriodLine[] } },
  ) {
    const deliveryId = batch.deliveryId ?? batch.id;
    const lines = new Map<
      string,
      { relationshipId: string; period: string; groupId: string | null; cents: number }
    >();
    for (const row of rows) {
      const n = row.normalized as unknown as NormalizedRow;
      const period = row.raw.period;
      if (row.status !== 'ok' || !row.relationshipId || n.amountCents === null || !period) continue;
      const groupId =
        row.categoryMethod !== null || row.materialGroupId ? row.materialGroupId : null;
      const key = `${row.relationshipId}|${period}|${groupId ?? ''}`;
      const line = lines.get(key) ?? {
        relationshipId: row.relationshipId,
        period,
        groupId,
        cents: 0,
      };
      line.cents += n.amountCents;
      lines.set(key, line);
    }
    const periods = [...new Set([...lines.values()].map((line) => line.period))];
    if (periods.length === 0) return;
    const source = and(
      eq(schema.spendPeriod.orgId, batch.orgId),
      eq(schema.spendPeriod.source, 'api'),
      inArray(schema.spendPeriod.period, periods),
    );
    const newer = await tx
      .select({ period: schema.spendPeriod.period })
      .from(schema.spendPeriod)
      .where(and(source, sql`${schema.spendPeriod.deliveryId} > ${deliveryId}`));
    const blocked = new Set(newer.map((row) => row.period));
    const active = periods.filter((period) => !blocked.has(period));
    if (active.length === 0) return;
    const deleted = await tx
      .delete(schema.spendPeriod)
      .where(
        and(
          eq(schema.spendPeriod.orgId, batch.orgId),
          eq(schema.spendPeriod.source, 'api'),
          inArray(schema.spendPeriod.period, active),
          sql`${schema.spendPeriod.deliveryId} < ${deliveryId}`,
        ),
      )
      .returning();
    undo.periods.deleted.push(...deleted);
    const affected = new Map<
      string,
      { relationshipId: string; year: number; groupId: string | null }
    >();
    const touch = (relationshipId: string, period: string, groupId: string | null) =>
      affected.set(`${relationshipId}|${period.slice(0, 4)}|${groupId ?? ''}`, {
        relationshipId,
        year: Number(period.slice(0, 4)),
        groupId,
      });
    for (const line of deleted) touch(line.relationshipId, line.period, line.materialGroupId);
    for (const line of lines.values()) {
      if (!active.includes(line.period)) continue;
      const [created] = await tx
        .insert(schema.spendPeriod)
        .values({
          orgId: batch.orgId,
          relationshipId: line.relationshipId,
          period: line.period,
          materialGroupId: line.groupId,
          amountCents: line.cents,
          currency: 'EUR',
          source: 'api',
          deliveryId,
          batchId: batch.id,
        })
        .returning({ id: schema.spendPeriod.id });
      if (created) undo.periods.inserted.push(created.id);
      touch(line.relationshipId, line.period, line.groupId);
    }
    for (const entry of affected.values()) {
      const [sum] = await tx
        .execute<{ cents: string }>(sql`
          select coalesce(sum(amount_cents), 0)::text as cents from spend_period
          where relationship_id = ${entry.relationshipId} and source = 'api'
            and period like ${`${entry.year}-%`}
            and material_group_id is not distinct from ${entry.groupId}::uuid`)
        .then((result) => result.rows);
      await this.writeYearly(tx, { ...entry, cents: Number(sum?.cents ?? 0) }, undo.spend);
    }
  }

  /**
   * IN-07: Zeilen, die bei einer Lieferung der API zur Prüfung stehen, wandern in eine eigene
   * Lieferung derselben Herkunft. So blockieren sie die Übernahme der übrigen Zeilen nicht.
   */
  async splitOpenRows(auth: AuthContext, id: string): Promise<string | null> {
    const session = this.session(auth);
    if (!this.isAdmin(auth)) throw forbidden();
    return this.tenant.run(session, async (tx) => {
      const batch = await this.batchRow(tx, session.organizationId, id);
      if (batch.status !== 'review') throw conflict('nicht_in_pruefung');
      const open = await tx
        .select({ id: schema.importRow.id })
        .from(schema.importRow)
        .where(and(eq(schema.importRow.batchId, id), eq(schema.importRow.status, 'review')));
      if (open.length === 0) return null;
      const [follow] = await tx
        .insert(schema.importBatch)
        .values({
          orgId: session.organizationId,
          kind: batch.kind,
          fileName: batch.fileName,
          fileHash: `${batch.fileHash}:pruefung`,
          headers: batch.headers,
          columnMap: batch.columnMap,
          suggestedMap: batch.suggestedMap,
          status: 'review',
          rowsTotal: open.length,
          createdBy: batch.createdBy,
          createdByName: batch.createdByName,
          source: batch.source,
          apiKeyId: batch.apiKeyId,
          deliveryId: batch.deliveryId ?? batch.id,
        })
        .returning({ id: schema.importBatch.id });
      if (!follow) throw notFound();
      await tx
        .update(schema.importRow)
        .set({ batchId: follow.id })
        .where(and(eq(schema.importRow.batchId, id), eq(schema.importRow.status, 'review')));
      await this.recount(tx, follow.id, 'review');
      await this.recount(tx, id, 'review');
      await tx
        .update(schema.importBatch)
        .set({ rowsTotal: batch.rowsTotal - open.length })
        .where(eq(schema.importBatch.id, id));
      return follow.id;
    });
  }

  async revert(auth: AuthContext, id: string) {
    const session = this.session(auth);
    if (!this.isAdmin(auth)) throw forbidden();
    await this.tenant.run(session, async (tx) => {
      const batch = await this.batchRow(tx, session.organizationId, id);
      if (batch.status !== 'committed' || !batch.committedAt) throw conflict('nicht_uebernommen');
      if (Date.now() - batch.committedAt.getTime() > revertDays * 86_400_000) {
        throw conflict('frist_abgelaufen');
      }
      const undo = (batch.undo ?? {}) as {
        relationships?: string[];
        aliases?: string[];
        spend?: SpendUndo[];
        periods?: { inserted: string[]; deleted: PeriodLine[] };
      };
      // IN-07: Monate dieser Lieferung entfernen, die ersetzten wiederherstellen
      if ((undo.periods?.inserted ?? []).length > 0) {
        await tx
          .delete(schema.spendPeriod)
          .where(inArray(schema.spendPeriod.id, undo.periods?.inserted ?? []));
      }
      for (const line of undo.periods?.deleted ?? []) {
        await tx.insert(schema.spendPeriod).values(line).onConflictDoNothing();
      }
      for (const entry of undo.spend ?? []) {
        if (entry.before) {
          await tx
            .update(schema.relationshipSpend)
            .set({
              amountCents: entry.before.amountCents,
              currency: entry.before.currency,
              source: entry.before.source as 'manual' | 'import' | 'seed',
            })
            .where(eq(schema.relationshipSpend.id, entry.id));
        } else {
          await tx
            .delete(schema.relationshipSpend)
            .where(eq(schema.relationshipSpend.id, entry.id));
        }
      }
      if ((undo.aliases ?? []).length > 0) {
        await tx
          .delete(schema.supplierAlias)
          .where(inArray(schema.supplierAlias.id, undo.aliases ?? []));
      }
      for (const relationshipId of undo.relationships ?? []) {
        try {
          await tx.transaction(async (inner) => {
            await inner
              .delete(schema.supplierAlias)
              .where(eq(schema.supplierAlias.relationshipId, relationshipId));
            await inner
              .update(schema.importRow)
              .set({ relationshipId: null })
              .where(eq(schema.importRow.relationshipId, relationshipId));
            await inner.execute(
              sql`delete from relationship_material_group where relationship_id = ${relationshipId}`,
            );
            await inner.execute(sql`select app_import_beziehung_entfernen(${relationshipId})`);
          });
        } catch {
          throw conflict('folgedaten');
        }
      }
      await tx
        .update(schema.importBatch)
        .set({ status: 'reverted', revertedAt: new Date() })
        .where(eq(schema.importBatch.id, id));
    });
    return this.get(auth, id);
  }

  /** Verwerfen vor dem Übernehmen */
  async discard(auth: AuthContext, id: string) {
    const session = this.session(auth);
    if (!this.isAdmin(auth)) throw forbidden();
    await this.tenant.run(session, async (tx) => {
      const batch = await this.batchRow(tx, session.organizationId, id);
      if (['committed', 'reverted'].includes(batch.status)) throw conflict('schon_uebernommen');
      await tx
        .update(schema.importBatch)
        .set({ status: 'discarded' })
        .where(eq(schema.importBatch.id, id));
    });
    return this.get(auth, id);
  }

  /** Fehlerzeilen als CSV, mit Grund */
  async errorsCsv(auth: AuthContext, id: string) {
    const session = this.session(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        const managed = await this.managedGroups(tx, auth, session.organizationId);
        if (!this.isAdmin(auth) && managed.size === 0) throw forbidden();
        const batch = await this.batchRow(tx, session.organizationId, id);
        const rows = await tx
          .select()
          .from(schema.importRow)
          .where(and(eq(schema.importRow.batchId, id), eq(schema.importRow.status, 'error')))
          .orderBy(schema.importRow.rowNo);
        const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
        const lines = [
          ['Zeile', 'Grund', ...batch.headers].map(quote).join(';'),
          ...rows.map((row) =>
            [
              String(row.rowNo),
              row.error ?? '',
              ...batch.headers.map((header) => row.raw[header] ?? ''),
            ]
              .map(quote)
              .join(';'),
          ),
        ];
        return `﻿${lines.join('\r\n')}\r\n`;
      },
      { readOnly: true },
    );
  }

  /** Ansicht eines Imports: Zahlen, Warteschlange, Fehler, Plan des Übernehmens, Datenqualität */
  async get(auth: AuthContext, id: string): Promise<ImportBatch> {
    const session = this.session(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        const managed = await this.managedGroups(tx, auth, session.organizationId);
        const admin = this.isAdmin(auth);
        if (!admin && managed.size === 0) throw forbidden();
        const batch = await this.batchRow(tx, session.organizationId, id);
        const { suppliers, groups } = await this.context(tx, session.organizationId);
        const all = await tx
          .select()
          .from(schema.importRow)
          .where(eq(schema.importRow.batchId, id))
          .orderBy(schema.importRow.rowNo);
        const cents = (status: string) =>
          all
            .filter((row) => row.status === status)
            .reduce((sum, row) => sum + Math.max(0, row.amountCents ?? 0), 0);
        const okRows = all.filter((row) => row.status === 'ok');
        const learned = okRows.filter(
          (row) =>
            row.matchMethod === 'alias' ||
            row.matchMethod === 'vat_id' ||
            row.matchMethod === 'duns',
        ).length;
        // Warteschlange: nach Spend absteigend, sichtbar höchstens 300 Zeilen
        const queue = all
          .filter((row) => row.status === 'review')
          .sort((a, b) => (b.amountCents ?? 0) - (a.amountCents ?? 0));
        const visible = (
          admin
            ? queue
            : queue.filter((row) => {
                const suggestion = (row.categorySuggestion ?? {}) as { id?: string | null };
                return managed.has(row.materialGroupId ?? suggestion.id ?? '');
              })
        ).slice(0, 300);
        const errors = new Map<string, number>();
        for (const row of all.filter((entry) => entry.status === 'error')) {
          errors.set(row.error ?? 'Fehler', (errors.get(row.error ?? 'Fehler') ?? 0) + 1);
        }
        const nameOf = (relationshipId: string | null) =>
          suppliers.find((entry) => entry.relationshipId === relationshipId)?.name ?? null;
        const groupOf = (groupId: string | null) =>
          groups.find((group) => group.id === groupId) ?? null;
        const view = (row: RowRecord): ImportRowView => {
          const n = row.normalized as unknown as NormalizedRow;
          const group = groupOf(row.materialGroupId);
          const suggestion = row.suggestion as ImportRowView['suggestion'];
          const categorySuggestion = row.categorySuggestion as ImportRowView['categorySuggestion'];
          const needs: ImportRowView['needs'] = [];
          if (!row.relationshipId && !row.createNew) needs.push('supplier');
          if (batch.kind === 'spend' && row.categoryMethod === null) needs.push('category');
          return importRowSchema.parse({
            id: row.id,
            rowNo: row.rowNo,
            status: row.status,
            raw: row.raw,
            normalized: {
              name: n?.name ?? null,
              externalNumber: n?.externalNumber ?? null,
              sourceSystem: n?.sourceSystem ?? 'erp',
              city: n?.city ?? null,
              country: n?.country ?? null,
              vatId: n?.vatId ?? null,
              duns: n?.duns ?? null,
              amountCents: n?.amountCents ?? null,
              currency: n?.currency ?? null,
              year: n?.year ?? null,
              erpMaterialGroup: n?.erpMaterialGroup ?? null,
              account: n?.account ?? null,
              description: n?.description ?? null,
            },
            supplier: row.relationshipId
              ? { relationshipId: row.relationshipId, name: nameOf(row.relationshipId) ?? '' }
              : null,
            matchMethod: row.matchMethod,
            matchScore: row.matchScore,
            matchReason: row.matchReason,
            suggestion: suggestion ?? null,
            candidates: row.candidates,
            materialGroup: group ? { id: group.id, name: group.name } : null,
            categoryMethod: row.categoryMethod,
            categoryConfidence: row.categoryConfidence,
            categorySuggestion: categorySuggestion ?? null,
            needs,
            error: row.error,
            decidedBy: row.decidedBy,
            createNew: row.createNew,
          });
        };
        const newSuppliers = new Set(
          all
            .filter((row) => row.createNew && row.status !== 'skipped')
            .map((row) => {
              const n = row.normalized as unknown as NormalizedRow;
              return n.externalNumber ? `nr:${n.externalNumber}` : `name:${nameKey(n.name ?? '')}`;
            }),
        ).size;
        let quality: ImportBatch['quality'] = null;
        if (batch.status === 'committed') {
          const total = okRows.reduce((sum, row) => sum + Math.max(0, row.amountCents ?? 0), 0);
          const assigned = okRows
            .filter((row) => row.materialGroupId)
            .reduce((sum, row) => sum + Math.max(0, row.amountCents ?? 0), 0);
          const [withoutGroup] = await tx
            .execute<{ n: string }>(sql`
            select count(*)::text as n from relationship r
            where r.buyer_org_id = ${session.organizationId} and r.status <> 'ended'
              and not exists (select 1 from relationship_material_group g where g.relationship_id = r.id)`)
            .then((result) => result.rows);
          quality = {
            assignedShare: total > 0 ? assigned / total : 0,
            suppliersWithoutGroup: Number(withoutGroup?.n ?? 0),
            proposedGroups: all.filter(
              (row) =>
                (row.suggestion as { parentRelationshipId?: string | null } | null)
                  ?.parentRelationshipId && !row.parentRelationshipId,
            ).length,
          };
        }
        const [aliases] = await tx
          .execute<{ n: string }>(sql`
          select count(*)::text as n from supplier_alias a join import_row r on r.id = a.created_from_row_id
          where r.batch_id = ${id}`)
          .then((result) => result.rows);
        const [rules] = await tx
          .execute<{ n: string }>(sql`
          select count(*)::text as n from category_rule c join import_row r on r.id = c.created_from_row_id
          where r.batch_id = ${id}`)
          .then((result) => result.rows);
        const committedAt = batch.committedAt;
        return importBatchSchema.parse({
          ...this.summary(batch),
          headers: batch.headers,
          sample: all.slice(0, 10).map((row) => row.raw),
          columnMap: batch.columnMap,
          suggestedMap: batch.suggestedMap,
          missingRequired: missingRequired(batch.columnMap, batch.kind),
          spend: { okCents: cents('ok'), reviewCents: cents('review'), errorCents: cents('error') },
          learnedShare: okRows.length > 0 ? learned / okRows.length : 0,
          rows: [...visible, ...all.filter((row) => row.status === 'error').slice(0, 50)].map(view),
          errors: [...errors.entries()].map(([reason, count]) => ({ reason, count })),
          plan: {
            newSuppliers,
            materialGroups: new Set(okRows.map((row) => row.materialGroupId).filter(Boolean)).size,
            openRows: queue.length,
            aliases: Number(aliases?.n ?? 0),
            rules: Number(rules?.n ?? 0),
          },
          quality,
          groups: groups
            .filter((group) => admin || managed.has(group.id))
            .map((group) => ({ id: group.id, name: group.name })),
          canManage: admin,
          canRevert:
            admin &&
            batch.status === 'committed' &&
            committedAt !== null &&
            Date.now() - committedAt.getTime() <= revertDays * 86_400_000,
          revertUntil: committedAt
            ? new Date(committedAt.getTime() + revertDays * 86_400_000).toISOString()
            : null,
        });
      },
      { readOnly: true },
    );
  }
}

/**
 * Testanbieter ohne Netzwerk: Lieferant = bester Kandidat ab 0,75, sonst „neu“; Warengruppe, deren
 * Name im Text oder in der ERP-Materialgruppe steht (0,95), ein Wort daraus (0,75), sonst keine.
 */
export function localSuggestions(rows: RowRecord[], groups: Group[]): ModelSuggestions {
  const suppliers: ModelSuggestions['suppliers'] = [];
  const categories: ModelSuggestions['categories'] = [];
  for (const row of rows) {
    const n = row.normalized as unknown as NormalizedRow;
    if (!row.relationshipId) {
      const [best] = row.candidates;
      suppliers.push(
        best && best.score >= 0.75
          ? {
              rowId: row.id,
              relationshipId: best.relationshipId,
              reason: `Ähnlichkeit ${best.score.toFixed(2)}: gleicher Name mit anderer Schreibweise.`,
            }
          : { rowId: row.id, relationshipId: null, reason: 'Kein passender Lieferant im Stamm.' },
      );
    }
    if (row.categoryMethod === null) {
      const text = `${n.description ?? ''} ${n.erpMaterialGroup ?? ''}`.toLocaleLowerCase('de');
      const exact = groups.find((group) => text.includes(group.name.toLocaleLowerCase('de')));
      const partial = exact
        ? null
        : groups.find((group) =>
            group.name
              .toLocaleLowerCase('de')
              .split(/[^a-zäöüß0-9]+/)
              .some((word) => word.length >= 5 && text.includes(word)),
          );
      const group = exact ?? partial;
      categories.push({
        rowId: row.id,
        materialGroupId: group?.id ?? null,
        confidence: exact ? 0.95 : partial ? 0.75 : 0,
        reason: group
          ? `„${group.name}“ steht im Text der Zeile.`
          : 'Keine Warengruppe passt zum Text der Zeile.',
      });
    }
  }
  return { suppliers, categories };
}
