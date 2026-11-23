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
import { ScorecardService } from './scorecard.service.js';

const queue = 'reziproq-category-reviews';

/** WG-12: täglich um 06:30 die fälligen Quartals-Reviews je freigegebener Strategie anlegen */
@Injectable()
export class ScorecardWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ScorecardWorker.name);
  private boss: PgBoss | undefined;

  constructor(
    @Inject(ScorecardService) private readonly scorecard: ScorecardService,
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
    await boss.createQueue(queue, { expireInSeconds: 600, retryLimit: 2, retryDelay: 60 });
    await boss.work(queue, { batchSize: 1 }, async () => {
      for (const customer of await this.accounts.customers())
        await this.scorecard.createDueReviews(customer.id);
    });
    await boss.schedule(queue, '30 6 * * *', {}, { tz: 'Europe/Berlin' });
    this.boss = boss;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss?.stop();
  }
}
