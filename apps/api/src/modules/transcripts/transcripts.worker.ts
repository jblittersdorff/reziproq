import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { jobsDatabaseUrl } from '@reziproq/db';
import { PgBoss } from 'pg-boss';
import { AccountStore } from '../../common/database.module.js';
import { env } from '../../config/env.js';
import { TranscriptsService } from './transcripts.service.js';

const pollQueue = 'reziproq-transcripts-poll';
const expireQueue = 'reziproq-transcripts-expire';
const remindQueue = 'reziproq-transcripts-remind';

/** IN-05: Abruf alle 15 Minuten, Erinnerung alle 5 Minuten, Löschen nach Aufbewahrung täglich */
@Injectable()
export class TranscriptsWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(TranscriptsWorker.name);
  private boss: PgBoss | undefined;

  constructor(
    @Inject(TranscriptsService) private readonly transcripts: TranscriptsService,
    @Inject(AccountStore) private readonly accounts: AccountStore,
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
    const each = async (work: (orgId: string) => Promise<number>) => {
      for (const customer of await this.accounts.customers()) await work(customer.id);
    };
    for (const [queue, cron, work] of [
      [pollQueue, '*/15 * * * *', (orgId: string) => this.transcripts.poll(orgId)],
      [remindQueue, '*/5 * * * *', (orgId: string) => this.transcripts.remind(orgId)],
      [expireQueue, '30 3 * * *', (orgId: string) => this.transcripts.expire(orgId)],
    ] as const) {
      await boss.createQueue(queue, {
        expireInSeconds: 600,
        retryLimit: 3,
        retryDelay: 60,
        retryBackoff: true,
      });
      await boss.work(queue, { batchSize: 1 }, () => each(work));
      await boss.schedule(queue, cron, {}, { tz: 'Europe/Berlin' });
    }
    this.boss = boss;
    this.logger.log(
      'Transkripte: Abruf alle 15 Minuten, Erinnerung alle 5 Minuten, Löschen täglich.',
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss?.stop();
  }
}
