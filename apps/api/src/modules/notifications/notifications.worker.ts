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
import { NotificationsService } from './notifications.service.js';

const digestQueue = 'reziproq-notification-digest';
const dueQueue = 'reziproq-notification-commitments';

/** IN-06: täglich 07:30 fällige Zusagen vormerken, 08:00 die Zusammenfassung des Tages senden */
@Injectable()
export class NotificationsWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(NotificationsWorker.name);
  private boss: PgBoss | undefined;

  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

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
    for (const queue of [digestQueue, dueQueue]) {
      await boss.createQueue(queue, {
        expireInSeconds: 600,
        retryLimit: 3,
        retryDelay: 60,
        retryBackoff: true,
      });
    }
    const each = async (work: (orgId: string) => Promise<number>) => {
      for (const orgId of await this.notifications.buyerOrganizations()) await work(orgId);
    };
    await boss.work(dueQueue, { batchSize: 1 }, () =>
      each((orgId) => this.notifications.runCommitmentsDue(orgId)),
    );
    await boss.schedule(dueQueue, '30 7 * * *', {}, { tz: 'Europe/Berlin' });
    await boss.work(digestQueue, { batchSize: 1 }, () =>
      each((orgId) => this.notifications.runDigest(orgId)),
    );
    await boss.schedule(digestQueue, '0 8 * * *', {}, { tz: 'Europe/Berlin' });
    this.boss = boss;
    this.logger.log('Benachrichtigungen: Zusagen 07:30, Zusammenfassung 08:00 (Europe/Berlin).');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss?.stop();
  }
}
