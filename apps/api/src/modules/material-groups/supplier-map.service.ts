import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  type SupplierMap,
  type SupplierMapUpdate,
  supplierMapSchema,
  supplierMapUpdateSchema,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { StrategyService } from './strategy.service.js';
import {
  activeSegmentTypes,
  latestCategoryDecisions,
  supplierMapData,
} from './supplier-map-data.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const invalid = (code: string) => new BadRequestException({ statusCode: 400, code });
const conflict = (code: string) => new ConflictException({ statusCode: 409, code });

const step = 9;

/**
 * WG-15 (Schritt 28): Supplier Map der Warengruppenstrategie. Umsatzanteil Ist und Segment Ist sind
 * hier nicht änderbar. Der Soll-Typ ist das Soll der Segmententscheidung der Warengruppe: Ändern
 * schreibt eine neue Version (Herkunft `manual`); nur „beenden“ steht an der Zeile der Map.
 * Der SRO einer Beziehung sieht seine Zeile auch im Entwurf; Lieferanten nie.
 */
@Injectable()
export class SupplierMapService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(StrategyService) private readonly strategies: StrategyService,
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

  /** Beziehungen der Warengruppe, für die die Person SRO ist */
  private async sroOf(tx: TenantTransaction, auth: AuthContext, orgId: string) {
    const rows = await tx
      .select({ relationshipId: schema.relationshipMember.relationshipId })
      .from(schema.relationshipMember)
      .where(
        and(
          eq(schema.relationshipMember.orgId, orgId),
          eq(schema.relationshipMember.userId, auth.userId),
          eq(schema.relationshipMember.teamRole, 'sro'),
        ),
      );
    return new Set(rows.map((row) => row.relationshipId));
  }

  map(auth: AuthContext, strategyId: string): Promise<SupplierMap> {
    return this.run(auth, (tx, organization) => this.view(tx, auth, organization.id, strategyId));
  }

  private async view(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    strategyId: string,
  ): Promise<SupplierMap> {
    let access: Awaited<ReturnType<StrategyService['accessIn']>> | null = null;
    try {
      access = await this.strategies.accessIn(tx, auth, strategyId);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }
    let strategy = access?.strategy;
    let restrictTo: Set<string> | null = null;
    if (!access) {
      // Entwurf ohne Rolle im Team: nur der SRO sieht seine Zeilen
      const [row] = await tx
        .select()
        .from(schema.materialGroupStrategy)
        .where(eq(schema.materialGroupStrategy.id, strategyId));
      if (!row) throw notFound();
      restrictTo = await this.sroOf(tx, auth, orgId);
      strategy = row;
    }
    if (!strategy) throw notFound();
    const data = await supplierMapData(tx, orgId, strategy.id, strategy.materialGroupId);
    if (restrictTo) {
      const own = (row: { relationshipId: string }) => restrictTo.has(row.relationshipId);
      if (![...data.rows, ...data.rest].some(own)) throw notFound();
      return supplierMapSchema.parse({
        canEdit: false,
        restricted: true,
        strategyYear: strategy.year,
        spendYear: data.spendYear,
        currency: data.currency,
        totalCents: data.totalCents,
        rows: [...data.rows, ...data.rest].filter(own),
        rest: [],
        restCents: 0,
        restShare: 0,
        segmentTypes: data.segmentTypes,
        complete: data.complete,
        handoverRelationshipId: null,
      });
    }
    const biggest = data.rows[0]?.relationshipId ?? null;
    return supplierMapSchema.parse({
      canEdit: access?.editableSteps.includes(step) ?? false,
      restricted: false,
      strategyYear: strategy.year,
      spendYear: data.spendYear,
      currency: data.currency,
      totalCents: data.totalCents,
      rows: data.rows,
      rest: data.rest,
      restCents: data.restCents,
      restShare: data.restShare,
      segmentTypes: data.segmentTypes,
      complete: data.complete,
      handoverRelationshipId: data.complete ? biggest : null,
    });
  }

  /** Soll-Werte einer Zeile: Standort, Anteil Soll, Zieljahr (Pflicht) und Soll-Typ */
  update(
    auth: AuthContext,
    strategyId: string,
    relationshipId: string,
    input: SupplierMapUpdate,
  ): Promise<SupplierMap> {
    return this.run(auth, async (tx, organization) => {
      const access = await this.strategies.accessIn(tx, auth, strategyId);
      if (!access.editableSteps.includes(step)) throw forbidden();
      const parsed = supplierMapUpdateSchema.safeParse(input);
      if (!parsed.success) throw invalid(parsed.error.issues[0]?.message ?? 'invalid');
      const request = parsed.data;
      const groupId = access.group.id;
      const [member] = await tx
        .select({ id: schema.relationshipMaterialGroup.relationshipId })
        .from(schema.relationshipMaterialGroup)
        .innerJoin(
          schema.relationship,
          eq(schema.relationship.id, schema.relationshipMaterialGroup.relationshipId),
        )
        .where(
          and(
            eq(schema.relationshipMaterialGroup.materialGroupId, groupId),
            eq(schema.relationshipMaterialGroup.relationshipId, relationshipId),
            sql`${schema.relationship.status} <> 'ended'`,
          ),
        );
      if (!member) throw notFound();
      if (request.targetYear !== null && request.targetYear < access.strategy.year) {
        throw invalid('target_year_past');
      }
      const t = schema.materialGroupSupplierMapRow;
      const [current] = await tx
        .select()
        .from(t)
        .where(and(eq(t.strategyId, strategyId), eq(t.relationshipId, relationshipId)));
      const ended = request.segmentTarget
        ? request.segmentTarget.kind === 'ended'
        : (current?.ended ?? false);
      if (ended && request.targetYear === null) throw invalid('target_year_required');

      const target = request.segmentTarget;
      if (target?.kind === 'segment') {
        const { version: modelVersion, types } = await activeSegmentTypes(tx, organization.id);
        if (modelVersion === null) throw conflict('no_active_model');
        if (
          !types.some(
            (type) =>
              type.impactLevel === target.impactLevel && type.qualityLevel === target.qualityLevel,
          )
        ) {
          throw invalid('segment_unknown');
        }
        const decision = (await latestCategoryDecisions(tx, groupId, [relationshipId])).get(
          relationshipId,
        );
        // Segment Ist kommt nur aus der Segmentierung der Warengruppe (WG-18)
        if (!decision) throw conflict('segment_ist_missing');
        if (
          decision.sollImpactLevel !== target.impactLevel ||
          decision.sollQualityLevel !== target.qualityLevel
        ) {
          await tx.insert(schema.segmentDecision).values({
            relationshipId,
            scope: 'category',
            materialGroupId: groupId,
            istImpactLevel: decision.istImpactLevel,
            istQualityLevel: decision.istQualityLevel,
            sollImpactLevel: target.impactLevel,
            sollQualityLevel: target.qualityLevel,
            reason: `Soll-Typ aus der Supplier Map ${access.strategy.year}`,
            modelVersion,
            decidedBy: auth.userId,
            version: decision.version + 1,
            origin: 'manual',
          });
        }
      }
      const values = {
        site: request.site || null,
        shareTarget: request.shareTarget,
        targetYear: request.targetYear,
        ended,
        updatedBy: auth.userId,
        updatedAt: new Date(),
      };
      if (current) await tx.update(t).set(values).where(eq(t.id, current.id));
      else {
        await tx
          .insert(t)
          .values({ orgId: organization.id, strategyId, relationshipId, ...values });
      }
      await this.strategies.touchedIn(tx, access.strategy);
      return this.view(tx, auth, organization.id, strategyId);
    });
  }
}
