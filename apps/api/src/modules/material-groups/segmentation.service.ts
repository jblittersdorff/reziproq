import {
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  type CategorySegmentation,
  categorySegmentationSchema,
  type DecideCategorySegment,
  lastFullYear,
  type StartCategoryRound,
  type UserFunction,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { typeNames } from '../ratings/consolidation.js';
import { RatingsService } from '../ratings/ratings.service.js';
import { RoundsService } from '../rounds/rounds.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const fail = (statusCode: 400 | 409, code: string, message: string) =>
  new HttpException({ statusCode, code, message }, statusCode);

const supplierName = sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`;

type GroupRow = typeof schema.materialGroup.$inferSelect;

/**
 * WG-18: Segmentierung je Warengruppe. Nutzt Runde, Kriterien, Gewichte und Segmente aus SEG
 * unverändert; neu sind der Geltungsbereich der Runde und das Segment in der Warengruppe.
 * Lead, Commodity Manager und Admin starten und entscheiden; das Team bewertet.
 */
@Injectable()
export class CategorySegmentationService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(RatingsService) private readonly ratings: RatingsService,
    @Inject(RoundsService) private readonly rounds: RoundsService,
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

  private async group(tx: TenantTransaction, id: string): Promise<GroupRow> {
    const [group] = await tx
      .select()
      .from(schema.materialGroup)
      .where(eq(schema.materialGroup.id, id));
    if (!group) throw notFound();
    return group;
  }

  /** Lead, Commodity Manager (an der Warengruppe oder im Team) und Admin, jeweils mit dem Recht. */
  private async manages(tx: TenantTransaction, auth: AuthContext, group: GroupRow) {
    if (!can(auth, 'warengruppen.segmentieren')) return false;
    if (auth.orgRole === 'admin') return true;
    if (group.leadUserId === auth.userId || group.commodityManagerUserId === auth.userId) {
      return true;
    }
    const [row] = await tx
      .select({ id: schema.materialGroupMember.id })
      .from(schema.materialGroupMember)
      .where(
        and(
          eq(schema.materialGroupMember.materialGroupId, group.id),
          eq(schema.materialGroupMember.userId, auth.userId),
          inArray(schema.materialGroupMember.role, ['lead', 'commodity_manager']),
        ),
      );
    return Boolean(row);
  }

  private async requireManager(tx: TenantTransaction, auth: AuthContext, groupId: string) {
    const group = await this.group(tx, groupId);
    if (!(await this.manages(tx, auth, group))) throw forbidden();
    return group;
  }

  /** Aktive Lieferanten der Warengruppe mit ihren Business Units. */
  private async suppliers(tx: TenantTransaction, orgId: string, groupId: string) {
    const rows = await tx
      .select({ relationshipId: schema.relationship.id, name: supplierName })
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
    const ids = rows.map((row) => row.relationshipId);
    const units = ids.length
      ? await tx
          .select({
            relationshipId: schema.relationshipBusinessUnit.relationshipId,
            id: schema.businessUnit.id,
          })
          .from(schema.relationshipBusinessUnit)
          .innerJoin(
            schema.businessUnit,
            eq(schema.businessUnit.id, schema.relationshipBusinessUnit.businessUnitId),
          )
          .where(inArray(schema.relationshipBusinessUnit.relationshipId, ids))
          .orderBy(asc(schema.businessUnit.name))
      : [];
    return rows.map((row) => ({
      ...row,
      unitIds: units.filter((unit) => unit.relationshipId === row.relationshipId).map((u) => u.id),
    }));
  }

  /** Team als Bewertende: alle Rollen der Warengruppe, ohne Leser der Organisation. */
  private async raters(tx: TenantTransaction, groupId: string) {
    const rows = await tx
      .select({
        userId: schema.appUser.id,
        name: schema.appUser.name,
        defaultFunction: schema.appUser.defaultFunction,
        businessUnitId: schema.materialGroupMember.businessUnitId,
      })
      .from(schema.materialGroupMember)
      .innerJoin(schema.appUser, eq(schema.appUser.id, schema.materialGroupMember.userId))
      .where(
        and(
          eq(schema.materialGroupMember.materialGroupId, groupId),
          sql`${schema.appUser.orgRole} <> 'viewer'`,
        ),
      )
      .orderBy(asc(schema.appUser.name));
    const seen = new Map<
      string,
      { userId: string; name: string; function: UserFunction; unitIds: string[] }
    >();
    for (const row of rows) {
      const entry = seen.get(row.userId) ?? {
        userId: row.userId,
        name: row.name,
        function: row.defaultFunction ?? 'purchasing',
        unitIds: [],
      };
      if (row.businessUnitId) entry.unitIds.push(row.businessUnitId);
      seen.set(row.userId, entry);
    }
    return [...seen.values()];
  }

  private async activeTypes(tx: TenantTransaction, orgId: string) {
    const [model] = await tx
      .select({ id: schema.segmentModel.id, version: schema.segmentModel.version })
      .from(schema.segmentModel)
      .where(and(eq(schema.segmentModel.orgId, orgId), eq(schema.segmentModel.status, 'active')));
    if (!model) return { version: null, types: [] };
    const types = await tx
      .select({
        impactLevel: schema.segmentType.impactLevel,
        qualityLevel: schema.segmentType.qualityLevel,
        name: schema.segmentType.name,
      })
      .from(schema.segmentType)
      .where(eq(schema.segmentType.modelId, model.id))
      .orderBy(desc(schema.segmentType.impactLevel), desc(schema.segmentType.qualityLevel));
    return { version: model.version, types };
  }

  overview(auth: AuthContext, groupId: string): Promise<CategorySegmentation> {
    return this.run(auth, (tx, organization) =>
      this.overviewIn(tx, auth, organization.id, groupId),
    );
  }

  private async overviewIn(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    groupId: string,
  ): Promise<CategorySegmentation> {
    const group = await this.group(tx, groupId);
    const canManage = await this.manages(tx, auth, group);
    const spendYear = lastFullYear();
    const suppliers = await this.suppliers(tx, orgId, groupId);
    const ids = suppliers.map((supplier) => supplier.relationshipId);
    const { types } = await this.activeTypes(tx, orgId);

    const spend = ids.length
      ? await tx
          .select({
            relationshipId: schema.relationshipSpend.relationshipId,
            currency: schema.relationshipSpend.currency,
            amountCents: sql<number>`sum(${schema.relationshipSpend.amountCents})::bigint`.mapWith(
              Number,
            ),
          })
          .from(schema.relationshipSpend)
          .where(
            and(
              inArray(schema.relationshipSpend.relationshipId, ids),
              eq(schema.relationshipSpend.year, spendYear),
              eq(schema.relationshipSpend.kind, 'actual'),
              eq(schema.relationshipSpend.materialGroupId, groupId),
            ),
          )
          .groupBy(schema.relationshipSpend.relationshipId, schema.relationshipSpend.currency)
      : [];

    const [round] = await tx
      .select()
      .from(schema.segmentationRound)
      .where(
        and(
          eq(schema.segmentationRound.scope, 'category'),
          eq(schema.segmentationRound.materialGroupId, groupId),
        ),
      )
      .orderBy(desc(schema.segmentationRound.createdAt))
      .limit(1);
    const assignments = round
      ? await tx
          .select({
            relationshipId: schema.ratingAssignment.relationshipId,
            status: schema.ratingAssignment.status,
          })
          .from(schema.ratingAssignment)
          .where(eq(schema.ratingAssignment.roundId, round.id))
      : [];

    const d = schema.segmentDecision;
    const decisions = ids.length
      ? await tx
          .select({
            relationshipId: d.relationshipId,
            scope: d.scope,
            version: d.version,
            modelVersion: d.modelVersion,
            materialGroupId: d.materialGroupId,
            istImpact: d.istImpactLevel,
            istQuality: d.istQualityLevel,
            sollImpact: d.sollImpactLevel,
            sollQuality: d.sollQualityLevel,
            reason: d.reason,
            origin: d.origin,
            decidedAt: d.decidedAt,
            decidedBy: schema.appUser.name,
          })
          .from(d)
          .innerJoin(schema.appUser, eq(schema.appUser.id, d.decidedBy))
          .where(
            and(
              inArray(d.relationshipId, ids),
              sql`(${d.scope} = 'total' or (${d.scope} = 'category' and ${d.materialGroupId} = ${groupId}))`,
            ),
          )
          .orderBy(desc(d.version))
      : [];
    const names = new Map<number, Map<string, string>>();
    for (const version of new Set(decisions.map((row) => row.modelVersion))) {
      names.set(version, await typeNames(tx, orgId, version));
    }
    const typed = (version: number, impactLevel: number, qualityLevel: number) => ({
      impactLevel,
      qualityLevel,
      typeName: names.get(version)?.get(`${impactLevel}-${qualityLevel}`) ?? '',
    });

    const rows = [];
    for (const supplier of suppliers) {
      const own = assignments.filter((row) => row.relationshipId === supplier.relationshipId);
      const { segmentation } = own.length
        ? await this.ratings.segmentationIn(tx, auth, orgId, supplier.relationshipId, groupId)
        : { segmentation: null };
      const ist = segmentation?.overall.ist;
      const soll = segmentation?.overall.soll;
      const latest = decisions.find(
        (row) => row.relationshipId === supplier.relationshipId && row.scope === 'category',
      );
      const total = decisions.find(
        (row) => row.relationshipId === supplier.relationshipId && row.scope === 'total',
      );
      const amount = spend.find((row) => row.relationshipId === supplier.relationshipId);
      rows.push({
        relationshipId: supplier.relationshipId,
        name: supplier.name,
        spendCents: amount?.amountCents ?? 0,
        currency: amount?.currency ?? 'EUR',
        rateable: supplier.unitIds.length > 0,
        ratings: {
          submitted: own.filter((row) => row.status === 'submitted').length,
          total: own.length,
        },
        suggestion:
          ist && soll
            ? {
                ist: {
                  impactLevel: ist.impactLevel,
                  qualityLevel: ist.qualityLevel,
                  typeName: ist.typeName,
                },
                soll: {
                  impactLevel: soll.impactLevel,
                  qualityLevel: soll.qualityLevel,
                  typeName: soll.typeName,
                },
              }
            : null,
        decision: latest
          ? {
              ist: typed(latest.modelVersion, latest.istImpact, latest.istQuality),
              soll: typed(latest.modelVersion, latest.sollImpact, latest.sollQuality),
              reason: latest.reason,
              origin: latest.origin,
              decidedAt: latest.decidedAt.toISOString(),
              decidedBy: latest.decidedBy,
              version: latest.version,
            }
          : null,
        overall: total
          ? {
              ist: typed(total.modelVersion, total.istImpact, total.istQuality),
              soll: typed(total.modelVersion, total.sollImpact, total.sollQuality),
            }
          : null,
      });
    }

    return categorySegmentationSchema.parse({
      group: { id: group.id, name: group.name },
      spendYear,
      canManage,
      round: round
        ? {
            id: round.id,
            name: round.name,
            dueDate: round.dueDate,
            status: round.status,
            submitted: assignments.filter((row) => row.status === 'submitted').length,
            total: assignments.length,
          }
        : null,
      types,
      raters: canManage
        ? (await this.raters(tx, groupId)).map(({ userId, name, function: fn }) => ({
            userId,
            name,
            function: fn,
          }))
        : [],
      suppliers: rows,
    });
  }

  /** Schritt 1 aus WG-18: Runde für die Warengruppe, Lieferanten vornominiert, Team bewertet. */
  start(
    auth: AuthContext,
    groupId: string,
    input: StartCategoryRound,
  ): Promise<CategorySegmentation> {
    return this.run(auth, async (tx, organization) => {
      const group = await this.requireManager(tx, auth, groupId);
      const [open] = await tx
        .select({ id: schema.segmentationRound.id })
        .from(schema.segmentationRound)
        .where(
          and(
            eq(schema.segmentationRound.scope, 'category'),
            eq(schema.segmentationRound.materialGroupId, groupId),
            eq(schema.segmentationRound.status, 'open'),
          ),
        );
      if (open) throw fail(409, 'round_open', 'Für die Warengruppe läuft schon eine Runde.');

      const suppliers = await this.suppliers(tx, organization.id, groupId);
      const wanted = [...new Set(input.relationshipIds)];
      const chosen = wanted.map((id) => suppliers.find((entry) => entry.relationshipId === id));
      if (chosen.some((entry) => !entry)) {
        throw fail(400, 'supplier_invalid', 'Ein Lieferant gehört nicht zur Warengruppe.');
      }
      if (chosen.some((entry) => !entry?.unitIds.length)) {
        throw fail(400, 'no_business_unit', 'Ein Lieferant hat keine Business Unit.');
      }
      const raters = await this.raters(tx, groupId);
      if (wanted.length && !raters.length) {
        throw fail(400, 'no_raters', 'Das Team der Warengruppe hat niemanden, der bewerten kann.');
      }

      // Je Lieferant, Business Unit und Funktion eine Stelle: die BU der Person im Team, wenn der
      // Lieferant sie hat, sonst seine erste.
      const slots = chosen.flatMap((supplier) => {
        if (!supplier) return [];
        const taken = new Set<string>();
        return raters.flatMap((rater) => {
          const unit =
            rater.unitIds.find((id) => supplier.unitIds.includes(id)) ??
            (supplier.unitIds[0] as string);
          const key = `${unit}:${rater.function}`;
          if (taken.has(key)) return [];
          taken.add(key);
          return [
            {
              relationshipId: supplier.relationshipId,
              businessUnitId: unit,
              function: rater.function,
              raterUserId: rater.userId,
            },
          ];
        });
      });
      await this.rounds.startCategoryIn(tx, auth, organization.id, {
        materialGroupId: groupId,
        name: `Segmentierung ${group.name}`,
        dueDate: input.dueDate,
        slots,
      });
      return this.overviewIn(tx, auth, organization.id, groupId);
    });
  }

  /** Schritt 3 aus WG-18: Segment Ist und Soll in der Warengruppe; jede Entscheidung eine Version. */
  decide(
    auth: AuthContext,
    groupId: string,
    relationshipId: string,
    input: DecideCategorySegment,
  ): Promise<CategorySegmentation> {
    return this.run(auth, async (tx, organization) => {
      await this.requireManager(tx, auth, groupId);
      const suppliers = await this.suppliers(tx, organization.id, groupId);
      if (!suppliers.some((entry) => entry.relationshipId === relationshipId)) throw notFound();
      const { version: modelVersion, types } = await this.activeTypes(tx, organization.id);
      if (modelVersion === null) {
        throw fail(409, 'no_active_model', 'Es gibt kein aktives Segmentmodell.');
      }
      const known = (level: { impactLevel: number; qualityLevel: number }) =>
        types.some(
          (type) =>
            type.impactLevel === level.impactLevel && type.qualityLevel === level.qualityLevel,
        );
      if (!known(input.ist) || !known(input.soll)) {
        throw fail(400, 'segment_unknown', 'Dieses Segment ist nicht eingestellt.');
      }
      const { segmentation } = await this.ratings.segmentationIn(
        tx,
        auth,
        organization.id,
        relationshipId,
        groupId,
      );
      const d = schema.segmentDecision;
      const [latest] = await tx
        .select({ version: sql<number>`coalesce(max(${d.version}), 0)::int` })
        .from(d)
        .where(
          and(
            eq(d.relationshipId, relationshipId),
            eq(d.scope, 'category'),
            eq(d.materialGroupId, groupId),
          ),
        );
      await tx.insert(d).values({
        relationshipId,
        scope: 'category',
        materialGroupId: groupId,
        istImpactLevel: input.ist.impactLevel,
        istQualityLevel: input.ist.qualityLevel,
        sollImpactLevel: input.soll.impactLevel,
        sollQualityLevel: input.soll.qualityLevel,
        reason: input.reason,
        modelVersion,
        decidedBy: auth.userId,
        version: (latest?.version ?? 0) + 1,
        origin: segmentation ? 'round' : 'manual',
      });
      return this.overviewIn(tx, auth, organization.id, groupId);
    });
  }
}
