import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { jobsDatabaseUrl } from '@reziproq/db';
import { PgBoss } from 'pg-boss';
import { AgentEventBus } from '../../common/agent-events.js';
import { AccountStore } from '../../common/database.module.js';
import { env } from '../../config/env.js';
import { CustomAgentsService } from './custom-agents.service.js';

const tickQueue = 'reziproq-custom-agents-tick';
const dailyQueue = 'reziproq-custom-agents-daily';

/** KI-09: Zeitpläne alle 15 Minuten, tägliche Ereignisse um 07:00; Ereignisse der Fachbereiche sofort */
@Injectable()
export class CustomAgentsWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(CustomAgentsWorker.name);
  private boss: PgBoss | undefined;

  constructor(
    @Inject(CustomAgentsService) private readonly agents: CustomAgentsService,
    @Inject(AccountStore) private readonly accounts: AccountStore,
    @Inject(AgentEventBus) private readonly events: AgentEventBus,
  ) {}

  async onModuleInit(): Promise<void> {
    this.events.listen((orgId, event, relationshipId) =>
      this.agents.onEvent(orgId, event, relationshipId),
    );
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
      [tickQueue, '*/15 * * * *', (orgId: string) => this.agents.tick(orgId)],
      [dailyQueue, '0 7 * * *', (orgId: string) => this.agents.dailyEvents(orgId)],
    ] as const) {
      await boss.createQueue(queue, { expireInSeconds: 600, retryLimit: 2, retryDelay: 60 });
      await boss.work(queue, { batchSize: 1 }, () => each(work));
      await boss.schedule(queue, cron, {}, { tz: 'Europe/Berlin' });
    }
    this.boss = boss;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss?.stop();
  }
}
