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
import { type AgentJob, AgentRunner } from './agent-runner.js';

const queue = 'reziproq-agent-run';

@Injectable()
export class AgentsWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(AgentsWorker.name);
  private boss?: PgBoss;

  constructor(@Inject(AgentRunner) private readonly runner: AgentRunner) {}

  async onModuleInit() {
    if (env.NODE_ENV === 'test') return;
    const boss = new PgBoss({
      connectionString: jobsDatabaseUrl(),
      schema: 'pgboss',
      createSchema: false,
    });
    boss.on('error', () => this.logger.error('Die Agenten-Warteschlange meldet einen Fehler.'));
    await boss.start();
    await boss.createQueue(queue, { expireInSeconds: 300, retryLimit: 2, retryDelay: 15 });
    await boss.work<AgentJob>(queue, { batchSize: 1 }, async ([job]) => {
      if (job) await this.runner.process(job.data);
    });
    this.boss = boss;
  }

  async enqueue(job: AgentJob) {
    await this.boss?.send(queue, job, { id: job.ticket });
  }

  async onApplicationShutdown() {
    await this.boss?.stop();
  }
}
