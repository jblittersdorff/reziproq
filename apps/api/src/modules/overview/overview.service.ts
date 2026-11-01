import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { SupplierOverview } from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { ownRelationship, sroOf } from '../suppliers/team.service.js';
import { OVERVIEW_METRIC_SOURCES, type OverviewMetricSource } from './overview-metric.js';

/**
 * Überblick und Kopf des Arbeitsbereichs eines Lieferanten (NAV-06). Liest jeden Wert an seinem
 * Ort und speichert nichts: Die Mandanten-Session ist nur lesend.
 */
@Injectable()
export class OverviewService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(OVERVIEW_METRIC_SOURCES) private readonly sources: OverviewMetricSource[],
  ) {}

  async overview(auth: AuthContext, relationshipId: string): Promise<SupplierOverview> {
    const organization = auth.organization;
    if (!organization?.buyer) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => {
        await ownRelationship(tx, organization, relationshipId);
        const metrics = [];
        for (const source of this.sources) {
          const metric = await source.overviewMetric(relationshipId, auth, tx);
          if (metric) metrics.push(metric);
        }
        return {
          head: {
            // Segment kommt mit SEG-06, der nächste Termin mit QBR-01.
            segment: null,
            sro: await sroOf(tx, organization, relationshipId),
            nextMeeting: null,
          },
          metrics,
        };
      },
      { readOnly: true },
    );
  }
}
