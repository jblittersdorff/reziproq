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
import { MergeService } from './merge.service.js';

const queue = 'reziproq-category-conflicts';

/** WG-20: täglich um 06:00 (mit den Hinweisen aus FS-01) die Widersprüche je Lieferant abgleichen */
@Injectable()
export class MergeWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MergeWorker.name);
  private boss: PgBoss | undefined;

  constructor(
    @Inject(MergeService) private readonly merge: MergeService,
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
        await this.merge.syncOrganization(customer.id);
    });
    await boss.schedule(queue, '0 6 * * *', {}, { tz: 'Europe/Berlin' });
    this.boss = boss;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss?.stop();
  }
}
