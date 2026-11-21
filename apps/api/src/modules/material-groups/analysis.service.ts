import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  type AnalysisComputed,
  type AnalysisData,
  type AnalysisStep,
  type AnalysisViewKey,
  analysisDataSchemas,
  analysisStepOf,
  analysisStepSchema,
  analysisViewKeys,
  type CandidateRequest,
  candidateRequestSchema,
  lastFullYear,
  topShares,
  viewsOfStep,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { typeNames } from '../ratings/consolidation.js';
import { SuppliersService } from '../suppliers/suppliers.service.js';
import { analysisStates } from './analysis-states.js';
import { StrategyService } from './strategy.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

const supplierName = sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`;

type Share = AnalysisComputed['bySegment'][number];

/** Anteile je Schlüssel aus Beträgen, absteigend */
function shares(entries: { key: string; name: string; amountCents: number }[]): Share[] {
  const merged = new Map<string, Share>();
  for (const entry of entries) {
    const current = merged.get(entry.key) ?? { ...entry, amountCents: 0, share: 0 };
    current.amountCents += entry.amountCents;
    merged.set(entry.key, current);
  }
  const total = [...merged.values()].reduce((sum, entry) => sum + entry.amountCents, 0);
  return [...merged.values()]
    .map((entry) => ({ ...entry, share: total > 0 ? entry.amountCents / total : 0 }))
    .sort((a, b) => b.amountCents - a.amountCents || a.name.localeCompare(b.name));
}

/**
 * WG-07: Analysen der Warengruppenstrategie. Eingaben je Sicht nach dem Schema aus
 * @reziproq/shared; Umsatzwerte nur aus dem Spend. Die Kostensicht sieht nur das Team.
 */
@Injectable()
export class AnalysisService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(StrategyService) private readonly strategies: StrategyService,
    @Inject(SuppliersService) private readonly suppliersService: SuppliersService,
  ) {}

  private run<T>(
    auth: AuthContext,
    work: (tx: TenantTransaction, organization: AccountOrganization) => Promise<T>,
  ): Promise<T> {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, (tx) =>
      work(tx, organization),
    );
  }

  private async editable(
    tx: TenantTransaction,
    auth: AuthContext,
    strategyId: string,
    step: number,
  ) {
    const access = await this.strategies.accessIn(tx, auth, strategyId);
    if (!access.editableSteps.includes(step)) throw forbidden();
    return access;
  }

  step(auth: AuthContext, strategyId: string, step: number): Promise<AnalysisStep> {
    if (step !== 3 && step !== 4) throw new BadRequestException({ code: 'invalid_step' });
    return this.run(auth, (tx, organization) =>
      this.stepIn(tx, auth, organization.id, strategyId, step),
    );
  }

  private async stepIn(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    strategyId: string,
    step: number,
  ): Promise<AnalysisStep> {
    const access = await this.strategies.accessIn(tx, auth, strategyId);
    const { group } = access;
    const rows = await tx
      .select()
      .from(schema.materialGroupAnalysis)
      .where(eq(schema.materialGroupAnalysis.strategyId, strategyId));
    const notes = await tx
      .select({
        step: schema.materialGroupNote.step,
        view: schema.materialGroupNote.view,
        text: schema.materialGroupNote.text,
        notApplicable: schema.materialGroupNote.notApplicable,
      })
      .from(schema.materialGroupNote)
      .where(eq(schema.materialGroupNote.strategyId, strategyId));
    const states = await analysisStates(tx, strategyId, group.id, notes);
    const dataOf = <K extends AnalysisViewKey>(view: K): AnalysisData[K] =>
      analysisDataSchemas[view].parse(
        rows.find((row) => row.view === view)?.data ?? {},
      ) as AnalysisData[K];

    const views = viewsOfStep(step)
      // Kostensicht nur für Team und Freigebende, auch nach der Freigabe (WG-07)
      .filter((view) => view !== 'cost' || access.seesCost)
      .map((view) => {
        const row = rows.find((entry) => entry.view === view);
        return {
          view,
          state: states.views[view],
          data: dataOf(view) as Record<string, unknown>,
          updatedAt: row ? row.updatedAt.toISOString() : null,
        };
      });

    const suppliers = await this.suppliers(tx, orgId, group.id);
    const businessUnits = await tx
      .select({ id: schema.businessUnit.id, name: schema.businessUnit.name })
      .from(schema.businessUnit)
      .where(eq(schema.businessUnit.active, true))
      .orderBy(asc(schema.businessUnit.name));
    const candidates =
      step === 4
        ? await tx
            .select({
              id: schema.materialGroupCandidate.id,
              name: schema.materialGroupCandidate.name,
              site: schema.materialGroupCandidate.site,
              country: schema.materialGroupCandidate.country,
              revenueCents: schema.materialGroupCandidate.revenueCents,
              currency: schema.materialGroupCandidate.currency,
              isSupplier: schema.materialGroupCandidate.isSupplier,
              comment: schema.materialGroupCandidate.comment,
            })
            .from(schema.materialGroupCandidate)
            .where(eq(schema.materialGroupCandidate.strategyId, strategyId))
            .orderBy(asc(schema.materialGroupCandidate.createdAt))
        : [];

    return analysisStepSchema.parse({
      step,
      canEdit: access.editableSteps.includes(step),
      views,
      computed: await this.computed(tx, orgId, group.id, suppliers, {
        stability: dataOf('revenue_finance').stability,
        quality: dataOf('quality').ratings,
      }),
      suppliers: suppliers.map(({ relationshipId, name }) => ({ relationshipId, name })),
      businessUnits,
      candidates,
      round: states.round,
    });
  }

  private async suppliers(tx: TenantTransaction, orgId: string, groupId: string) {
    return tx
      .select({
        relationshipId: schema.relationship.id,
        name: supplierName,
        country: schema.organization.country,
      })
      .from(schema.relationshipMaterialGroup)
      .innerJoin(
        schema.relationship,
        eq(schema.relationship.id, schema.relationshipMaterialGroup.relationshipId),
      )
      .innerJoin(schema.organization, eq(schema.organization.id, schema.relationship.supplierOrgId))
      .leftJoin(
        schema.relationshipSide,
        and(
          eq(schema.relationshipSide.relationshipId, schema.relationship.id),
          eq(schema.relationshipSide.orgId, orgId),
        ),
      )
      .where(
        and(
          eq(schema.relationshipMaterialGroup.materialGroupId, groupId),
          eq(schema.relationship.buyerOrgId, orgId),
          eq(schema.relationship.status, 'active'),
        ),
      )
      .orderBy(asc(supplierName));
  }

  /** Umsatzwerte der Sichten, nur aus dem Ist-Spend der Warengruppe (drei Jahre bis zum letzten vollen). */
  private async computed(
    tx: TenantTransaction,
    orgId: string,
    groupId: string,
    suppliers: { relationshipId: string; name: string; country: string | null }[],
    input: {
      stability: { relationshipId: string; rating: string }[];
      quality: { relationshipId: string; rating: string }[];
    },
  ): Promise<AnalysisComputed> {
    const spendYear = lastFullYear();
    const years = [spendYear - 2, spendYear - 1, spendYear];
    const s = schema.relationshipSpend;
    const spend = await tx
      .select({
        relationshipId: s.relationshipId,
        year: s.year,
        businessUnitId: s.businessUnitId,
        productGroupId: s.productGroupId,
        amountCents: s.amountCents,
        currency: s.currency,
      })
      .from(s)
      .where(and(eq(s.materialGroupId, groupId), eq(s.kind, 'actual'), inArray(s.year, years)));
    const currency = spend[0]?.currency ?? 'EUR';
    const current = spend.filter((row) => row.year === spendYear);
    const bySupplier = new Map<string, number>();
    for (const row of current) {
      bySupplier.set(
        row.relationshipId,
        (bySupplier.get(row.relationshipId) ?? 0) + row.amountCents,
      );
    }
    const nameOf = new Map(suppliers.map((entry) => [entry.relationshipId, entry]));

    // Volumen: Produktgruppen, oberste 80 %, höchstens zehn
    const productGroups = await tx
      .select({
        id: schema.materialGroupProductGroup.id,
        name: schema.materialGroupProductGroup.name,
      })
      .from(schema.materialGroupProductGroup)
      .where(eq(schema.materialGroupProductGroup.materialGroupId, groupId));
    const pgAmounts = shares(
      current.map((row) => ({
        key: row.productGroupId ?? 'none',
        name: productGroups.find((entry) => entry.id === row.productGroupId)?.name ?? '',
        amountCents: row.amountCents,
      })),
    );
    const top = topShares(pgAmounts);

    // Volumen: Ist je Business Unit und Jahr
    const units = await tx
      .select({ id: schema.businessUnit.id, name: schema.businessUnit.name })
      .from(schema.businessUnit);
    const unitIds = [...new Set(spend.map((row) => row.businessUnitId))];
    const byBusinessUnit = unitIds.map((unitId) => ({
      businessUnit: unitId ? (units.find((unit) => unit.id === unitId) ?? null) : null,
      years: years.map((year) => ({
        year,
        amountCents: spend
          .filter((row) => row.businessUnitId === unitId && row.year === year)
          .reduce((sum, row) => sum + row.amountCents, 0),
      })),
    }));

    // Umsatz und Finanzen: nach Segment Ist in der Warengruppe (WG-18)
    const ids = suppliers.map((entry) => entry.relationshipId);
    const decisions = ids.length
      ? await tx.execute<{
          relationship_id: string;
          model_version: number;
          ist_impact_level: number;
          ist_quality_level: number;
        }>(sql`
          select distinct on (relationship_id) relationship_id, model_version,
            ist_impact_level, ist_quality_level
          from segment_decision
          where scope = 'category' and material_group_id = ${groupId}
            and relationship_id in ${ids}
          order by relationship_id, version desc
        `)
      : { rows: [] };
    const names = new Map<number, Map<string, string>>();
    for (const row of decisions.rows) {
      if (!names.has(row.model_version)) {
        names.set(row.model_version, await typeNames(tx, orgId, row.model_version));
      }
    }
    const segmentOf = (relationshipId: string) => {
      const row = decisions.rows.find((entry) => entry.relationship_id === relationshipId);
      if (!row) return { key: 'none', name: '' };
      const key = `${row.ist_impact_level}-${row.ist_quality_level}`;
      return { key, name: names.get(row.model_version)?.get(key) ?? '' };
    };
    const supplierShares = (pick: (relationshipId: string) => { key: string; name: string }) =>
      shares(
        [...bySupplier.entries()].map(([relationshipId, amountCents]) => ({
          ...pick(relationshipId),
          amountCents,
        })),
      );

    // Anteil der fünf größten Lieferanten je Jahr, gereiht nach dem letzten vollen Jahr
    const totalOf = (year: number) =>
      spend.filter((row) => row.year === year).reduce((sum, row) => sum + row.amountCents, 0);
    const topSuppliers = [...bySupplier.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([relationshipId]) => ({
        relationshipId,
        name: nameOf.get(relationshipId)?.name ?? '',
        shares: years.map((year) => {
          const total = totalOf(year);
          const own = spend
            .filter((row) => row.year === year && row.relationshipId === relationshipId)
            .reduce((sum, row) => sum + row.amountCents, 0);
          return { year, share: total > 0 ? own / total : 0 };
        }),
      }));

    const rated = (list: { relationshipId: string; rating: string }[]) => (id: string) => {
      const rating = list.find((entry) => entry.relationshipId === id)?.rating;
      return { key: rating ?? 'none', name: rating ?? '' };
    };

    return {
      currency,
      spendYear,
      years,
      productGroups: top.top.map(({ key, name, amountCents, share }) => ({
        key,
        name,
        amountCents,
        share,
      })),
      productGroupRestShare: top.restShare,
      byBusinessUnit,
      bySegment: supplierShares(segmentOf),
      topSuppliers,
      byStability: supplierShares(rated(input.stability)),
      byQualityRating: supplierShares(rated(input.quality)),
      bySupplierCountry: supplierShares((id) => {
        const country = nameOf.get(id)?.country ?? null;
        return { key: country ?? 'none', name: country ?? '' };
      }),
    };
  }

  save(auth: AuthContext, strategyId: string, view: string, input: unknown): Promise<AnalysisStep> {
    if (!(analysisViewKeys as readonly string[]).includes(view)) throw notFound();
    const key = view as AnalysisViewKey;
    const parsed = analysisDataSchemas[key].safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'invalid_analysis',
        message: 'Ungültige Eingabe',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
        })),
      });
    }
    const step = analysisStepOf(key);
    return this.run(auth, async (tx, organization) => {
      const { strategy } = await this.editable(tx, auth, strategyId, step);
      await tx
        .insert(schema.materialGroupAnalysis)
        .values({
          orgId: organization.id,
          strategyId,
          view: key,
          data: parsed.data,
          updatedBy: auth.userId,
        })
        .onConflictDoUpdate({
          target: [schema.materialGroupAnalysis.strategyId, schema.materialGroupAnalysis.view],
          set: { data: parsed.data, updatedBy: auth.userId, updatedAt: new Date() },
        });
      await this.strategies.touchedIn(tx, strategy);
      return this.stepIn(tx, auth, organization.id, strategyId, step);
    });
  }

  addCandidate(
    auth: AuthContext,
    strategyId: string,
    input: CandidateRequest,
  ): Promise<AnalysisStep> {
    const candidate = candidateRequestSchema.parse(input);
    return this.run(auth, async (tx, organization) => {
      await this.editable(tx, auth, strategyId, 4);
      await tx.insert(schema.materialGroupCandidate).values({
        orgId: organization.id,
        strategyId,
        ...candidate,
      });
      return this.stepIn(tx, auth, organization.id, strategyId, 4);
    });
  }

  removeCandidate(auth: AuthContext, strategyId: string, id: string): Promise<AnalysisStep> {
    return this.run(auth, async (tx, organization) => {
      await this.editable(tx, auth, strategyId, 4);
      const removed = await tx
        .delete(schema.materialGroupCandidate)
        .where(
          and(
            eq(schema.materialGroupCandidate.id, id),
            eq(schema.materialGroupCandidate.strategyId, strategyId),
          ),
        )
        .returning({ id: schema.materialGroupCandidate.id });
      if (!removed.length) throw notFound();
      return this.stepIn(tx, auth, organization.id, strategyId, 4);
    });
  }

  /**
   * „Als Lieferant anlegen“: ein Klick legt den Lieferanten im Status Entwurf an (PLT-03; der
   * Status „Kandidat“ der Spec ist der Entwurf) und markiert den Eintrag.
   */
  async candidateToSupplier(auth: AuthContext, strategyId: string, id: string) {
    const candidate = await this.run(auth, async (tx) => {
      await this.editable(tx, auth, strategyId, 4);
      const [row] = await tx
        .select()
        .from(schema.materialGroupCandidate)
        .where(
          and(
            eq(schema.materialGroupCandidate.id, id),
            eq(schema.materialGroupCandidate.strategyId, strategyId),
          ),
        );
      if (!row) throw notFound();
      if (row.isSupplier) {
        throw new HttpException({ statusCode: 409, code: 'already_supplier' }, 409);
      }
      if (!row.country) {
        throw new BadRequestException({
          code: 'country_missing',
          message: 'Für einen Lieferanten braucht es ein Land.',
        });
      }
      return row;
    });
    const created = await this.suppliersService.create(auth, {
      name: candidate.name,
      country: candidate.country as string,
    });
    return this.run(auth, async (tx, organization) => {
      await tx
        .update(schema.materialGroupCandidate)
        .set({ isSupplier: true })
        .where(eq(schema.materialGroupCandidate.id, id));
      return {
        relationshipId: created.relationshipId,
        step: await this.stepIn(tx, auth, organization.id, strategyId, 4),
      };
    });
  }
}
