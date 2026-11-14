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
import { ActionReminderService } from './action-reminder.service.js';
import { CycleReminderService } from './cycle-reminder.service.js';
import { EmailProcessor } from './email-processor.js';

const queue = 'reziproq-email-outbox';
const reminderQueue = 'reziproq-cycle-reminders';
const actionQueue = 'reziproq-action-reminders';

@Injectable()
export class EmailWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(EmailWorker.name);
  private boss: PgBoss | undefined;

  constructor(
    @Inject(EmailProcessor) private readonly processor: EmailProcessor,
    @Inject(CycleReminderService) private readonly reminders: CycleReminderService,
    @Inject(ActionReminderService) private readonly actions: ActionReminderService,
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
      expireInSeconds: 120,
      retryLimit: 3,
      retryDelay: 10,
      retryBackoff: true,
    });
    await boss.work(queue, { batchSize: 1 }, () => this.processor.processPending());
    await boss.schedule(queue, '* * * * *', {});
    await boss.send(queue, {});
    await boss.createQueue(reminderQueue, {
      expireInSeconds: 600,
      retryLimit: 3,
      retryDelay: 60,
      retryBackoff: true,
    });
    await boss.work(reminderQueue, { batchSize: 1 }, () => this.reminders.runDaily());
    await boss.schedule(reminderQueue, '0 7 * * *', {});
    // QBR-04: Erinnerung und Eskalation von Maßnahmen, täglich.
    await boss.createQueue(actionQueue, {
      expireInSeconds: 600,
      retryLimit: 3,
      retryDelay: 60,
      retryBackoff: true,
    });
    await boss.work(actionQueue, { batchSize: 1 }, () => this.actions.runDaily());
    await boss.schedule(actionQueue, '15 7 * * *', {});
    this.boss = boss;
    this.logger.log('E-Mail-Outbox-, Zyklus- und Maßnahmen-Erinnerungsjobs sind gestartet.');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss?.stop();
  }
}
