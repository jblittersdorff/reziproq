import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, schema, sql } from '@reziproq/db';
import {
  type OpportunityConfidence,
  type OpportunityImpactType,
  type OpportunityTemplateKey,
  opportunityImpactTypes,
  type ValueOverview,
  valueOverviewSchema,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { syncRealized } from './realized.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const rank: Record<OpportunityConfidence, number> = { low: 0, medium: 1, high: 2 };

type Row = typeof schema.valueOpportunity.$inferSelect;
const sum = (rows: Row[]) =>
  rows.length === 0
    ? null
    : {
        low: rows.reduce((total, row) => total + row.buyerLowCents, 0),
        high: rows.reduce((total, row) => total + row.buyerHighCents, 0),
      };

/**
 * KI-11, Ablauf 7: Wertpotenziale über alle Beziehungen. Summen nur mit Sicherheit hoch und
 * mittel, je Wirkungsart getrennt; Signale und Datenlücken mit der Zahl betroffener Lieferanten.
 */
@Injectable()
export class OpportunityOverviewService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  overview(auth: AuthContext): Promise<ValueOverview> {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'wirkung.sehen')) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await syncRealized(tx, organization.id);
      const relationships = await tx
        .select({
          id: schema.relationship.id,
          name: sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`,
        })
        .from(schema.relationship)
        .innerJoin(
          schema.organization,
          eq(schema.organization.id, schema.relationship.supplierOrgId),
        )
        .leftJoin(
          schema.relationshipSide,
          and(
            eq(schema.relationshipSide.relationshipId, schema.relationship.id),
            eq(schema.relationshipSide.orgId, organization.id),
          ),
        )
        .where(eq(schema.relationship.buyerOrgId, organization.id));
      const names = new Map(relationships.map((entry) => [entry.id, entry.name]));
      const rows = (
        await tx
          .select()
          .from(schema.valueOpportunity)
          .where(
            and(
              eq(schema.valueOpportunity.orgId, organization.id),
              inArray(schema.valueOpportunity.status, ['new', 'adopted', 'realized']),
            ),
          )
      ).filter((row) => names.has(row.relationshipId));
      const counted = rows.filter((row) => row.confidence !== 'low');
      const range = (impactType: OpportunityImpactType, status: Row['status']) =>
        sum(counted.filter((row) => row.impactType === impactType && row.status === status)) ?? {
          low: 0,
          high: 0,
        };
      const fresh = rows.filter((row) => row.status === 'new');
      const biggest = fresh
        .filter((row) => row.confidence !== 'low')
        .sort((a, b) => b.buyerHighCents - a.buyerHighCents)[0];

      const byRelationship = new Map<string, Row[]>();
      for (const row of rows) {
        byRelationship.set(row.relationshipId, [
          ...(byRelationship.get(row.relationshipId) ?? []),
          row,
        ]);
      }
      const suppliers = [...byRelationship.entries()]
        .map(([relationshipId, list]) => {
          const open = list.filter((row) => row.status === 'new');
          const openCounted = open.filter((row) => row.confidence !== 'low');
          const best = open.reduce<OpportunityConfidence | null>(
            (current, row) =>
              current === null || rank[row.confidence] > rank[current] ? row.confidence : current,
            null,
          );
          return {
            relationshipId,
            name: names.get(relationshipId) ?? '',
            newCount: open.length,
            adoptedCount: list.filter((row) => row.status === 'adopted').length,
            ebitNew: sum(openCounted.filter((row) => row.impactType === 'ebit')),
            cashNew: sum(openCounted.filter((row) => row.impactType === 'cash')),
            confidence: best,
            nextStep:
              open.length > 0
                ? ('review' as const)
                : list.length > 0
                  ? ('in_jbp' as const)
                  : ('run' as const),
          };
        })
        .sort((a, b) => (b.ebitNew?.high ?? 0) - (a.ebitNew?.high ?? 0));

      const levers = new Map<OpportunityTemplateKey, number>();
      for (const row of fresh) {
        const key = row.templateKey as OpportunityTemplateKey;
        levers.set(key, (levers.get(key) ?? 0) + 1);
      }

      // Signale mit Wirkung aus dem jüngsten Lauf je Beziehung
      const signals = await tx.execute<{ title: string; suppliers: string }>(sql`
          select s.title, count(distinct s.relationship_id)::text as suppliers
          from value_market_signal s
          where s.org_id = ${organization.id} and s.outcome <> 'no_effect'
            and s.run_id = (
              select s2.run_id from value_market_signal s2
              where s2.relationship_id = s.relationship_id and s2.org_id = s.org_id
              order by s2.observed_at desc limit 1)
          group by s.title order by count(distinct s.relationship_id) desc, s.title limit 5`);
      const gaps = await tx.execute<{
        data_key: string;
        description: string;
        suppliers: string;
      }>(sql`
          select g.data_key, min(g.description) as description,
            count(distinct g.relationship_id)::text as suppliers
          from value_data_gap g
          where g.org_id = ${organization.id} and g.status in ('open', 'requested')
          group by g.data_key order by count(distinct g.relationship_id) desc, g.data_key limit 5`);

      return valueOverviewSchema.parse({
        counts: {
          new: fresh.length,
          adopted: rows.filter((row) => row.status === 'adopted').length,
          realized: rows.filter((row) => row.status === 'realized').length,
          lowExcluded: fresh.filter((row) => row.confidence === 'low').length,
        },
        totals: opportunityImpactTypes
          .filter((impactType) => rows.some((row) => row.impactType === impactType))
          .map((impactType) => ({
            impactType,
            new: range(impactType, 'new'),
            adopted: range(impactType, 'adopted'),
            realized: range(impactType, 'realized'),
          })),
        biggest: biggest
          ? {
              relationshipId: biggest.relationshipId,
              supplierName: names.get(biggest.relationshipId) ?? '',
              templateKey: biggest.templateKey,
              impactType: biggest.impactType,
              buyer: { low: biggest.buyerLowCents, high: biggest.buyerHighCents },
              confidence: biggest.confidence,
            }
          : null,
        suppliers,
        levers: [...levers.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([templateKey, count]) => ({ templateKey, count })),
        signals: signals.rows.map((row) => ({
          title: row.title,
          suppliers: Number(row.suppliers),
        })),
        dataGaps: gaps.rows.map((row) => ({
          dataKey: row.data_key,
          description: row.description,
          suppliers: Number(row.suppliers),
        })),
      });
    });
  }
}
