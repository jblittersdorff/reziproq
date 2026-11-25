import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { jobsDatabaseUrl, sql } from '@reziproq/db';
import { PgBoss } from 'pg-boss';
import { AccountStore, ActionDueStore, TenantDatabase } from '../../common/database.module.js';
import { inOrgClock } from '../../common/org-clock.js';
import { env } from '../../config/env.js';
import { readAiSettings } from '../ai-gateway/ai-settings.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { OpportunitiesService } from './opportunities.service.js';

const queue = 'reziproq-value-finder';
const systemUser = 'system:value-finder';

/**
 * KI-11: Monatlich läuft der Wertpotenzial-Finder je Käufer für die Fokuslieferanten und die
 * Segmente, die der Admin gewählt hat (Einstellungen KI). Jeder Lauf handelt im Namen des SRO der
 * Beziehung; ohne SRO entfällt er. In Tests gibt es keinen Zeitplan, runMonthly wird direkt gerufen.
 */
@Injectable()
export class OpportunitiesWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OpportunitiesWorker.name);
  private boss: PgBoss | undefined;

  constructor(
    @Inject(ActionDueStore) private readonly store: ActionDueStore,
    @Inject(AccountStore) private readonly accounts: AccountStore,
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(OpportunitiesService) private readonly opportunities: OpportunitiesService,
  ) {}

  /** Beziehungen eines Käufers für den Monatslauf, mit ihrem SRO */
  private async targets(orgId: string) {
    return this.tenant.run(
      { userId: systemUser, organizationId: orgId },
      async (tx) => {
        const segments = (await readAiSettings(tx, orgId)).valueFinderSegments;
        const rows = await tx.execute<{ relationship_id: string; user_id: string }>(sql`
          select r.id as relationship_id, min(m.user_id) as user_id
          from relationship r
          join relationship_member m
            on m.relationship_id = r.id and m.org_id = ${orgId} and m.team_role = 'sro'
          left join relationship_side s on s.relationship_id = r.id and s.org_id = ${orgId}
          where r.buyer_org_id = ${orgId} and r.status <> 'ended'
            and (
              coalesce(s.is_focus, false)
              or (
                select sd.ist_impact_level || '-' || sd.ist_quality_level
                from segment_decision sd
                where sd.relationship_id = r.id and sd.scope = 'total'
                order by sd.version desc limit 1
              ) in (select jsonb_array_elements_text(${JSON.stringify(segments)}::jsonb))
            )
          group by r.id`);
        return rows.rows;
      },
      { readOnly: true },
    );
  }

  private async actor(userId: string, orgId: string): Promise<AuthContext | null> {
    const account = await this.accounts.membershipOf(userId);
    if (!account?.organization.buyer || account.organization.id !== orgId) return null;
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

  /** Ein Monatslauf; organizationIds nur für Tests, sonst alle Käufer. */
  async runMonthly(organizationIds?: string[]): Promise<number> {
    const organizations = organizationIds ?? (await this.store.hintOrganizations());
    let runs = 0;
    for (const orgId of organizations) {
      // DM-01 (K1-b.4): je Mandant dessen Uhr, im Demo-Mandanten die Demo-Uhr
      runs += await inOrgClock(this.accounts, orgId, async () => {
        let count = 0;
        for (const target of await this.targets(orgId)) {
          const auth = await this.actor(target.user_id, orgId);
          if (!auth) continue;
          try {
            await this.opportunities.run(auth, target.relationship_id, 'schedule');
            count += 1;
          } catch (error) {
            this.logger.warn(
              `Monatslauf ${target.relationship_id}: ${error instanceof Error ? error.message : 'Fehler'}`,
            );
          }
        }
        return count;
      });
    }
    return runs;
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
    await boss.createQueue(queue, { expireInSeconds: 3600, retryLimit: 1, retryDelay: 600 });
    await boss.work(queue, { batchSize: 1 }, () => this.runMonthly());
    // Am Ersten jedes Monats um 4 Uhr
    await boss.schedule(queue, '0 4 1 * *', {});
    this.boss = boss;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss?.stop();
  }
}
