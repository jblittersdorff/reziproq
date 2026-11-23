import { Injectable } from '@nestjs/common';
import type { PgBoss } from 'pg-boss';
import type { ProviderItem } from './fake-provider.js';

export const syncQueue = 'reziproq-integrations-sync';

/** Ein Abgleich im Hintergrund; bei Webhooks mit den Elementen, die angekommen sind */
export interface QueuedJob {
  orgId: string;
  jobId: string;
  items?: ProviderItem[];
}

/**
 * IN-01: Abgleiche laufen als Jobs (pg-boss, mit Wiederholung und Backoff). In Tests gibt es kein
 * pg-boss; dann läuft der Job im selben Prozess nach der Antwort, und drain() wartet auf ihn.
 */
@Injectable()
export class IntegrationQueue {
  handler: ((job: QueuedJob) => Promise<void>) | null = null;
  boss: PgBoss | null = null;
  private readonly pending = new Set<Promise<void>>();

  async send(job: QueuedJob): Promise<void> {
    if (this.boss) {
      await this.boss.send(syncQueue, job, { retryLimit: 3, retryDelay: 30, retryBackoff: true });
      return;
    }
    const run: Promise<void> = new Promise<void>((resolve) => setImmediate(resolve))
      .then(() => this.handler?.(job))
      .catch(() => undefined)
      .finally(() => this.pending.delete(run));
    this.pending.add(run);
  }

  /** Nur für Tests: wartet, bis alle Jobs im Prozess fertig sind. */
  async drain(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }
}
