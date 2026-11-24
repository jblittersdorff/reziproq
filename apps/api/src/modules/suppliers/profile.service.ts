import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  and,
  asc,
  auditedChange,
  currentTime,
  desc,
  eq,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type CompanyProfile,
  type Executive,
  type FinancialImportIssue,
  type FinancialImportResult,
  type FinancialMetric,
  financialMetrics,
  isRatio,
  parseImportAmount,
  type SaveFinancial,
  type SupplierProfile,
  saveFinancialSchema,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import {
  supplierExecutivesAudit,
  supplierFinancialAudit,
  supplierProfileAudit,
} from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { normalizeHeader, type ParsedImportFile } from './import-file.js';
import { assertWritable, ownRelationship, teamRoleOf } from './suppliers.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

/** Namen der Kennzahlen in der Importdatei, deutsch und englisch, ohne Sonderzeichen. */
const metricNames: Record<string, FinancialMetric> = {
  umsatz: 'revenue',
  revenue: 'revenue',
  ebitmarge: 'ebit_margin',
  ebitmargin: 'ebit_margin',
  nettoverschuldung: 'net_debt',
  netdebt: 'net_debt',
  eigenkapitalquote: 'equity_ratio',
  equityratio: 'equity_ratio',
  liquiditaet: 'cash',
  liquiditat: 'cash',
  cash: 'cash',
};
const columns = {
  year: ['jahr', 'year'],
  metric: ['kennzahl', 'metric'],
  value: ['wert', 'value'],
  unit: ['einheit', 'unit'],
  source: ['quelle', 'source'],
} as const;

/** Wert mit Vorzeichen: Betrag in Cent bzw. Prozent in Basispunkten (8,5 → 850). */
function parseSigned(text: string): number | null {
  const trimmed = text.trim();
  const negative = trimmed.startsWith('-');
  const value = parseImportAmount(negative ? trimmed.slice(1) : trimmed.replace(/%$/, ''));
  if (value === null) return null;
  return negative ? -value : value;
}

/**
 * SPL-05: Profil und Finanzen eines Lieferanten, nur Käufer (buyer_private). Unser Anteil ist der
 * eigene Ist-Spend eines Jahres geteilt durch den Umsatz des Lieferanten im selben Jahr.
 */
@Injectable()
export class ProfileService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private run<T>(
    auth: AuthContext,
    relationshipId: string,
    write: boolean,
    work: (tx: TenantTransaction, actorName: () => Promise<{ name: string }>) => Promise<T>,
  ) {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'lieferanten.sehen')) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      if (write) await assertWritable(tx, auth, organization, relationshipId);
      return work(tx, () => actorOf(tx, auth, organization.id));
    });
  }

  get(auth: AuthContext, relationshipId: string): Promise<SupplierProfile> {
    return this.run(auth, relationshipId, false, (tx) => this.read(tx, auth, relationshipId));
  }

  saveCompany(auth: AuthContext, relationshipId: string, input: CompanyProfile) {
    return this.saveProfile(auth, relationshipId, {
      headquarters: input.headquarters || null,
      foundedYear: input.foundedYear,
      employees: input.employees,
      businessSegments: input.businessSegments || null,
    });
  }

  saveImplications(auth: AuthContext, relationshipId: string, implications: string | null) {
    return this.saveProfile(auth, relationshipId, { implications: implications || null });
  }

  private saveProfile(
    auth: AuthContext,
    relationshipId: string,
    values: Partial<typeof schema.supplierProfile.$inferInsert>,
  ): Promise<SupplierProfile> {
    return this.run(auth, relationshipId, true, async (tx) => {
      const organization = auth.organization as NonNullable<AuthContext['organization']>;
      const actor = await actorOf(tx, auth, organization.id);
      const [before] = await tx
        .select()
        .from(schema.supplierProfile)
        .where(eq(schema.supplierProfile.relationshipId, relationshipId))
        .orderBy(desc(schema.supplierProfile.updatedAt))
        .limit(1);
      const stamp = { updatedBy: auth.userId, updatedByName: actor.name, updatedAt: currentTime() };
      await auditedChange(tx, actor, supplierProfileAudit, async () => {
        if (before) {
          await tx
            .update(schema.supplierProfile)
            .set({ ...values, ...stamp })
            .where(eq(schema.supplierProfile.id, before.id));
        } else {
          await tx.insert(schema.supplierProfile).values({ relationshipId, ...values, ...stamp });
        }
        const pick = (row: Record<string, unknown> | undefined) => ({
          headquarters: row?.headquarters ?? null,
          founded_year: row?.foundedYear ?? null,
          employees: row?.employees ?? null,
          business_segments: row?.businessSegments ?? null,
          implications: row?.implications ?? null,
        });
        return {
          objectId: relationshipId,
          relationshipId,
          action: before ? ('updated' as const) : ('created' as const),
          before: before ? pick(before) : null,
          after: pick({ ...before, ...values } as Record<string, unknown>),
          result: undefined,
        };
      });
      return this.read(tx, auth, relationshipId);
    });
  }

  saveExecutives(
    auth: AuthContext,
    relationshipId: string,
    executives: Executive[],
  ): Promise<SupplierProfile> {
    return this.run(auth, relationshipId, true, async (tx) => {
      const organization = auth.organization as NonNullable<AuthContext['organization']>;
      const actor = await actorOf(tx, auth, organization.id);
      const before = await this.executives(tx, relationshipId);
      await auditedChange(tx, actor, supplierExecutivesAudit, async () => {
        await tx
          .delete(schema.supplierExecutive)
          .where(eq(schema.supplierExecutive.relationshipId, relationshipId));
        if (executives.length > 0) {
          await tx.insert(schema.supplierExecutive).values(
            executives.map((entry, position) => ({
              relationshipId,
              name: entry.name,
              role: entry.role,
              since: entry.since,
              position,
            })),
          );
        }
        const list = (entries: Executive[]) =>
          entries.map((entry) => `${entry.name} (${entry.role})`);
        return {
          objectId: relationshipId,
          relationshipId,
          action: 'updated' as const,
          before: { executives: list(before) },
          after: { executives: list(executives) },
          result: undefined,
        };
      });
      return this.read(tx, auth, relationshipId);
    });
  }

  saveFinancial(
    auth: AuthContext,
    relationshipId: string,
    id: string | null,
    input: SaveFinancial | null,
  ): Promise<SupplierProfile> {
    return this.run(auth, relationshipId, true, async (tx) => {
      const organization = auth.organization as NonNullable<AuthContext['organization']>;
      const actor = await actorOf(tx, auth, organization.id);
      const [before] = id
        ? await tx
            .select()
            .from(schema.supplierFinancial)
            .where(
              and(
                eq(schema.supplierFinancial.id, id),
                eq(schema.supplierFinancial.relationshipId, relationshipId),
              ),
            )
        : [];
      if (id && !before) throw notFound();
      await auditedChange(tx, actor, supplierFinancialAudit, async () => {
        if (input === null && before) {
          await tx
            .delete(schema.supplierFinancial)
            .where(eq(schema.supplierFinancial.id, before.id));
        } else if (input) {
          if (before) {
            await tx
              .delete(schema.supplierFinancial)
              .where(eq(schema.supplierFinancial.id, before.id));
          }
          await this.upsert(tx, relationshipId, auth.userId, input);
        }
        const pick = (row: { year: number; metric: string; value: number } | null | undefined) =>
          row ? { year: row.year, metric: row.metric, value: row.value } : null;
        return {
          objectId: relationshipId,
          relationshipId,
          action:
            input === null
              ? ('ended' as const)
              : before
                ? ('updated' as const)
                : ('created' as const),
          before: pick(before),
          after: pick(input),
          result: undefined,
        };
      });
      return this.read(tx, auth, relationshipId);
    });
  }

  /** CSV oder XLSX mit Jahr, Kennzahl, Wert, Einheit, Quelle: ganz oder gar nicht. */
  importFinancials(
    auth: AuthContext,
    relationshipId: string,
    file: ParsedImportFile,
  ): Promise<FinancialImportResult> {
    return this.run(auth, relationshipId, true, async (tx) => {
      const organization = auth.organization as NonNullable<AuthContext['organization']>;
      const header = (names: readonly string[]) =>
        file.headers.find((entry) => names.includes(normalizeHeader(entry)));
      const headers = {
        year: header(columns.year),
        metric: header(columns.metric),
        value: header(columns.value),
        unit: header(columns.unit),
        source: header(columns.source),
      };
      if (Object.values(headers).some((entry) => entry === undefined)) {
        return { imported: 0, rows: [{ row: 1, issues: ['missing_column'] }] };
      }
      const seen = new Set<string>();
      const planned: SaveFinancial[] = [];
      const rows = file.rows.map(({ row, values }) => {
        const issues: FinancialImportIssue[] = [];
        const read = (key: keyof typeof headers) => (values[headers[key] as string] ?? '').trim();
        const year = /^\d{4}$/.test(read('year')) ? Number(read('year')) : Number.NaN;
        const metric = metricNames[normalizeHeader(read('metric'))];
        const unitText = read('unit').toUpperCase();
        const value = parseSigned(read('value'));
        if (!(year >= 1990 && year <= 2100)) issues.push('invalid_year');
        if (!metric) issues.push('unknown_metric');
        if (value === null) issues.push('invalid_value');
        const currency = metric && !isRatio(metric) ? unitText : null;
        if (metric && (isRatio(metric) ? unitText !== '%' : !/^[A-Z]{3}$/.test(unitText))) {
          issues.push('invalid_unit');
        }
        if (!read('source')) issues.push('source_required');
        const key = `${year}:${metric}`;
        if (metric && seen.has(key)) issues.push('duplicate_row');
        seen.add(key);
        const parsed = saveFinancialSchema.safeParse({
          year,
          metric,
          value,
          currency,
          source: read('source'),
        });
        if (issues.length === 0 && parsed.success) planned.push(parsed.data);
        return { row, issues };
      });
      const invalid = rows.filter((entry) => entry.issues.length > 0);
      if (invalid.length > 0) return { imported: 0, rows: invalid };
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, supplierFinancialAudit, async () => {
        for (const entry of planned) await this.upsert(tx, relationshipId, auth.userId, entry);
        return {
          objectId: relationshipId,
          relationshipId,
          action: 'updated' as const,
          before: null,
          after: { imported: planned.length },
          result: undefined,
        };
      });
      return { imported: planned.length, rows: [] };
    });
  }

  private upsert(
    tx: TenantTransaction,
    relationshipId: string,
    userId: string,
    input: SaveFinancial,
  ) {
    const values = {
      value: input.value,
      unit: isRatio(input.metric) ? ('basis_points' as const) : ('cents' as const),
      currency: input.currency,
      source: input.source,
      updatedBy: userId,
      updatedAt: currentTime(),
    };
    return tx
      .insert(schema.supplierFinancial)
      .values({ relationshipId, year: input.year, metric: input.metric, ...values })
      .onConflictDoUpdate({
        target: [
          schema.supplierFinancial.relationshipId,
          schema.supplierFinancial.year,
          schema.supplierFinancial.metric,
        ],
        set: values,
      });
  }

  private executives(tx: TenantTransaction, relationshipId: string) {
    return tx
      .select({
        id: schema.supplierExecutive.id,
        name: schema.supplierExecutive.name,
        role: schema.supplierExecutive.role,
        since: schema.supplierExecutive.since,
      })
      .from(schema.supplierExecutive)
      .where(eq(schema.supplierExecutive.relationshipId, relationshipId))
      .orderBy(asc(schema.supplierExecutive.position));
  }

  private async read(
    tx: TenantTransaction,
    auth: AuthContext,
    relationshipId: string,
  ): Promise<SupplierProfile> {
    const [profile] = await tx
      .select()
      .from(schema.supplierProfile)
      .where(eq(schema.supplierProfile.relationshipId, relationshipId))
      .orderBy(desc(schema.supplierProfile.updatedAt))
      .limit(1);
    const financials = await tx
      .select()
      .from(schema.supplierFinancial)
      .where(eq(schema.supplierFinancial.relationshipId, relationshipId))
      .orderBy(
        sql`array_position(array[${sql.raw(financialMetrics.map((m) => `'${m}'`).join(','))}]::text[], ${schema.supplierFinancial.metric})`,
        asc(schema.supplierFinancial.year),
      );
    // Unser Anteil: jüngstes Jahr mit Umsatz und eigenem Ist-Spend.
    const spend = await tx
      .select({
        year: schema.relationshipSpendTotal.year,
        currency: schema.relationshipSpendTotal.currency,
        amountCents: schema.relationshipSpendTotal.amountCents,
      })
      .from(schema.relationshipSpendTotal)
      .where(eq(schema.relationshipSpendTotal.relationshipId, relationshipId));
    const revenues = financials
      .filter((row) => row.metric === 'revenue')
      .sort((a, b) => b.year - a.year);
    let share: SupplierProfile['share'] = null;
    for (const revenue of revenues) {
      const own = spend.filter((row) => row.year === revenue.year);
      if (own.length === 0) continue;
      const same = own.find((row) => row.currency === revenue.currency);
      share =
        same && own.length === 1 && revenue.value > 0
          ? {
              status: 'ok',
              year: revenue.year,
              basisPoints: Math.round((same.amountCents * 10_000) / revenue.value),
            }
          : { status: 'currency_mismatch', year: revenue.year };
      break;
    }
    const teamRole = await teamRoleOf(tx, auth.userId, relationshipId);
    return {
      company: {
        headquarters: profile?.headquarters ?? null,
        foundedYear: profile?.foundedYear ?? null,
        employees: profile?.employees ?? null,
        businessSegments: profile?.businessSegments ?? null,
      },
      implications: profile?.implications ?? null,
      updatedByName: profile?.updatedByName ?? null,
      updatedAt: profile?.updatedAt.toISOString() ?? null,
      executives: await this.executives(tx, relationshipId),
      financials: financials.map((row) => ({
        id: row.id,
        year: row.year,
        metric: row.metric,
        value: row.value,
        unit: row.unit,
        currency: row.currency,
        source: row.source,
      })),
      share,
      canEdit: can(auth, 'lieferanten.bearbeiten', { teamRole }),
    };
  }
}
