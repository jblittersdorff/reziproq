import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { currentTime, eq, jobsDatabaseUrl, schema, withDemoClock } from '@reziproq/db';
import { PgBoss } from 'pg-boss';
import { AccountStore, ActionDueStore, TenantDatabase } from '../../common/database.module.js';
import { env } from '../../config/env.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { berlinHour } from './berlin.js';
import { TriageService } from './triage.service.js';

const queue = 'reziproq-triage';
const systemUser = 'system:triage';

/**
 * HE-01 Dienst 1: Die Triage läuft täglich um 06:00 nach der Uhr je Mandant (DM-01), je Person der
 * Käuferseite mit ihren Rechten. Der Job tickt stündlich und nimmt je Mandant die Stunde ab 06:00
 * seiner Uhr; ein Demo-Mandant mit Uhr vor 06:00 wartet. Zwischendurch läuft die Triage bei jedem
 * Aufruf von Heute. In Tests gibt es keinen Job.
 */
@Injectable()
export class TriageWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(TriageWorker.name);
  private boss: PgBoss | undefined;

  constructor(
    @Inject(ActionDueStore) private readonly store: ActionDueStore,
    @Inject(AccountStore) private readonly accounts: AccountStore,
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(TriageService) private readonly triage: TriageService,
  ) {}

  private async actor(userId: string, orgId: string): Promise<AuthContext | null> {
    const account = await this.accounts.membershipOf(userId);
    if (!account?.organization.buyer || account.organization.id !== orgId) return null;
    if (account.approvalPending) return null;
    return {
      userId,
      organization: account.organization,
      orgRole: account.orgRole,
      isControlling: account.isControlling,
      isOperator: false,
      accessToken: '',
      tokenRoles: [],
    };
  }

  /** Ein Durchlauf; organizationIds nur für Tests. Liefert die Zahl der Personen mit Triage. */
  async runDue(organizationIds?: string[]): Promise<number> {
    const organizations = organizationIds ?? (await this.store.hintOrganizations());
    let people = 0;
    for (const orgId of organizations) {
      const demoNow = await this.accounts.demoNowOf(orgId);
      people += await withDemoClock(demoNow, async () => {
        if (berlinHour(currentTime()) !== 6) return 0;
        const users = await this.tenant.run(
          { userId: systemUser, organizationId: orgId },
          (tx) =>
            tx
              .select({ id: schema.appUser.id })
              .from(schema.appUser)
              .where(eq(schema.appUser.organizationId, orgId)),
          { readOnly: true },
        );
        let count = 0;
        for (const user of users) {
          const auth = await this.actor(user.id, orgId);
          if (!auth) continue;
          try {
            await this.triage.refresh(auth);
            count += 1;
          } catch (error) {
            this.logger.warn(
              `Triage ${orgId}: ${error instanceof Error ? error.message : 'Fehler'}`,
            );
          }
        }
        return count;
      });
    }
    return people;
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
      expireInSeconds: 1800,
      retryLimit: 2,
      retryDelay: 120,
      retryBackoff: true,
    });
    await boss.work(queue, { batchSize: 1 }, () => this.runDue());
    await boss.schedule(queue, '0 * * * *', {});
    this.boss = boss;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss?.stop();
  }
}
