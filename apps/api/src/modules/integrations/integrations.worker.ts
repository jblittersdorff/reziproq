import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { jobsDatabaseUrl } from '@reziproq/db';
import { PgBoss } from 'pg-boss';
import { env } from '../../config/env.js';
import { IntegrationQueue, type QueuedJob, syncQueue } from './integration-queue.js';
import { IntegrationsService } from './integrations.service.js';

const refreshQueue = 'reziproq-integrations-refresh';

/**
 * IN-01: Abgleiche und Webhooks laufen als Jobs mit Wiederholung und Backoff; alle zehn Minuten
 * erneuert ein Job Zugangsdaten vor Ablauf, je Kunde in dessen Mandanten-Session. In Tests gibt
 * es kein pg-boss; die Warteschlange läuft dann im Prozess.
 */
@Injectable()
export class IntegrationsWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(IntegrationsWorker.name);
  private boss: PgBoss | undefined;

  constructor(
    @Inject(IntegrationQueue) private readonly queue: IntegrationQueue,
    @Inject(IntegrationsService) private readonly integrations: IntegrationsService,
  ) {}

  async refreshAll(): Promise<number> {
    let renewed = 0;
    for (const orgId of await this.integrations.organizations()) {
      renewed += await this.integrations.refreshDue(orgId);
    }
    return renewed;
  }

  async onModuleInit(): Promise<void> {
    this.queue.handler = (job) => this.integrations.runJob(job);
    if (env.NODE_ENV === 'test') return;
    const boss = new PgBoss({
      connectionString: jobsDatabaseUrl(),
      schema: 'pgboss',
      createSchema: false,
    });
    boss.on('error', (error) => {
      this.logger.error(error instanceof Error ? error.message : 'Unbekannter pg-boss-Fehler');
    });
    await boss.start();
    await boss.createQueue(syncQueue, {
      expireInSeconds: 900,
      retryLimit: 3,
      retryDelay: 30,
      retryBackoff: true,
    });
    await boss.createQueue(refreshQueue, { expireInSeconds: 300, retryLimit: 1 });
    await boss.work<QueuedJob>(syncQueue, { batchSize: 1 }, async ([job]) => {
      if (job) await this.integrations.runJob(job.data);
    });
    await boss.work(refreshQueue, { batchSize: 1 }, () => this.refreshAll());
    await boss.schedule(refreshQueue, '*/10 * * * *', {});
    this.queue.boss = boss;
    this.boss = boss;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss?.stop();
  }
}
