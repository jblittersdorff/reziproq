import { desc, eq, schema, type TenantTransaction } from '@reziproq/db';
import type { OverviewMetric } from '@reziproq/shared';
import type { AuthContext } from '../auth/auth.guard.js';
import type { OverviewMetricSource } from '../overview/overview-metric.js';

/** Kennzahl für den Überblick (NAV-06): geteilte Spielregeln mit Typ, Version und Datum (SEG-10). */
export class RulesMetricSource implements OverviewMetricSource {
  async overviewMetric(
    relationshipId: string,
    _user: AuthContext,
    tx: TenantTransaction,
  ): Promise<OverviewMetric | null> {
    const { relationshipTarget } = schema;
    const [row] = await tx
      .select({
        typeName: relationshipTarget.typeName,
        version: relationshipTarget.ruleSetVersion,
        sharedAt: relationshipTarget.sharedAt,
      })
      .from(relationshipTarget)
      .where(eq(relationshipTarget.relationshipId, relationshipId))
      .orderBy(desc(relationshipTarget.sharedAt))
      .limit(1);
    if (!row) return null;
    return {
      tile: 'relationship',
      kind: 'rules',
      typeName: row.typeName,
      version: row.version,
      sharedAt: row.sharedAt.toISOString(),
    };
  }
}
