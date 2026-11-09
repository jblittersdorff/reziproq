import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, schema, type TenantTransaction } from '@reziproq/db';
import {
  lastFullYear,
  type Portfolio,
  type PortfolioMatrix,
  type PortfolioOpen,
  portfolioMatrixSchema,
  portfolioOpenSchema,
  portfolioSchema,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { typeNames } from '../ratings/consolidation.js';
import { listSuppliers } from '../suppliers/suppliers.service.js';
import { type OpenInput, openGroups } from './open-decisions.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });

type Supplier = Awaited<ReturnType<typeof listSuppliers>>[number];

/** Portfolio (SEG-07): liest nur, was die Mandanten-Session der Käuferorganisation zeigt. */
@Injectable()
export class PortfolioService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

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

  private async suppliers(tx: TenantTransaction, year: number) {
    return (await listSuppliers(tx, year)).filter((supplier) => supplier.status !== 'ended');
  }

  /** Letzte Konsolidierung je Beziehung: alle Zeilen der höchsten Version. */
  private async latestDecisions(tx: TenantTransaction, ids: string[]) {
    if (ids.length === 0) return new Map<string, (typeof rows)[number][]>();
    const d = schema.segmentDecision;
    const rows = await tx
      .select({
        relationshipId: d.relationshipId,
        version: d.version,
        decidedAt: d.decidedAt,
        modelVersion: d.modelVersion,
        scope: d.scope,
        businessUnitId: d.businessUnitId,
        materialGroupId: d.materialGroupId,
        istImpact: d.istImpactLevel,
        istQuality: d.istQualityLevel,
        sollImpact: d.sollImpactLevel,
        sollQuality: d.sollQualityLevel,
      })
      .from(d)
      .where(inArray(d.relationshipId, ids));
    const newest = new Map<string, number>();
    for (const row of rows) {
      newest.set(row.relationshipId, Math.max(newest.get(row.relationshipId) ?? 0, row.version));
    }
    const result = new Map<string, typeof rows>();
    for (const row of rows) {
      if (row.version !== newest.get(row.relationshipId)) continue;
      result.set(row.relationshipId, [...(result.get(row.relationshipId) ?? []), row]);
    }
    return result;
  }

  async overview(auth: AuthContext): Promise<Portfolio> {
    return this.run(auth, async (tx, organization) => {
      const matrix = await this.matrixIn(tx, organization.id, {});
      const open = await this.openIn(tx, auth, organization.id);
      const rounds = await tx
        .select({ id: schema.segmentationRound.id })
        .from(schema.segmentationRound)
        .where(eq(schema.segmentationRound.status, 'open'));
      return portfolioSchema.parse({
        matrixCount: matrix.points.length,
        openCount: Object.values(open.groups).reduce((sum, group) => sum + group.length, 0),
        openRounds: rounds.length,
        focusCount: (await this.suppliers(tx, lastFullYear())).filter((s) => s.isFocus).length,
      });
    });
  }

  /**
   * Für Start (A2): Zahl der Lieferanten, Fokuslieferanten mit Stand der Spielregeln und offene
   * Entscheidungen. Liest nur.
   */
  async startSummary(auth: AuthContext) {
    return this.run(auth, async (tx, organization) => {
      const suppliers = await this.suppliers(tx, lastFullYear());
      const focus = suppliers.filter((supplier) => supplier.isFocus);
      const shared = focus.length
        ? await tx
            .select({ id: schema.relationshipTarget.relationshipId })
            .from(schema.relationshipTarget)
            .where(
              inArray(
                schema.relationshipTarget.relationshipId,
                focus.map((supplier) => supplier.relationshipId),
              ),
            )
        : [];
      const sharedIds = new Set(shared.map((row) => row.id));
      const open = await this.openIn(tx, auth, organization.id);
      return {
        suppliers: suppliers.length,
        focusTotal: focus.length,
        openDecisions: Object.values(open.groups).reduce((sum, group) => sum + group.length, 0),
        focus: focus.slice(0, 5).map((supplier) => ({
          id: supplier.relationshipId,
          name: supplier.name,
          rulesShared: sharedIds.has(supplier.relationshipId),
        })),
      };
    });
  }

  async matrix(
    auth: AuthContext,
    filter: { businessUnitId?: string | undefined; materialGroupId?: string | undefined },
  ): Promise<PortfolioMatrix> {
    return this.run(auth, (tx, organization) => this.matrixIn(tx, organization.id, filter));
  }

  private async matrixIn(
    tx: TenantTransaction,
    orgId: string,
    filter: { businessUnitId?: string | undefined; materialGroupId?: string | undefined },
  ): Promise<PortfolioMatrix> {
    const spendYear = lastFullYear();
    const suppliers = await this.suppliers(tx, spendYear);
    const byId = new Map<string, Supplier>(suppliers.map((s) => [s.relationshipId, s]));
    const decisions = await this.latestDecisions(tx, [...byId.keys()]);
    const businessUnits = await tx
      .select({ id: schema.businessUnit.id, name: schema.businessUnit.name })
      .from(schema.businessUnit)
      .orderBy(asc(schema.businessUnit.name));
    const materialGroups = await tx
      .select({ id: schema.materialGroup.id, name: schema.materialGroup.name })
      .from(schema.materialGroup)
      .orderBy(asc(schema.materialGroup.name));
    const unit = new Map(businessUnits.map((entry) => [entry.id, entry]));
    const group = new Map(materialGroups.map((entry) => [entry.id, entry]));
    const filtered = Boolean(filter.businessUnitId || filter.materialGroupId);

    const names = new Map<number, Map<string, string>>();
    const points: PortfolioMatrix['points'] = [];
    for (const [relationshipId, rows] of decisions) {
      const supplier = byId.get(relationshipId);
      if (!supplier) continue;
      const wanted = rows.filter((row) =>
        filtered
          ? row.scope === 'bu_mg' &&
            (!filter.businessUnitId || row.businessUnitId === filter.businessUnitId) &&
            (!filter.materialGroupId || row.materialGroupId === filter.materialGroupId)
          : row.scope === 'total',
      );
      for (const row of wanted) {
        if (!names.has(row.modelVersion)) {
          names.set(row.modelVersion, await typeNames(tx, orgId, row.modelVersion));
        }
        const label = (impact: number, quality: number) =>
          names.get(row.modelVersion)?.get(`${impact}-${quality}`) ?? '';
        points.push({
          relationshipId,
          name: supplier.name,
          spendCents: supplier.spend?.amountCents ?? 0,
          currency: supplier.spend?.currency ?? 'EUR',
          businessUnit: row.businessUnitId ? (unit.get(row.businessUnitId) ?? null) : null,
          materialGroup: row.materialGroupId ? (group.get(row.materialGroupId) ?? null) : null,
          ist: {
            impactLevel: row.istImpact,
            qualityLevel: row.istQuality,
            typeName: label(row.istImpact, row.istQuality),
          },
          soll: {
            impactLevel: row.sollImpact,
            qualityLevel: row.sollQuality,
            typeName: label(row.sollImpact, row.sollQuality),
          },
        });
      }
    }
    points.sort((a, b) => b.spendCents - a.spendCents || a.name.localeCompare(b.name, 'de'));
    return portfolioMatrixSchema.parse({ spendYear, businessUnits, materialGroups, points });
  }

  async open(auth: AuthContext): Promise<PortfolioOpen> {
    return this.run(auth, (tx, organization) => this.openIn(tx, auth, organization.id));
  }

  /** Offene Entscheidungen zeigt das Portfolio nur für Beziehungen, die die Person verantwortet (SEG-04). */
  private async openIn(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
  ): Promise<PortfolioOpen> {
    const suppliers = await this.suppliers(tx, lastFullYear());
    const [active] = await tx
      .select({ threshold: schema.segmentModel.deviationThreshold })
      .from(schema.segmentModel)
      .where(and(eq(schema.segmentModel.orgId, orgId), eq(schema.segmentModel.status, 'active')));
    const threshold = active?.threshold ?? 30;

    let managed = suppliers;
    if (auth.orgRole !== 'admin') {
      const own = await tx
        .select({ relationshipId: schema.relationshipMember.relationshipId })
        .from(schema.relationshipMember)
        .where(
          and(
            eq(schema.relationshipMember.orgId, orgId),
            eq(schema.relationshipMember.userId, auth.userId),
            eq(schema.relationshipMember.teamRole, 'sro'),
          ),
        );
      const ids = new Set(own.map((row) => row.relationshipId));
      managed = suppliers.filter((supplier) => ids.has(supplier.relationshipId));
    }
    const ids = managed.map((supplier) => supplier.relationshipId);
    if (ids.length === 0) {
      return portfolioOpenSchema.parse({
        deviationThreshold: threshold,
        groups: { ratings_open: [], not_consolidated: [], deviation: [] },
      });
    }

    const a = schema.ratingAssignment;
    const assignments = await tx
      .select({
        id: a.id,
        relationshipId: a.relationshipId,
        status: a.status,
        roundId: a.roundId,
        roundCreated: schema.segmentationRound.createdAt,
      })
      .from(a)
      .innerJoin(schema.segmentationRound, eq(schema.segmentationRound.id, a.roundId))
      .where(
        and(
          inArray(a.relationshipId, ids),
          inArray(schema.segmentationRound.status, ['open', 'closed']),
        ),
      );
    const latestRound = new Map<string, { id: string; created: Date }>();
    for (const row of assignments) {
      const best = latestRound.get(row.relationshipId);
      if (!best || row.roundCreated > best.created) {
        latestRound.set(row.relationshipId, { id: row.roundId, created: row.roundCreated });
      }
    }
    const current = assignments.filter(
      (row) => latestRound.get(row.relationshipId)?.id === row.roundId,
    );
    const values = current.length
      ? await tx
          .select({
            assignmentId: schema.rating.assignmentId,
            criterionKey: schema.rating.criterionKey,
            ist: schema.rating.ist,
            submittedAt: schema.rating.submittedAt,
          })
          .from(schema.rating)
          .where(
            inArray(
              schema.rating.assignmentId,
              current.map((row) => row.id),
            ),
          )
      : [];
    const decisions = await this.latestDecisions(tx, ids);

    const inputs: OpenInput[] = managed.map((supplier) => {
      const own = current.filter((row) => row.relationshipId === supplier.relationshipId);
      const ownValues = values.filter((value) => own.some((row) => row.id === value.assignmentId));
      const submittedAt = ownValues
        .map((value) => value.submittedAt)
        .filter((date): date is Date => date !== null);
      return {
        relationshipId: supplier.relationshipId,
        name: supplier.name,
        assignments: own.map((row) => ({
          status: row.status,
          values: ownValues
            .filter((value) => value.assignmentId === row.id)
            .map((value) => ({ criterionKey: value.criterionKey, ist: value.ist })),
        })),
        lastSubmittedAt: submittedAt.length
          ? new Date(Math.max(...submittedAt.map((date) => date.getTime())))
          : null,
        decidedAt: decisions.get(supplier.relationshipId)?.[0]?.decidedAt ?? null,
      };
    });
    return portfolioOpenSchema.parse({
      deviationThreshold: threshold,
      groups: openGroups(inputs, threshold),
    });
  }
}
