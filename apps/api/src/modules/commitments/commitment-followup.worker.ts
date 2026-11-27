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
import { CommitmentFollowupService } from './commitment-followup.service.js';

const queue = 'reziproq-commitment-followup';

/**
 * ZQ-01 Regel 5 (K2-b.6): täglich um 06:00 in Berlin „Zusagen nachhalten“ für alle Käufer mit aktiven
 * Beziehungen, ohne Demo-Mandanten (E-K2-11; deren Lauf startet die Regie). In Tests gibt es keinen
 * Job.
 */
@Injectable()
export class CommitmentFollowupWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(CommitmentFollowupWorker.name);
  private boss: PgBoss | undefined;

  constructor(
    @Inject(CommitmentFollowupService) private readonly followup: CommitmentFollowupService,
  ) {}

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
      retryLimit: 3,
      retryDelay: 60,
      retryBackoff: true,
    });
    await boss.work(queue, { batchSize: 1 }, () => this.followup.runDaily());
    await boss.schedule(queue, '0 6 * * *', {}, { tz: 'Europe/Berlin' });
    this.boss = boss;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss?.stop();
  }
}
