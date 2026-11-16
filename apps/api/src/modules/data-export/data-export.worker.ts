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
import { type DataExportJob, DataExportService } from './data-export.service.js';

const queue = 'reziproq-data-export';

/**
 * QS-03: Der Gesamtexport läuft als Job (pg-boss), nicht in der Anfrage. In Tests gibt es keinen
 * Job; dort ruft der Test DataExportService.process selbst auf.
 */
@Injectable()
export class DataExportWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DataExportWorker.name);
  private boss: PgBoss | undefined;

  constructor(@Inject(DataExportService) private readonly exports: DataExportService) {}

  async onModuleInit(): Promise<void> {
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
    await boss.createQueue(queue, {
      expireInSeconds: 900,
      retryLimit: 1,
      retryDelay: 60,
    });
    await boss.work<DataExportJob>(queue, { batchSize: 1 }, async ([job]) => {
      if (job) await this.exports.process(job.data);
    });
    this.boss = boss;
  }

  async enqueue(job: DataExportJob): Promise<void> {
    await this.boss?.send(queue, job);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss?.stop();
  }
}
