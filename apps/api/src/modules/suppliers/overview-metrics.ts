import { Injectable } from '@nestjs/common';
import { and, desc, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import type { OverviewMetric } from '@reziproq/shared';
import type { AuthContext } from '../auth/auth.guard.js';
import type { OverviewMetricSource } from '../overview/overview-metric.js';

/** Strategie im Überblick (NAV-06): Spend des letzten Jahres mit Daten (PLT-03). */
@Injectable()
export class SpendMetricSource implements OverviewMetricSource {
  async overviewMetric(
    relationshipId: string,
    _user: AuthContext,
    tx: TenantTransaction,
  ): Promise<OverviewMetric | null> {
    const { relationshipSpend } = schema;
    // Je Jahr gibt es höchstens eine Zeile je Beziehung; die eigene liefert Row-Level Security.
    const [row] = await tx
      .select({
        year: relationshipSpend.year,
        amountCents: relationshipSpend.amountCents,
        currency: relationshipSpend.currency,
      })
      .from(relationshipSpend)
      .where(eq(relationshipSpend.relationshipId, relationshipId))
      .orderBy(desc(relationshipSpend.year))
      .limit(1);
    if (!row) return null;
    return {
      tile: 'strategy',
      kind: 'spend',
      year: row.year,
      amount: { amountCents: row.amountCents, currency: row.currency },
    };
  }
}

/** Beziehung im Überblick (NAV-06): Personen im internen Team (PLT-05b). */
@Injectable()
export class TeamMetricSource implements OverviewMetricSource {
  async overviewMetric(
    relationshipId: string,
    user: AuthContext,
    tx: TenantTransaction,
  ): Promise<OverviewMetric | null> {
    const { relationshipMember } = schema;
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(relationshipMember)
      .where(
        and(
          eq(relationshipMember.relationshipId, relationshipId),
          eq(relationshipMember.orgId, user.organization?.id ?? ''),
        ),
      );
    return { tile: 'relationship', kind: 'team_size', count: row?.count ?? 0 };
  }
}
