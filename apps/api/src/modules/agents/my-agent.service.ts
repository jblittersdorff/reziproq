import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, currentTime, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  type Adoption,
  liveWorkers,
  type MyAgent,
  type MyAgentTask,
  myAgentSchema,
  orgWorkerState,
  resolveLevel,
  selectableLevels,
  type Worker,
  type WorkerLevel,
  workerByKey,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { readAiSettings } from '../ai-gateway/ai-settings.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { berlinDate, berlinTime } from '../today/berlin.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

/** Übernahmequote über die letzten acht Wochen (MA-01, Daten) */
const adoptionDays = 56;

/** Montag 00:00 in Berlin nach der Uhr des Mandanten */
export function weekStart(now: Date = currentTime()): Date {
  const today = new Date(`${berlinDate(now)}T12:00:00Z`);
  const sinceMonday = (today.getUTCDay() + 6) % 7;
  today.setUTCDate(today.getUTCDate() - sinceMonday);
  return berlinTime(today.toISOString().slice(0, 10), 0);
}

const none: Adoption = { unchanged: 0, decided: 0 };
const sum = (values: Adoption[]): Adoption =>
  values.reduce(
    (total, value) => ({
      unchanged: total.unchanged + value.unchanged,
      decided: total.decided + value.decided,
    }),
    none,
  );

/**
 * Mein Agent (MA-01, K1-f): je Aufgabe, die es heute gibt, die Stufe der Person, was sie wählen kann
 * und wie oft sie Entwürfe dieser Aufgabe unverändert übernommen hat. Die Stufe gilt nur für die
 * Person selbst; Obergrenze und An oder Aus legen Admins in den KI-Einstellungen fest.
 */
@Injectable()
export class MyAgentService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private session(auth: AuthContext) {
    // Nur Käufer: Stufen für die Lieferantenseite kommen mit LP-01 (MA-01, Nicht Teil)
    if (!auth.organization?.buyer) throw forbidden();
    return { userId: auth.userId, organizationId: auth.organization.id };
  }

  async view(auth: AuthContext): Promise<MyAgent> {
    const session = this.session(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        const now = currentTime();
        const since = weekStart(now);
        const adoptionSince = new Date(now.getTime() - adoptionDays * 86_400_000);
        const tasks = await this.tasks(tx, session, adoptionSince);
        const [done] = (
          await tx.execute<{ count: number }>(sql`
            select count(*)::int as count from agent_run
            where org_id = ${session.organizationId} and acting_user_id = ${session.userId}
              and not is_test and undo_payload is not null and undone_at is null
              and created_at >= ${since}`)
        ).rows;
        const [prepared] = (
          await tx.execute<{ count: number }>(sql`
            select
              (select count(*) from ai_draft
                where org_id = ${session.organizationId} and created_by = ${session.userId}
                  and created_at >= ${since})
              + (select count(*) from inbound_item
                where org_id = ${session.organizationId} and status = 'needs_review'
                  and (owner_user_id = ${session.userId} or assignee_user_id = ${session.userId})
                  and received_at >= ${since})
              as count`)
        ).rows;
        return myAgentSchema.parse({
          week: {
            since: since.toISOString(),
            done: Number(done?.count ?? 0),
            prepared: Number(prepared?.count ?? 0),
          },
          adoption: sum(tasks.flatMap((task) => (task.adoption ? [task.adoption] : []))),
          tasks,
          canEdit: can(auth, 'mein_agent.einstellen'),
          canManage: can(auth, 'einstellungen.verwalten'),
        });
      },
      { readOnly: true },
    );
  }

  /** Eigene Stufe für eine Aufgabe; nur erlaubte, heute wirksame Stufen unter der Obergrenze */
  async setLevel(auth: AuthContext, key: string, level: WorkerLevel): Promise<MyAgentTask> {
    const session = this.session(auth);
    if (!can(auth, 'mein_agent.einstellen')) throw forbidden();
    const worker = workerByKey(key);
    if (!worker || worker.liveLevels.length === 0) throw notFound();
    return this.tenant.run(session, async (tx) => {
      const settings = await readAiSettings(tx, session.organizationId);
      const state = orgWorkerState(settings.workers, worker);
      if (!selectableLevels(worker, state.cap).includes(level)) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'stufe_nicht_waehlbar',
          message: 'Diese Stufe ist für diese Aufgabe nicht wählbar.',
        });
      }
      await tx
        .insert(schema.workerSetting)
        .values({ orgId: session.organizationId, userId: session.userId, agentKey: key, level })
        .onConflictDoUpdate({
          target: [
            schema.workerSetting.orgId,
            schema.workerSetting.userId,
            schema.workerSetting.agentKey,
          ],
          set: { level, updatedAt: sql`app_now()` },
        });
      const adoptionSince = new Date(currentTime().getTime() - adoptionDays * 86_400_000);
      const [task] = (await this.tasks(tx, session, adoptionSince)).filter(
        (entry) => entry.key === key,
      );
      if (!task) throw notFound();
      return task;
    });
  }

  private async tasks(
    tx: TenantTransaction,
    session: { userId: string; organizationId: string },
    adoptionSince: Date,
  ): Promise<MyAgentTask[]> {
    const settings = await readAiSettings(tx, session.organizationId);
    const chosen = new Map(
      (
        await tx
          .select({ key: schema.workerSetting.agentKey, level: schema.workerSetting.level })
          .from(schema.workerSetting)
          .where(
            and(
              eq(schema.workerSetting.orgId, session.organizationId),
              eq(schema.workerSetting.userId, session.userId),
            ),
          )
      ).map((row) => [row.key, row.level] as const),
    );
    const drafts = (
      await tx.execute<{ kind: string; unchanged: number; decided: number }>(sql`
      select kind,
        count(*) filter (where status = 'accepted' and not edited)::int as unchanged,
        count(*)::int as decided
      from ai_draft
      where org_id = ${session.organizationId} and decided_by = ${session.userId}
        and status in ('accepted', 'discarded') and decided_at >= ${adoptionSince}
      group by kind`)
    ).rows;
    const byKind = new Map(drafts.map((row) => [row.kind, row]));
    const inbox = await this.inboxAdoption(tx, session, adoptionSince);

    const adoptionOf = (worker: Worker): Adoption | null => {
      if (worker.key === 'inbox') return inbox;
      if (!worker.draftKinds) return null;
      return sum(
        worker.draftKinds.map((kind) => {
          const row = byKind.get(kind);
          return row ? { unchanged: Number(row.unchanged), decided: Number(row.decided) } : none;
        }),
      );
    };

    return liveWorkers.map((worker) => {
      const state = orgWorkerState(settings.workers, worker);
      const personal = chosen.get(worker.key) ?? null;
      return {
        key: worker.key,
        allowedLevels: [...worker.allowedLevels],
        selectable: selectableLevels(worker, state.cap),
        defaultLevel: worker.defaultLevel,
        chosen: personal,
        level: resolveLevel(worker, { personal, enabled: state.enabled, orgCap: state.cap }),
        enabled: state.enabled,
        cap: state.cap,
        adoption: adoptionOf(worker),
      };
    });
  }

  /**
   * Postfach: Zuordnungen der letzten acht Wochen. Unverändert ist, was Reziproq selbst zugeordnet
   * hat und so blieb, und ein übernommener Vorschlag (Termin bei der vorgeschlagenen Beziehung).
   */
  private async inboxAdoption(
    tx: TenantTransaction,
    session: { userId: string; organizationId: string },
    since: Date,
  ): Promise<Adoption> {
    const [row] = (
      await tx.execute<{ unchanged: number; decided: number }>(sql`
      select
        count(*) filter (where i.status = 'auto_assigned' or (i.status = 'assigned'
          and i.suggestion_kind = 'supplier' and exists (
            select 1 from meeting m
            where m.owner_org_id = i.org_id and m.id::text = i.object_ids->>0
              and m.relationship_id::text = i.suggested_relationship_ids->>0)))::int as unchanged,
        count(*)::int as decided
      from inbound_item i
      where i.org_id = ${session.organizationId}
        and (i.owner_user_id = ${session.userId} or i.assignee_user_id = ${session.userId})
        and i.status in ('auto_assigned', 'assigned', 'ignored')
        and coalesce(i.assigned_at, i.received_at) >= ${since}`)
    ).rows;
    return { unchanged: Number(row?.unchanged ?? 0), decided: Number(row?.decided ?? 0) };
  }
}
