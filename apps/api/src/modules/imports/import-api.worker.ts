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
import { type DeliveryJob, ImportApiQueue, importApiQueue } from './import-api.queue.js';
import { ImportApiService } from './import-api.service.js';

/** IN-07: verarbeitet Lieferungen der Import-API im Job; in Tests im Prozess. */
@Injectable()
export class ImportApiWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ImportApiWorker.name);
  private boss: PgBoss | undefined;

  constructor(
    @Inject(ImportApiQueue) private readonly queue: ImportApiQueue,
    @Inject(ImportApiService) private readonly api: ImportApiService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queue.handler = (job) => this.api.runDelivery(job);
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
    await boss.createQueue(importApiQueue, {
      expireInSeconds: 1800,
      retryLimit: 3,
      retryDelay: 30,
      retryBackoff: true,
    });
    await boss.work<DeliveryJob>(importApiQueue, { batchSize: 1 }, async ([job]) => {
      if (job) await this.api.runDelivery(job.data);
    });
    this.queue.boss = boss;
    this.boss = boss;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss?.stop();
  }
}
