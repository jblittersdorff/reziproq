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
import { ApprovalService } from './approval.service.js';

const queue = 'reziproq-category-next-year';

/** WG-16: täglich um 05:30 zum Jahreswechsel je freigegebener Strategie des Vorjahrs einen Entwurf anlegen */
@Injectable()
export class StrategyYearWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(StrategyYearWorker.name);
  private boss: PgBoss | undefined;

  constructor(
    @Inject(ApprovalService) private readonly approvals: ApprovalService,
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
        await this.approvals.createNextYearDrafts(customer.id);
    });
    await boss.schedule(queue, '30 5 * * *', {}, { tz: 'Europe/Berlin' });
    this.boss = boss;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss?.stop();
  }
}
