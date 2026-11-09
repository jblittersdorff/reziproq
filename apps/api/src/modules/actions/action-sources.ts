import { Injectable } from '@nestjs/common';
import type { TenantTransaction } from '@reziproq/db';
import type { LiveSection, OverviewMetric } from '@reziproq/shared';
import type { AuthContext } from '../auth/auth.guard.js';
import type { MeetingLiveSource } from '../meetings/live-sections.js';
import type { OverviewMetricSource } from '../overview/overview-metric.js';
import { countOpenActions, openActionsOf } from './action-rows.js';

/** Kennzahl-Quelle (QBR-03): offene und überfällige Maßnahmen im Überblick. */
@Injectable()
export class ActionsMetricSource implements OverviewMetricSource {
  async overviewMetric(
    relationshipId: string,
    _user: AuthContext,
    tx: TenantTransaction,
  ): Promise<OverviewMetric | null> {
    const counts = await countOpenActions(tx, relationshipId);
    // Nichts offen heißt: keine Kennzahl, der Überblick zeigt den Satz der Seite.
    if (counts.open === 0) return null;
    return { tile: 'execution', kind: 'actions', ...counts };
  }
}

/** Live-Abschnitt im Termin (QBR-01b, QBR-03): offene Maßnahmen, aus ihrem Ort gelesen. */
export class ActionsLiveSource implements MeetingLiveSource {
  readonly key = 'actions';
  async read(tx: TenantTransaction, relationshipId: string): Promise<LiveSection | null> {
    const rows = await openActionsOf(tx, relationshipId);
    return {
      key: this.key,
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        dueDate: row.dueDate,
      })),
    };
  }
}
