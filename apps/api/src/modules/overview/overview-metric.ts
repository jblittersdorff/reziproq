import type { TenantTransaction } from '@reziproq/db';
import type { OverviewMetric } from '@reziproq/shared';
import type { AuthContext } from '../auth/auth.guard.js';

/**
 * Kennzahl-Quelle (NAV-06): Jedes Modul meldet für den Überblick genau eine Kennzahl je Lieferant.
 * Die Quelle liest in der Mandanten-Session des Überblicks; die ist nur lesend, Schreiben scheitert.
 * null heißt: noch nichts erfasst. Neue Module tragen ihre Quelle in overview.module.ts ein.
 */
export interface OverviewMetricSource {
  overviewMetric(
    relationshipId: string,
    user: AuthContext,
    tx: TenantTransaction,
  ): Promise<OverviewMetric | null>;
}

export const OVERVIEW_METRIC_SOURCES = Symbol('OVERVIEW_METRIC_SOURCES');
