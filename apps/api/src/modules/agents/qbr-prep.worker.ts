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
import { env } from '../../config/env.js';
import { ActionsService } from '../actions/actions.service.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { AgentsService } from './agents.service.js';

const queue = 'reziproq-qbr-prep';
const systemUser = 'system:qbr-prep';

/**
 * KI-07: Täglich startet je QBR in sieben Tagen genau ein Lauf der QBR-Vorbereitung im Namen des
 * SRO, dazu eine interne Aufgabe für ihn, die Mein Tag zeigt. In Tests gibt es keinen Zeitplan;
 * runDaily wird direkt gerufen.
 */
@Injectable()
export class QbrPrepWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(QbrPrepWorker.name);
  private boss: PgBoss | undefined;

  constructor(
    @Inject(ActionDueStore) private readonly store: ActionDueStore,
    @Inject(AccountStore) private readonly accounts: AccountStore,
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(AgentsService) private readonly agents: AgentsService,
    @Inject(ActionsService) private readonly actions: ActionsService,
  ) {}

  private targets(orgId: string, day: string) {
    return this.tenant.run(
      { userId: systemUser, organizationId: orgId },
      async (tx) =>
        (
          await tx.execute<{ meeting_id: string; relationship_id: string; user_id: string }>(sql`
            select m.id as meeting_id, m.relationship_id, min(rm.user_id) as user_id
            from meeting m
            join relationship r on r.id = m.relationship_id and r.buyer_org_id = ${orgId}
            join relationship_member rm
              on rm.relationship_id = m.relationship_id and rm.org_id = ${orgId} and rm.team_role = 'sro'
            where m.type = 'quarterly_review' and m.status = 'planned'
              and (m.starts_at at time zone 'Europe/Berlin')::date = ${day}::date
            group by m.id, m.relationship_id`)
        ).rows,
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

  /** Ein Tageslauf; organizationIds und today nur für Tests. */
  async runDaily(organizationIds?: string[], today = new Date()): Promise<number> {
    const target = new Date(today);
    target.setUTCDate(target.getUTCDate() + 7);
    const day = target.toISOString().slice(0, 10);
    const organizations = organizationIds ?? (await this.store.hintOrganizations());
    let started = 0;
    for (const orgId of organizations) {
      for (const entry of await this.targets(orgId, day)) {
        const auth = await this.actor(entry.user_id, orgId);
        if (!auth) continue;
        try {
          const runId = await this.agents.startScheduled(auth, {
            relationshipId: entry.relationship_id,
            meetingId: entry.meeting_id,
          });
          if (!runId) continue;
          await this.actions.buyer(auth, entry.relationship_id, (scope) =>
            this.actions.create(scope, {
              action: {
                title: 'QBR vorbereiten: Entwürfe prüfen',
                description: null,
                visibility: 'internal',
                ownerSide: 'buyer',
                ownerUserId: auth.userId,
                ownerName: null,
                dueDate: day,
              },
              sourceType: 'meeting',
              sourceId: entry.meeting_id,
            }),
          );
          started += 1;
        } catch (error) {
          this.logger.warn(
            `QBR-Vorbereitung ${entry.meeting_id}: ${error instanceof Error ? error.message : 'Fehler'}`,
          );
        }
      }
    }
    return started;
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
    await boss.createQueue(queue, { expireInSeconds: 900, retryLimit: 2, retryDelay: 120 });
    await boss.work(queue, { batchSize: 1 }, () => this.runDaily());
    await boss.schedule(queue, '0 5 * * *', {});
    this.boss = boss;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss?.stop();
  }
}
