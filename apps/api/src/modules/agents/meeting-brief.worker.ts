import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { currentTime, jobsDatabaseUrl, sql } from '@reziproq/db';
import type { MeetingType } from '@reziproq/shared';
import { PgBoss } from 'pg-boss';
import { AccountStore, ActionDueStore, TenantDatabase } from '../../common/database.module.js';
import { inOrgClock } from '../../common/org-clock.js';
import { env } from '../../config/env.js';
import { ActionsService } from '../actions/actions.service.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { MeetingBriefService } from '../meetings/meeting-brief.service.js';
import { AgentsService } from './agents.service.js';

const queue = 'reziproq-meeting-brief';
const systemUser = 'system:meeting-brief';

const typeNames: Record<MeetingType, string> = {
  quarterly_review: 'QBR',
  strategy_dialogue: 'Strategiedialog',
  jbp: 'JBP',
  negotiation: 'Verhandlung',
  site_visit: 'Werksbesuch',
  escalation: 'Eskalation',
  format: 'Termin',
  other: 'Termin',
};

const berlinDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' });
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** KI-17: Aufgabe einen Tag nach dem Termin, solange keine Notizen da sind */
export const captureTaskTitle = 'Ergebnisse erfassen';

/** Titel der Aufgabe für den SRO, die Mein Tag zeigt */
export const briefTaskTitle = (type: MeetingType) =>
  `${typeNames[type]} vorbereiten: Briefing prüfen`;

/**
 * KI-07: Alle 15 Minuten prüft der Job geplante Termine nach Typ und Vorlauf. Liegt ein Termin im
 * Vorlauf, startet ein Lauf im Namen des SRO, sofort auch bei Eskalationen und bei Terminen, die mit
 * kürzerem Restvorlauf angelegt wurden (auch aus Outlook). Wird ein Termin verschoben oder ändert
 * sich die Teilnehmerliste, läuft der Agent erneut. Dazu eine interne Aufgabe für den SRO.
 * In Tests gibt es keinen Zeitplan; runDue wird direkt gerufen.
 */
@Injectable()
export class MeetingBriefWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MeetingBriefWorker.name);
  private boss: PgBoss | undefined;

  constructor(
    @Inject(ActionDueStore) private readonly store: ActionDueStore,
    @Inject(AccountStore) private readonly accounts: AccountStore,
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(AgentsService) private readonly agents: AgentsService,
    @Inject(ActionsService) private readonly actions: ActionsService,
    @Inject(MeetingBriefService) private readonly brief: MeetingBriefService,
  ) {}

  /** Geplante Termine im Vorlauf ihres Typs, je mit dem SRO der Beziehung */
  private targets(orgId: string, now: Date) {
    return this.tenant.run(
      { userId: systemUser, organizationId: orgId },
      async (tx) => {
        const leadDays = await this.brief.leadDaysIn(tx, orgId);
        const rows = (
          await tx.execute<{
            meeting_id: string;
            relationship_id: string;
            type: MeetingType;
            starts_at: string;
            user_id: string;
          }>(sql`
            select m.id as meeting_id, m.relationship_id, m.type, m.starts_at::text, min(rm.user_id) as user_id
            from meeting m
            join relationship r on r.id = m.relationship_id and r.buyer_org_id = ${orgId}
            join relationship_member rm
              on rm.relationship_id = m.relationship_id and rm.org_id = ${orgId} and rm.team_role = 'sro'
            where m.status = 'planned' and m.brief_opt_in and m.starts_at > ${now.toISOString()}::timestamptz
            group by m.id, m.relationship_id, m.type, m.starts_at
            order by m.starts_at`)
        ).rows;
        const today = berlinDay.format(now);
        return rows.filter((row) => {
          const lead = leadDays[row.type];
          if (lead === null || lead === undefined) return false;
          return daysBetween(today, berlinDay.format(new Date(row.starts_at))) <= lead;
        });
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

  /** Ein Durchlauf; organizationIds und now nur für Tests. Liefert die Zahl gestarteter Läufe. */
  async runDue(organizationIds?: string[], now?: Date): Promise<number> {
    const organizations = organizationIds ?? (await this.store.hintOrganizations());
    let started = 0;
    for (const orgId of organizations) {
      // DM-01 (K1-b.4): je Mandant dessen Uhr, im Demo-Mandanten die Demo-Uhr
      started += await inOrgClock(this.accounts, orgId, async () => {
        const at = now ?? currentTime();
        let count = 0;
        for (const entry of await this.targets(orgId, at)) {
          const auth = await this.actor(entry.user_id, orgId);
          if (!auth) continue;
          try {
            const runId = await this.agents.startScheduled(auth, {
              relationshipId: entry.relationship_id,
              meetingId: entry.meeting_id,
            });
            if (!runId) continue;
            await this.task(auth, entry.relationship_id, entry.meeting_id, entry.type, at);
            count += 1;
          } catch (error) {
            this.logger.warn(
              `Termin-Briefing ${entry.meeting_id}: ${error instanceof Error ? error.message : 'Fehler'}`,
            );
          }
        }
        return count;
      });
    }
    return started;
  }

  /**
   * KI-17: Einen Tag nach dem Termin bekommt der SRO die Aufgabe „Ergebnisse erfassen“, falls noch
   * keine Notizen da sind. Höchstens zwei Wochen zurück, genau eine Aufgabe je Termin.
   */
  async captureDue(organizationIds?: string[], now?: Date): Promise<number> {
    const organizations = organizationIds ?? (await this.store.hintOrganizations());
    let created = 0;
    for (const orgId of organizations) {
      // DM-01 (K1-b.4): je Mandant dessen Uhr
      created += await inOrgClock(this.accounts, orgId, () =>
        this.captureFor(orgId, now ?? currentTime()),
      );
    }
    return created;
  }

  private async captureFor(orgId: string, now: Date): Promise<number> {
    const dayBefore = new Date(now.getTime() - 86_400_000).toISOString();
    const twoWeeks = new Date(now.getTime() - 14 * 86_400_000).toISOString();
    let created = 0;
    const targets = await this.tenant.run(
      { userId: systemUser, organizationId: orgId },
      async (tx) =>
        (
          await tx.execute<{ meeting_id: string; relationship_id: string; user_id: string }>(sql`
            select m.id as meeting_id, m.relationship_id, min(rm.user_id) as user_id
            from meeting m
            join relationship r on r.id = m.relationship_id and r.buyer_org_id = ${orgId}
            join relationship_member rm
              on rm.relationship_id = m.relationship_id and rm.org_id = ${orgId} and rm.team_role = 'sro'
            where m.status <> 'closed'
              and m.starts_at <= ${dayBefore}::timestamptz and m.starts_at >= ${twoWeeks}::timestamptz
              and not exists (select 1 from meeting_capture c where c.meeting_id = m.id and c.org_id = ${orgId})
              and not exists (select 1 from action a where a.source_type = 'meeting' and a.source_id = m.id
                and a.title = ${captureTaskTitle})
            group by m.id, m.relationship_id`)
        ).rows,
      { readOnly: true },
    );
    for (const entry of targets) {
      const auth = await this.actor(entry.user_id, orgId);
      if (!auth) continue;
      await this.actions.buyer(auth, entry.relationship_id, (scope) =>
        this.actions.create(scope, {
          action: {
            title: captureTaskTitle,
            description: null,
            visibility: 'internal',
            ownerSide: 'buyer',
            ownerUserId: auth.userId,
            ownerName: null,
            dueDate: berlinDay.format(now),
          },
          sourceType: 'meeting',
          sourceId: entry.meeting_id,
        }),
      );
      created += 1;
    }
    return created;
  }

  /** Genau eine Aufgabe je Termin für den SRO */
  private async task(
    auth: AuthContext,
    relationshipId: string,
    meetingId: string,
    type: MeetingType,
    now: Date,
  ) {
    const title = briefTaskTitle(type);
    await this.actions.buyer(auth, relationshipId, async (scope) => {
      const [existing] = (
        await scope.tx.execute<{ id: string }>(sql`
          select id from action where relationship_id = ${relationshipId}
            and source_type = 'meeting' and source_id = ${meetingId} and title = ${title}`)
      ).rows;
      if (existing) return;
      await this.actions.create(scope, {
        action: {
          title,
          description: null,
          visibility: 'internal',
          ownerSide: 'buyer',
          ownerUserId: auth.userId,
          ownerName: null,
          dueDate: berlinDay.format(now),
        },
        sourceType: 'meeting',
        sourceId: meetingId,
      });
    });
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
    await boss.work(queue, { batchSize: 1 }, async () => {
      await this.runDue();
      await this.captureDue();
    });
    await boss.schedule(queue, '*/15 * * * *', {});
    this.boss = boss;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss?.stop();
  }
}
