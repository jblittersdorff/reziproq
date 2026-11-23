import { Injectable } from '@nestjs/common';
import type { PgBoss } from 'pg-boss';

export const importApiQueue = 'reziproq-import-api';

export interface DeliveryJob {
  orgId: string;
  batchId: string;
}

/**
 * IN-07: Lieferungen der Import-API werden im Job verarbeitet (pg-boss, mit Wiederholung). In Tests
 * gibt es kein pg-boss; der Job läuft im Prozess nach der Antwort, drain() wartet auf ihn.
 */
@Injectable()
export class ImportApiQueue {
  handler: ((job: DeliveryJob) => Promise<void>) | null = null;
  boss: PgBoss | null = null;
  private readonly pending = new Set<Promise<void>>();

  async send(job: DeliveryJob): Promise<void> {
    if (this.boss) {
      await this.boss.send(importApiQueue, job, { retryLimit: 3, retryDelay: 30, retryBackoff: true });
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
