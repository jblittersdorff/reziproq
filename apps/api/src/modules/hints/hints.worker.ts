import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { jobsDatabaseUrl } from '@reziproq/db';
import { PgBoss } from 'pg-boss';
import { ActionDueStore, TenantDatabase } from '../../common/database.module.js';
import { env } from '../../config/env.js';
import { HintsService } from './hints.service.js';

const queue = 'reziproq-hints';
const systemUser = 'system:hints';

/**
 * FS-01: Täglich prüft ein Job alle Regeln, je Käufer in dessen Mandanten-Session. Die Liste der
 * Käufer kommt aus app_hint_orgs (nur IDs). In Tests gibt es keinen Job.
 */
@Injectable()
export class HintsWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(HintsWorker.name);
  private boss: PgBoss | undefined;

  constructor(
    @Inject(ActionDueStore) private readonly store: ActionDueStore,
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(HintsService) private readonly hints: HintsService,
  ) {}

  /** Ein Durchlauf; organizationIds für die Demo-Regie (DM-01, K1-g) und Tests */
  async runDaily(organizationIds?: string[]): Promise<number> {
    const organizations = organizationIds ?? (await this.store.hintOrganizations());
    for (const orgId of organizations) {
      await this.tenant.run({ userId: systemUser, organizationId: orgId }, async (tx) => {
        await this.hints.refresh(tx, orgId);
        // KI-16: danach schreibt der Agent die Begründungen neuer und geänderter Hinweise
        await this.hints.explain(tx, orgId);
      });
    }
    return organizations.length;
  }

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
    await boss.work(queue, { batchSize: 1 }, () => this.runDaily());
    await boss.schedule(queue, '30 6 * * *', {});
    this.boss = boss;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss?.stop();
  }
}
