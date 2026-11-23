import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, or, schema, sql, type TenantTransaction } from '@reziproq/db';
import { type AgentRun, agentStepKeys, type StartAgent } from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { readAiSettings } from '../ai-gateway/ai-settings.js';
import { ModelGateway } from '../ai-gateway/model-gateway.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { MeetingBriefService } from '../meetings/meeting-brief.service.js';
import { type AgentJob, runCostCents } from './agent-runner.js';
import { AgentTools } from './agent-tools.js';
import { AgentsWorker } from './agents.worker.js';
import {
  qbrAnswerSchema,
  qbrContextSchema,
  meetingBrief,
  qbrQuestionSchema,
  resumable,
} from './system-agents.js';

const { agent, agentVersion, agentOrgState, agentRun, agentStep, appUser, aiDraft } = schema;
const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const conflict = (code: string) => new ConflictException({ statusCode: 409, code });
type RunRow = typeof agentRun.$inferSelect;

function viewRun(
  auth: AuthContext,
  row: { run: RunRow; name: string; version: number; person: string | null },
): AgentRun {
  const run = row.run;
  const isOwn = auth.userId === run.startedBy;
  return {
    id: run.id,
    agentName: row.name,
    version: row.version,
    status: run.status,
    isTest: run.isTest,
    isOwn,
    stepsUsed: run.stepsUsed,
    costCents: runCostCents(run.costMicrocents),
    createdAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    cancellationPending: run.cancelRequestedAt !== null && run.status === 'running',
    canResume: isOwn && resumable.has(run.status),
    startedBy: row.person,
  };
}

@Injectable()
export class AgentsService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(AgentsWorker) private readonly worker: AgentsWorker,
    @Inject(AgentTools) private readonly tools: AgentTools,
    @Inject(ModelGateway) private readonly gateway: ModelGateway,
    @Inject(MeetingBriefService) private readonly brief: MeetingBriefService,
  ) {}

  private scope(auth: AuthContext) {
    if (!auth.organization?.buyer || !can(auth, 'lieferanten.sehen') || auth.supportOrganization)
      throw forbidden();
    return { userId: auth.userId, organizationId: auth.organization.id };
  }

  private async builtin(tx: TenantTransaction, orgId: string) {
    const template = meetingBrief;
    await tx
      .insert(agent)
      .values({
        orgId,
        key: template.key,
        name: template.name,
        description: template.description,
        kind: 'system',
        status: 'active',
      })
      .onConflictDoNothing({ target: [agent.orgId, agent.key] });
    const [instance] = await tx
      .select()
      .from(agent)
      .where(and(eq(agent.orgId, orgId), eq(agent.key, template.key)));
    if (!instance) throw notFound();
    await tx
      .insert(agentVersion)
      .values({
        orgId,
        agentId: instance.id,
        version: template.version,
        instructions: template.instructions,
        tools: [...template.tools],
        trigger: template.trigger,
        schedule: template.schedule,
        outputTarget: template.outputTarget,
        reviewerRule: template.reviewerRule,
        modelClass: template.modelClass,
        budgetCents: template.budgetCents,
        maxSteps: template.maxSteps,
      })
      .onConflictDoNothing({
        target: [agentVersion.orgId, agentVersion.agentId, agentVersion.version],
      });
    const [version] = await tx
      .select()
      .from(agentVersion)
      .where(
        and(
          eq(agentVersion.orgId, orgId),
          eq(agentVersion.agentId, instance.id),
          eq(agentVersion.version, template.version),
        ),
      );
    const [state] = await tx
      .select({ enabled: agentOrgState.enabled })
      .from(agentOrgState)
      .where(and(eq(agentOrgState.orgId, orgId), eq(agentOrgState.agentId, instance.id)));
    if (!version) throw notFound();
    return { instance, version, enabled: state?.enabled ?? false };
  }

  private visibility(auth: AuthContext) {
    const own = eq(agentRun.startedBy, auth.userId);
    return auth.orgRole === 'admin' ? or(own, eq(agentRun.isTest, false)) : own;
  }

  private summaries(
    tx: TenantTransaction,
    auth: AuthContext,
    options: { runId?: string; agentId?: string; limit: number },
  ) {
    const { organizationId } = this.scope(auth);
    return tx
      .select({
        run: agentRun,
        name: agent.name,
        version: agentVersion.version,
        person: appUser.name,
      })
      .from(agentRun)
      .innerJoin(
        agentVersion,
        and(eq(agentVersion.id, agentRun.agentVersionId), eq(agentVersion.orgId, agentRun.orgId)),
      )
      .innerJoin(agent, and(eq(agent.id, agentVersion.agentId), eq(agent.orgId, agentRun.orgId)))
      .leftJoin(
        appUser,
        and(eq(appUser.id, agentRun.startedBy), eq(appUser.organizationId, agentRun.orgId)),
      )
      .where(
        and(
          eq(agentRun.orgId, organizationId),
          this.visibility(auth),
          options.runId ? eq(agentRun.id, options.runId) : undefined,
          options.agentId ? eq(agent.id, options.agentId) : undefined,
        ),
      )
      .orderBy(desc(agentRun.createdAt), desc(agentRun.id))
      .limit(options.limit);
  }

  private async summaryCount(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    agentId: string,
  ) {
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(agentRun)
      .innerJoin(
        agentVersion,
        and(eq(agentVersion.id, agentRun.agentVersionId), eq(agentVersion.orgId, agentRun.orgId)),
      )
      .where(
        and(eq(agentRun.orgId, orgId), eq(agentVersion.agentId, agentId), this.visibility(auth)),
      );
    return row?.count ?? 0;
  }

  async list(auth: AuthContext) {
    const session = this.scope(auth);
    const result = await this.tenant.run(session, async (tx) => {
      const def = await this.builtin(tx, session.organizationId);
      const recent = await this.summaries(tx, auth, { limit: 8 });
      return {
        agents: [
          {
            id: def.instance.id,
            key: meetingBrief.key,
            enabled: def.enabled,
            version: def.version.version,
            runCount: await this.summaryCount(tx, auth, session.organizationId, def.instance.id),
          },
        ],
        recentRuns: recent.map((row) => viewRun(auth, row)),
        canManage: auth.orgRole === 'admin',
      };
    });
    const latest = result.recentRuns.find(
      (run) => run.isOwn && !run.isTest && run.status === 'done',
    );
    const detail = latest ? await this.detail(auth, latest.id) : null;
    return {
      ...result,
      nextRunId:
        detail && 'hasOpenDraft' in detail && detail.hasOpenDraft ? (latest?.id ?? null) : null,
    };
  }

  definition(auth: AuthContext, id: string) {
    const session = this.scope(auth);
    return this.tenant.run(session, async (tx) => {
      const def = await this.builtin(tx, session.organizationId);
      if (def.instance.id !== id) throw notFound();
      const recent = await this.summaries(tx, auth, { agentId: id, limit: 20 });
      return {
        agent: {
          id,
          key: meetingBrief.key,
          version: def.version.version,
          enabled: def.enabled,
          runCount: await this.summaryCount(tx, auth, session.organizationId, id),
        },
        tools: def.version.tools,
        instructions: def.version.instructions,
        trigger: def.version.trigger,
        runs: recent.map((row) => viewRun(auth, row)),
        canManage: auth.orgRole === 'admin',
      };
    });
  }

  async setEnabled(auth: AuthContext, id: string, enabled: boolean) {
    const session = this.scope(auth);
    if (!can(auth, 'einstellungen.verwalten')) throw forbidden();
    await this.tenant.run(session, async (tx) => {
      const def = await this.builtin(tx, session.organizationId);
      if (def.instance.id !== id) throw notFound();
      await tx
        .insert(agentOrgState)
        .values({ orgId: session.organizationId, agentId: id, enabled })
        .onConflictDoUpdate({
          target: [agentOrgState.orgId, agentOrgState.agentId],
          set: { enabled },
        });
    });
    return this.definition(auth, id);
  }

  private async monthGate(session: { userId: string; organizationId: string }) {
    const settings = await this.tenant.run(
      session,
      (tx) => readAiSettings(tx, session.organizationId),
      { readOnly: true },
    );
    if (
      (await this.gateway.monthMicrocents({
        userId: session.userId,
        orgId: session.organizationId,
      })) >=
      settings.budgetMonthCents * 1_000_000
    ) {
      throw conflict('ki_kontingent_erschoepft');
    }
  }

  async start(auth: AuthContext, agentId: string, input: StartAgent) {
    const session = this.scope(auth);
    await this.tools.assertContext(auth, input);
    await this.monthGate(session);
    const ticket = randomUUID();
    // KI-07: Ohne Änderung der Eingaben startet kein neuer Lauf.
    const checksum = input.isTest
      ? null
      : await this.brief.checksumFor(auth, input.relationshipId, input.meetingId);
    const [run] = await this.tenant.run(session, async (tx) => {
      const def = await this.builtin(tx, session.organizationId);
      if (def.instance.id !== agentId) throw notFound();
      if (!def.enabled) throw conflict('agent_ausgeschaltet');
      if (checksum) {
        const [last] = await tx
          .select({ status: agentRun.status, checksum: agentRun.inputChecksum })
          .from(agentRun)
          .where(
            and(
              eq(agentRun.orgId, session.organizationId),
              eq(agentRun.contextId, input.meetingId),
              eq(agentRun.isTest, false),
            ),
          )
          .orderBy(desc(agentRun.createdAt), desc(agentRun.id))
          .limit(1);
        if (last && ['queued', 'running', 'waiting_input'].includes(last.status)) {
          throw conflict('lauf_aktiv');
        }
        if (last?.status === 'done' && last.checksum === checksum) {
          throw conflict('briefing_aktuell');
        }
      }
      return tx
        .insert(agentRun)
        .values({
          orgId: session.organizationId,
          agentVersionId: def.version.id,
          actingUserId: auth.userId,
          startedBy: auth.userId,
          trigger: 'manual',
          contextType: 'meeting',
          contextId: input.meetingId,
          contextRelationshipId: input.relationshipId,
          isTest: input.isTest,
          jobTicket: ticket,
          inputChecksum: checksum,
        })
        .returning({ id: agentRun.id });
    });
    if (!run) throw notFound();
    await this.enqueue({
      orgId: session.organizationId,
      userId: auth.userId,
      runId: run.id,
      ticket,
    });
    return this.detail(auth, run.id);
  }

  /**
   * KI-07: Zeitplan-Lauf im Vorlauf des Termintyps im Namen des SRO. Ein Lauf je Termin; erneut nur,
   * wenn sich Zeit, Dauer oder Teilnehmer geändert haben. Ist der Agent ausgeschaltet oder läuft
   * schon einer, entsteht keiner. Liefert die Lauf-ID.
   */
  async startScheduled(auth: AuthContext, input: { relationshipId: string; meetingId: string }) {
    const session = this.scope(auth);
    await this.tools.assertContext(auth, { ...input, isTest: false });
    const ticket = randomUUID();
    const checksum = await this.brief.checksumFor(auth, input.relationshipId, input.meetingId);
    const meetingPart = checksum.split(':')[0] ?? '';
    const runId = await this.tenant.run(session, async (tx) => {
      const def = await this.builtin(tx, session.organizationId);
      if (!def.enabled) return null;
      const earlier = await tx
        .select({ status: agentRun.status, checksum: agentRun.inputChecksum })
        .from(agentRun)
        .where(
          and(
            eq(agentRun.orgId, session.organizationId),
            eq(agentRun.contextId, input.meetingId),
            eq(agentRun.isTest, false),
          ),
        );
      if (
        earlier.some(
          (run) =>
            ['queued', 'running', 'waiting_input'].includes(run.status) ||
            // Läufe ohne Prüfsumme stammen aus der früheren QBR-Vorbereitung und zählen nicht.
            (run.status !== 'failed' &&
              run.checksum !== null &&
              run.checksum.split(':')[0] === meetingPart),
        )
      )
        return null;
      const [run] = await tx
        .insert(agentRun)
        .values({
          orgId: session.organizationId,
          agentVersionId: def.version.id,
          actingUserId: auth.userId,
          startedBy: auth.userId,
          trigger: 'schedule',
          contextType: 'meeting',
          contextId: input.meetingId,
          contextRelationshipId: input.relationshipId,
          jobTicket: ticket,
          inputChecksum: checksum,
        })
        .returning({ id: agentRun.id });
      return run?.id ?? null;
    });
    if (!runId) return null;
    await this.enqueue({ orgId: session.organizationId, userId: auth.userId, runId, ticket });
    return runId;
  }

  private async enqueue(job: AgentJob) {
    try {
      await this.worker.enqueue(job);
    } catch {
      await this.tenant.run({ organizationId: job.orgId, userId: job.userId }, async (tx) => {
        await tx
          .update(agentRun)
          .set({ status: 'failed', finishedAt: new Date() })
          .where(
            and(
              eq(agentRun.id, job.runId),
              eq(agentRun.orgId, job.orgId),
              eq(agentRun.status, 'queued'),
              eq(agentRun.jobTicket, job.ticket),
            ),
          );
      });
    }
  }

  private async contextAllowed(auth: AuthContext, row: RunRow) {
    const parsed = qbrContextSchema.safeParse({
      relationshipId: row.contextRelationshipId,
      meetingId: row.contextId,
    });
    if (!parsed.success) return null;
    try {
      await this.tools.assertContext(auth, parsed.data);
      return parsed.data;
    } catch {
      return null;
    }
  }

  async detail(auth: AuthContext, id: string) {
    const session = this.scope(auth);
    const [row] = await this.tenant.run(
      session,
      (tx) => this.summaries(tx, auth, { runId: id, limit: 1 }),
      { readOnly: true },
    );
    if (!row) throw notFound();
    const run = viewRun(auth, row);
    const context = await this.contextAllowed(auth, row.run);
    if (!context)
      return {
        run: { ...run, canResume: false },
        detailsAllowed: false,
        steps: [],
        draftHref: null,
        testResult: null,
      };
    return this.tenant.run(
      session,
      async (tx) => {
        const filter = and(eq(agentStep.orgId, session.organizationId), eq(agentStep.runId, id));
        const steps = await tx.select().from(agentStep).where(filter).orderBy(agentStep.seq);
        const draft = steps.find((step) => step.kind === 'draft')?.detail;
        const result = qbrAnswerSchema.safeParse(draft);
        const [existing] = await tx
          .select({ id: aiDraft.id, status: aiDraft.status })
          .from(aiDraft)
          .where(and(eq(aiDraft.orgId, session.organizationId), eq(aiDraft.runId, id)));
        const question =
          run.status === 'waiting_input' && run.isOwn
            ? steps
                .flatMap((step) => {
                  const result = qbrQuestionSchema.safeParse(step.detail);
                  return result.success ? [result.data.question] : [];
                })
                .at(-1)
            : undefined;
        const sourceHref = `/lieferanten/${context.relationshipId}/umsetzung/termine/${context.meetingId}`;
        const draftHref = existing && !run.isTest ? sourceHref : null;
        const outbound = schema.agentOutboundQuery;
        const outboundQueries = await tx
          .select()
          .from(outbound)
          .where(and(eq(outbound.orgId, session.organizationId), eq(outbound.runId, id)))
          .orderBy(outbound.sentAt);
        return {
          run,
          detailsAllowed: true,
          steps: steps.map((step) => ({
            seq: step.seq,
            key: agentStepKeys[step.seq - 1],
            status: step.status,
            finishedAt: step.finishedAt?.toISOString() ?? null,
          })),
          draftHref,
          sourceHref,
          hasOpenDraft: existing?.status === 'draft' && !run.isTest,
          outboundQueries: outboundQueries.map(({ id, text, provider, sentAt }) => ({
            id,
            text,
            provider,
            sentAt: sentAt.toISOString(),
          })),
          question: question ?? null,
          testResult: run.isTest && run.isOwn && result.success ? result.data.summary : null,
        };
      },
      { readOnly: true },
    );
  }

  async cancel(auth: AuthContext, id: string) {
    const session = this.scope(auth);
    await this.tenant.run(session, async (tx) => {
      const filter = and(
        eq(agentRun.orgId, session.organizationId),
        eq(agentRun.id, id),
        eq(agentRun.startedBy, auth.userId),
      );
      const [run] = await tx.select().from(agentRun).where(filter).for('update');
      if (!run) throw notFound();
      if (run.status === 'queued' || run.status === 'waiting_input') {
        await tx
          .update(agentRun)
          .set({ status: 'cancelled', finishedAt: new Date() })
          .where(filter);
      } else if (run.status === 'running') {
        await tx.update(agentRun).set({ cancelRequestedAt: new Date() }).where(filter);
      }
    });
    return this.detail(auth, id);
  }

  async resume(auth: AuthContext, id: string, answer?: string) {
    const session = this.scope(auth);
    const [row] = await this.tenant.run(
      session,
      (tx) => this.summaries(tx, auth, { runId: id, limit: 1 }),
      { readOnly: true },
    );
    if (!row || row.run.startedBy !== auth.userId) throw notFound();
    if (!(await this.contextAllowed(auth, row.run))) throw forbidden();
    await this.monthGate(session);
    const ticket = randomUUID();
    await this.tenant.run(session, async (tx) => {
      const filter = and(
        eq(agentRun.orgId, session.organizationId),
        eq(agentRun.id, id),
        eq(agentRun.startedBy, auth.userId),
      );
      const [run] = await tx.select().from(agentRun).where(filter).for('update');
      if (!run || !resumable.has(run.status)) throw conflict('lauf_laeuft');
      if (run.status === 'waiting_input' && !answer) throw conflict('antwort_fehlt');
      if (answer && run.status !== 'waiting_input') throw conflict('keine_rueckfrage');
      await tx
        .update(agentRun)
        .set({
          status: 'queued',
          jobTicket: ticket,
          cancelRequestedAt: null,
          finishedAt: null,
          ...(answer && { inputText: answer }),
        })
        .where(filter);
    });
    await this.enqueue({ orgId: session.organizationId, userId: auth.userId, runId: id, ticket });
    return this.detail(auth, id);
  }
}
