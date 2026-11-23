import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  type CustomAgent,
  type CustomAgentDetail,
  type CustomAgentEvent,
  type CustomAgentList,
  type CustomAgentOptions,
  type CustomAgentRunResults,
  type CustomAgentSchedule,
  customAgentDetailSchema,
  customAgentListSchema,
  customAgentOptionsSchema,
  customAgentRunResultsSchema,
  type ReviewCustomAgent,
  reviewCustomAgentSchema,
  type SaveCustomAgent,
  saveCustomAgentSchema,
} from '@reziproq/shared';
import { generateText } from 'ai';
import { z } from 'zod';
import { AccountStore, TenantDatabase } from '../../common/database.module.js';
import { ActionsService } from '../actions/actions.service.js';
import { ActivitiesService } from '../activities/activities.service.js';
import { readAiSettings } from '../ai-gateway/ai-settings.js';
import { estimateTokens, ModelGateway } from '../ai-gateway/model-gateway.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import type { AgentJob } from './agent-runner.js';
import { AgentsWorker } from './agents.worker.js';
import { CustomAgentTools } from './custom-tools.js';
import { meetingBrief } from './system-agents.js';

const { agent, agentVersion, agentRun, aiDraft, appUser } = schema;
const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const conflict = (code: string) => new ConflictException({ statusCode: 409, code });

type AgentRow = typeof agent.$inferSelect;
type VersionRow = typeof agentVersion.$inferSelect;

/**
 * Bewertet die Aufgabe Personen? Erst ein Muster, dann (mit echtem Modell) ein Modell der Klasse
 * small. Agenten bewerten Lieferanten und Beziehungen, nie einzelne Personen.
 */
const peoplePattern =
  /\b(einkäufer(?:in|innen)?|mitarbeiter(?:in|innen)?|kolleg(?:e|in|en|innen)|beschäftigte|person(?:en)?|buyer|employee|colleague|staff)\b[^.]{0,80}\b(bewert|beurteil|vergleich|rank|schlecht|gut|leistung|betreu|rate|perform|worst|best)/i;
const peoplePatternReverse =
  /\b(bewert|beurteil|vergleich|rank|rate|welche[rs]?|wer)\w*\b[^.]{0,80}\b(einkäufer|mitarbeiter|kolleg|person|buyer|employee|colleague|sro)\b[^.]{0,60}\b(schlecht|gut|leistung|betreu|perform|worst|best|am\b)/i;

export function ratesPeopleByPattern(text: string): boolean {
  return peoplePattern.test(text) || peoplePatternReverse.test(text);
}

export const peopleReason =
  'Die Aufgabe verlangt eine Bewertung einzelner Personen. Agenten bewerten Lieferanten und Beziehungen, nie Personen. Formuliere die Aufgabe bitte über Lieferanten oder Beziehungen.';

/** Nächster Zeitpunkt eines Zeitplans nach einem Zeitpunkt (Europe/Berlin, grob über UTC+1) */
export function lastOccurrence(schedule: CustomAgentSchedule, now: Date): Date {
  const [hours, minutes] = schedule.time.split(':').map(Number);
  const base = new Date(now);
  base.setUTCSeconds(0, 0);
  const at = (date: Date) => {
    const result = new Date(date);
    result.setUTCHours((hours ?? 0) - 1, minutes ?? 0, 0, 0);
    return result;
  };
  if (schedule.every === 'week') {
    const isoDay = ((base.getUTCDay() + 6) % 7) + 1;
    const candidate = at(base);
    candidate.setUTCDate(candidate.getUTCDate() - ((isoDay - schedule.weekday + 7) % 7));
    if (candidate > now) candidate.setUTCDate(candidate.getUTCDate() - 7);
    return candidate;
  }
  const candidate = at(base);
  candidate.setUTCDate(schedule.day);
  if (candidate > now) candidate.setUTCMonth(candidate.getUTCMonth() - 1);
  return candidate;
}

/**
 * KI-09 Eigene Agenten. Käufer legen sie ohne Code an; jede Änderung ist eine neue Version. Aktiv
 * nur nach erfolgreichem Testlauf der aktuellen Version, ohne Personenbewertung und, bei Zeitplan
 * oder Ereignis mit eingeschalteter Freigabe, nach Freigabe durch einen Admin. Ein Lauf handelt im
 * Namen der Person, die startet; Zeitplan und Ereignis im Namen des Besitzers.
 */
@Injectable()
export class CustomAgentsService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(AccountStore) private readonly accounts: AccountStore,
    @Inject(AgentsWorker) private readonly worker: AgentsWorker,
    @Inject(CustomAgentTools) private readonly tools: CustomAgentTools,
    @Inject(ModelGateway) private readonly gateway: ModelGateway,
    @Inject(ActionsService) private readonly actions: ActionsService,
    @Inject(ActivitiesService) private readonly activities: ActivitiesService,
  ) {}

  /** Für Tests: feste Uhrzeit */
  clock: () => Date = () => new Date();

  private session(auth: AuthContext) {
    if (!auth.organization?.buyer || !can(auth, 'lieferanten.sehen') || auth.supportOrganization)
      throw forbidden();
    return { userId: auth.userId, organizationId: auth.organization.id };
  }

  /** Darf anlegen: ai_custom_agent_roles (Käufer mit Zugriff auf mindestens eine Beziehung, oder nur Admins) */
  private async mayCreate(tx: TenantTransaction, auth: AuthContext, orgId: string) {
    const settings = await readAiSettings(tx, orgId);
    if (settings.customAgentRoles === 'admins') return auth.orgRole === 'admin';
    const [row] = await tx
      .execute<{ n: number }>(
        sql`select count(*)::int as n from relationship where buyer_org_id = ${orgId}`,
      )
      .then((result) => result.rows);
    return (row?.n ?? 0) > 0;
  }

  private needsApproval(settings: { customAgentApproval: boolean }, config: SaveCustomAgent) {
    return settings.customAgentApproval && config.trigger.kind !== 'manual';
  }

  private async latestVersion(tx: TenantTransaction, orgId: string, agentId: string) {
    const [row] = await tx
      .select()
      .from(agentVersion)
      .where(and(eq(agentVersion.orgId, orgId), eq(agentVersion.agentId, agentId)))
      .orderBy(desc(agentVersion.version))
      .limit(1);
    if (!row) throw notFound();
    return row;
  }

  private async view(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    row: AgentRow,
  ): Promise<CustomAgent> {
    const version = await this.latestVersion(tx, orgId, row.id);
    const settings = await readAiSettings(tx, orgId);
    const config = saveCustomAgentSchema.parse(version.scope.config);
    const [owner] = await tx
      .select({ name: appUser.name })
      .from(appUser)
      .where(eq(appUser.id, row.ownerUserId ?? ''));
    const [runs] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(agentRun)
      .innerJoin(agentVersion, eq(agentVersion.id, agentRun.agentVersionId))
      .where(and(eq(agentRun.orgId, orgId), eq(agentVersion.agentId, row.id)));
    const isOwn = row.ownerUserId === auth.userId;
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      ownerName: owner?.name ?? '',
      isOwn,
      version: version.version,
      config,
      blockedReason: version.checkStatus === 'blocked' ? (version.checkNote ?? peopleReason) : null,
      testPassed: version.testPassedAt !== null,
      lastTestRunId: version.testRunId,
      needsApproval: this.needsApproval(settings, config),
      reviewComment: row.reviewComment,
      pausedReason: row.pausedReason,
      runCount: runs?.n ?? 0,
      canEdit: isOwn,
      canApprove: auth.orgRole === 'admin' && row.status === 'pending_approval',
      canStart: row.status === 'active' || isOwn,
    };
  }

  private async own(tx: TenantTransaction, auth: AuthContext, orgId: string, id: string) {
    const [row] = await tx
      .select()
      .from(agent)
      .where(and(eq(agent.orgId, orgId), eq(agent.id, id), eq(agent.kind, 'custom')));
    if (!row || row.status === 'off') throw notFound();
    return row;
  }

  // ------------------------------------------------------------- Anlegen

  async options(auth: AuthContext): Promise<CustomAgentOptions> {
    const session = this.session(auth);
    const suppliers = await this.tools.relationships(auth, { kind: 'focus' });
    return this.tenant.run(
      session,
      async (tx) => {
        const settings = await readAiSettings(tx, session.organizationId);
        const all = await tx.execute<{ id: string; name: string }>(sql`
          select r.id, coalesce(s.display_name, o.name) as name from relationship r
          join organization o on o.id = r.supplier_org_id
          left join relationship_side s on s.relationship_id = r.id and s.org_id = ${session.organizationId}
          where r.buyer_org_id = ${session.organizationId} and r.status <> 'ended' order by name limit 500`);
        const groups = await tx.execute<{ id: string; name: string }>(sql`
          select id, name from material_group where org_id = ${session.organizationId} order by name limit 500`);
        return customAgentOptionsSchema.parse({
          tools: this.tools.allowed(auth),
          suppliers: (all.rows.length > 0 ? all.rows : suppliers).map((row) => ({
            relationshipId: row.id,
            name: row.name,
          })),
          categories: groups.rows,
          maxBudgetCents: settings.budgetRunCents,
          approvalRequired: settings.customAgentApproval,
          templates: [
            {
              key: meetingBrief.key,
              name: meetingBrief.name,
              instructions: meetingBrief.instructions,
            },
          ],
        });
      },
      { readOnly: true },
    );
  }

  /** Prüft die Aufgabe: Muster und, mit echtem Modell, ein Modell der Klasse small */
  private async check(auth: AuthContext, orgId: string, instructions: string) {
    if (ratesPeopleByPattern(instructions))
      return { status: 'blocked' as const, note: peopleReason };
    const system =
      'Prüfe die Aufgabe eines Agenten. Verlangt sie, einzelne Personen (Mitarbeitende, Einkäufer, Kolleginnen) zu ' +
      'bewerten, zu vergleichen oder zu ranken? Antworte mit genau einem JSON-Objekt {"ratesPeople": true|false}.';
    const result = await this.gateway
      .call({ orgId, userId: auth.userId, feature: 'agent_check' }, async (model) => {
        if (!model) {
          const value = JSON.stringify({ ratesPeople: false });
          return {
            value,
            usage: { inputTokens: estimateTokens(system + instructions), outputTokens: 5 },
          };
        }
        const answer = await generateText({
          model,
          system,
          prompt: instructions,
          maxOutputTokens: 30,
        });
        return {
          value: answer.text,
          usage: {
            inputTokens: answer.usage.inputTokens ?? 0,
            outputTokens: answer.usage.outputTokens ?? 0,
          },
        };
      })
      .catch(() => '{"ratesPeople":false}');
    try {
      const parsed = z.object({ ratesPeople: z.boolean() }).safeParse(JSON.parse(result));
      if (parsed.success && parsed.data.ratesPeople)
        return { status: 'blocked' as const, note: peopleReason };
    } catch {}
    return { status: 'ok' as const, note: null };
  }

  private async validateConfig(auth: AuthContext, orgId: string, config: SaveCustomAgent) {
    const allowed = this.tools.allowed(auth);
    if (config.tools.some((tool) => !allowed.includes(tool))) throw forbidden();
    const settings = await this.tenant.run(
      { userId: auth.userId, organizationId: orgId },
      (tx) => readAiSettings(tx, orgId),
      { readOnly: true },
    );
    if (config.budgetCents > settings.budgetRunCents) throw conflict('budget_zu_hoch');
    if (config.scope.kind === 'supplier') {
      const visible = await this.tools.relationships(auth, config.scope);
      if (visible.length === 0) throw forbidden();
    }
  }

  private versionValues(
    orgId: string,
    agentId: string,
    number: number,
    auth: AuthContext,
    config: SaveCustomAgent,
    check: { status: 'ok' | 'blocked'; note: string | null },
  ) {
    const trigger = config.trigger;
    return {
      orgId,
      agentId,
      version: number,
      instructions: config.instructions,
      tools: config.tools,
      trigger: trigger.kind,
      schedule: trigger.kind === 'schedule' ? JSON.stringify(trigger.schedule) : null,
      eventKey: trigger.kind === 'event' ? trigger.event : null,
      scope: { config },
      outputTarget: config.output,
      reviewerRule: config.reviewer,
      modelClass: 'standard' as const,
      budgetCents: config.budgetCents,
      maxSteps: 10,
      createdBy: auth.userId,
      checkStatus: check.status,
      checkNote: check.note,
    };
  }

  async create(auth: AuthContext, input: SaveCustomAgent): Promise<CustomAgent> {
    const config = saveCustomAgentSchema.parse(input);
    const session = this.session(auth);
    await this.validateConfig(auth, session.organizationId, config);
    const check = await this.check(auth, session.organizationId, config.instructions);
    return this.tenant.run(session, async (tx) => {
      if (!(await this.mayCreate(tx, auth, session.organizationId))) throw forbidden();
      const [row] = await tx
        .insert(agent)
        .values({
          orgId: session.organizationId,
          key: `custom-${randomUUID()}`,
          name: config.name,
          description: config.instructions.slice(0, 200),
          kind: 'custom',
          ownerUserId: auth.userId,
          status: 'draft',
        })
        .returning();
      if (!row) throw notFound();
      await tx
        .insert(agentVersion)
        .values(this.versionValues(session.organizationId, row.id, 1, auth, config, check));
      return this.view(tx, auth, session.organizationId, row);
    });
  }

  /** Jede Änderung ist eine neue Version; sie braucht einen neuen Testlauf und geht auf Entwurf */
  async update(auth: AuthContext, id: string, input: SaveCustomAgent): Promise<CustomAgent> {
    const config = saveCustomAgentSchema.parse(input);
    const session = this.session(auth);
    await this.validateConfig(auth, session.organizationId, config);
    const check = await this.check(auth, session.organizationId, config.instructions);
    return this.tenant.run(session, async (tx) => {
      const row = await this.own(tx, auth, session.organizationId, id);
      if (row.ownerUserId !== auth.userId) throw forbidden();
      const latest = await this.latestVersion(tx, session.organizationId, id);
      await tx
        .insert(agentVersion)
        .values(
          this.versionValues(session.organizationId, id, latest.version + 1, auth, config, check),
        );
      const [updated] = await tx
        .update(agent)
        .set({
          name: config.name,
          description: config.instructions.slice(0, 200),
          status: 'draft',
          reviewComment: null,
          pausedReason: null,
        })
        .where(eq(agent.id, id))
        .returning();
      return this.view(tx, auth, session.organizationId, updated as AgentRow);
    });
  }

  // ------------------------------------------------------------- Zustände

  /** Aktivieren: nur mit Testlauf der aktuellen Version und ohne Personenbewertung; ggf. zur Freigabe */
  async activate(auth: AuthContext, id: string): Promise<CustomAgent> {
    const session = this.session(auth);
    return this.tenant.run(session, async (tx) => {
      const row = await this.own(tx, auth, session.organizationId, id);
      if (row.ownerUserId !== auth.userId) throw forbidden();
      const version = await this.latestVersion(tx, session.organizationId, id);
      if (version.checkStatus === 'blocked') throw conflict('personenbewertung');
      if (!version.testPassedAt) throw conflict('testlauf_fehlt');
      const settings = await readAiSettings(tx, session.organizationId);
      const config = saveCustomAgentSchema.parse(version.scope.config);
      const status =
        this.needsApproval(settings, config) && !version.approvedAt ? 'pending_approval' : 'active';
      const [updated] = await tx
        .update(agent)
        .set({ status, reviewComment: null, pausedReason: null })
        .where(eq(agent.id, id))
        .returning();
      return this.view(tx, auth, session.organizationId, updated as AgentRow);
    });
  }

  /** Admin: freigeben oder mit Kommentar zurückgeben */
  async review(auth: AuthContext, id: string, input: ReviewCustomAgent): Promise<CustomAgent> {
    const data = reviewCustomAgentSchema.parse(input);
    const session = this.session(auth);
    if (auth.orgRole !== 'admin') throw forbidden();
    return this.tenant.run(session, async (tx) => {
      const row = await this.own(tx, auth, session.organizationId, id);
      if (row.status !== 'pending_approval') throw conflict('nicht_zur_freigabe');
      const version = await this.latestVersion(tx, session.organizationId, id);
      if (data.decision === 'approve') {
        await tx
          .update(agentVersion)
          .set({ approvedBy: auth.userId, approvedAt: new Date() })
          .where(eq(agentVersion.id, version.id));
      }
      const [updated] = await tx
        .update(agent)
        .set(
          data.decision === 'approve'
            ? { status: 'active', reviewComment: null }
            : { status: 'draft', reviewComment: data.comment },
        )
        .where(eq(agent.id, id))
        .returning();
      return this.view(tx, auth, session.organizationId, updated as AgentRow);
    });
  }

  /** Pausieren: Besitzer oder Admin */
  async pause(auth: AuthContext, id: string): Promise<CustomAgent> {
    const session = this.session(auth);
    return this.tenant.run(session, async (tx) => {
      const row = await this.own(tx, auth, session.organizationId, id);
      if (row.ownerUserId !== auth.userId && auth.orgRole !== 'admin') throw forbidden();
      const [updated] = await tx
        .update(agent)
        .set({
          status: 'paused',
          pausedReason:
            auth.orgRole === 'admin' && row.ownerUserId !== auth.userId ? 'admin' : null,
        })
        .where(eq(agent.id, id))
        .returning();
      return this.view(tx, auth, session.organizationId, updated as AgentRow);
    });
  }

  /** Löschen: Agent aus (unsichtbar); Läufe und Entwürfe bleiben */
  async remove(auth: AuthContext, id: string): Promise<void> {
    const session = this.session(auth);
    await this.tenant.run(session, async (tx) => {
      const row = await this.own(tx, auth, session.organizationId, id);
      if (row.ownerUserId !== auth.userId) throw forbidden();
      await tx.update(agent).set({ status: 'off' }).where(eq(agent.id, id));
    });
  }

  // ------------------------------------------------------------- Lesen

  async list(auth: AuthContext): Promise<CustomAgentList> {
    const session = this.session(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        const rows = await tx
          .select()
          .from(agent)
          .where(
            and(
              eq(agent.orgId, session.organizationId),
              eq(agent.kind, 'custom'),
              inArray(agent.status, ['draft', 'pending_approval', 'active', 'paused']),
            ),
          )
          .orderBy(agent.name);
        const views: CustomAgent[] = [];
        for (const row of rows) {
          // Eigene immer; fremde nur aktiv (zum Starten) oder für Admins
          if (
            row.ownerUserId !== auth.userId &&
            row.status !== 'active' &&
            auth.orgRole !== 'admin'
          )
            continue;
          views.push(await this.view(tx, auth, session.organizationId, row));
        }
        return customAgentListSchema.parse({
          agents: views,
          canCreate: await this.mayCreate(tx, auth, session.organizationId),
          pendingApproval:
            auth.orgRole === 'admin'
              ? views.filter((view) => view.status === 'pending_approval')
              : [],
        });
      },
      { readOnly: true },
    );
  }

  async detail(auth: AuthContext, id: string): Promise<CustomAgentDetail> {
    const session = this.session(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        const row = await this.own(tx, auth, session.organizationId, id);
        if (row.ownerUserId !== auth.userId && row.status !== 'active' && auth.orgRole !== 'admin')
          throw notFound();
        const view = await this.view(tx, auth, session.organizationId, row);
        const runs = await tx
          .select({ run: agentRun, version: agentVersion.version, person: appUser.name })
          .from(agentRun)
          .innerJoin(agentVersion, eq(agentVersion.id, agentRun.agentVersionId))
          .leftJoin(appUser, eq(appUser.id, agentRun.startedBy))
          .where(
            and(
              eq(agentRun.orgId, session.organizationId),
              eq(agentVersion.agentId, id),
              auth.orgRole === 'admin' ? undefined : eq(agentRun.startedBy, auth.userId),
            ),
          )
          .orderBy(desc(agentRun.createdAt))
          .limit(30);
        return customAgentDetailSchema.parse({
          ...view,
          runs: runs.map(({ run, version, person }) => ({
            id: run.id,
            version,
            status: run.status,
            isTest: run.isTest,
            createdAt: run.createdAt.toISOString(),
            startedBy: person,
          })),
        });
      },
      { readOnly: true },
    );
  }

  // ------------------------------------------------------------- Läufe

  /**
   * Starten von Hand (auch Testlauf). Ein Testlauf ist nur für den Besitzer; ein fremder Start nur
   * bei aktivem Agenten, mit den Rechten der startenden Person.
   */
  async start(auth: AuthContext, id: string, isTest: boolean): Promise<{ runId: string }> {
    const session = this.session(auth);
    const ticket = randomUUID();
    const runId = await this.tenant.run(session, async (tx) => {
      const row = await this.own(tx, auth, session.organizationId, id);
      const own = row.ownerUserId === auth.userId;
      if (isTest ? !own : row.status !== 'active')
        throw conflict(isTest ? 'nur_besitzer' : 'nicht_aktiv');
      const version = await this.latestVersion(tx, session.organizationId, id);
      if (version.checkStatus === 'blocked') throw conflict('personenbewertung');
      const config = saveCustomAgentSchema.parse(version.scope.config);
      if (config.tools.some((tool) => !this.tools.allowed(auth).includes(tool))) throw forbidden();
      return this.insertRun(
        tx,
        session.organizationId,
        version,
        auth.userId,
        auth.userId,
        'manual',
        isTest,
        ticket,
      );
    });
    await this.enqueue({ orgId: session.organizationId, userId: auth.userId, runId, ticket });
    return { runId };
  }

  private async insertRun(
    tx: TenantTransaction,
    orgId: string,
    version: VersionRow,
    actingUserId: string,
    startedBy: string,
    trigger: 'manual' | 'schedule' | 'event',
    isTest: boolean,
    ticket: string,
    relationshipId: string | null = null,
  ) {
    const [run] = await tx
      .insert(agentRun)
      .values({
        orgId,
        agentVersionId: version.id,
        actingUserId,
        startedBy,
        trigger,
        isTest,
        jobTicket: ticket,
        contextRelationshipId: relationshipId,
      })
      .returning({ id: agentRun.id });
    if (!run) throw notFound();
    return run.id;
  }

  private async enqueue(job: AgentJob) {
    try {
      await this.worker.enqueue(job);
    } catch {
      await this.tenant.run({ organizationId: job.orgId, userId: job.userId }, (tx) =>
        tx
          .update(agentRun)
          .set({ status: 'failed', finishedAt: new Date() })
          .where(and(eq(agentRun.id, job.runId), eq(agentRun.status, 'queued'))),
      );
    }
  }

  /** Ergebnisse eines Laufs: im Testlauf angezeigt, sonst als Entwürfe je Lieferant */
  async results(auth: AuthContext, runId: string): Promise<CustomAgentRunResults> {
    const session = this.session(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        const [row] = await tx
          .select({ run: agentRun, version: agentVersion })
          .from(agentRun)
          .innerJoin(agentVersion, eq(agentVersion.id, agentRun.agentVersionId))
          .where(and(eq(agentRun.orgId, session.organizationId), eq(agentRun.id, runId)));
        if (!row || (row.run.startedBy !== auth.userId && auth.orgRole !== 'admin'))
          throw notFound();
        const config = saveCustomAgentSchema.safeParse(row.version.scope.config);
        if (!config.success) throw notFound();
        const [step] = await tx
          .select({ detail: schema.agentStep.detail })
          .from(schema.agentStep)
          .where(and(eq(schema.agentStep.runId, runId), eq(schema.agentStep.seq, 6)));
        const names = await this.tools.relationships(auth, config.data.scope);
        const nameOf = new Map(names.map((entry) => [entry.id, entry.name]));
        const drafts = await tx
          .select()
          .from(aiDraft)
          .where(
            and(
              eq(aiDraft.orgId, session.organizationId),
              eq(aiDraft.runId, runId),
              eq(aiDraft.kind, 'agent_result'),
            ),
          );
        const parsed = z
          .object({
            results: z.array(
              z.object({ relationshipId: z.string(), title: z.string(), text: z.string() }),
            ),
          })
          .safeParse(step?.detail);
        const results = row.run.isTest
          ? (parsed.success ? parsed.data.results : []).map((result) => ({
              ...result,
              supplier: nameOf.get(result.relationshipId) ?? '',
              draftId: null,
              status: null,
            }))
          : drafts.map((draft) => {
              const content = JSON.parse(draft.content) as { title: string; text: string };
              return {
                relationshipId: draft.relationshipId ?? '',
                supplier: nameOf.get(draft.relationshipId ?? '') ?? '',
                title: content.title,
                text: content.text,
                draftId: draft.id,
                status: draft.status,
              };
            });
        return customAgentRunResultsSchema.parse({
          output: config.data.output,
          results: results.filter((result) => result.relationshipId),
          canAccept: !row.run.isTest,
        });
      },
      { readOnly: true },
    );
  }

  /**
   * Übernehmen durch die prüfende Person: Aufgabe für mich und Maßnahme als interne Maßnahme in
   * einer Woche, Notiz als Notiz im Team. Agenten ändern selbst nie etwas.
   */
  async accept(auth: AuthContext, draftId: string): Promise<void> {
    const session = this.session(auth);
    const draft = await this.tenant.run(session, async (tx) => {
      const [row] = await tx
        .select()
        .from(aiDraft)
        .where(
          and(
            eq(aiDraft.orgId, session.organizationId),
            eq(aiDraft.id, draftId),
            eq(aiDraft.kind, 'agent_result'),
          ),
        );
      return row ?? null;
    });
    if (!draft || draft.status !== 'draft' || !draft.relationshipId) throw notFound();
    const content = JSON.parse(draft.content) as { title: string; text: string; reviewer: string };
    if (content.reviewer !== auth.userId && auth.orgRole !== 'admin') throw forbidden();
    const relationshipId = draft.relationshipId;
    if (draft.subject === 'note') {
      await this.activities.createNote(auth, relationshipId, {
        text: `${content.title}\n\n${content.text}`.slice(0, 5000),
        visibility: 'team',
      });
    } else {
      const due = new Date(this.clock().getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
      await this.actions.buyer(auth, relationshipId, (scope) =>
        this.actions.create(scope, {
          action: {
            title: content.title.slice(0, 200),
            description: content.text.slice(0, 4000),
            visibility: 'internal',
            ownerSide: 'buyer',
            ownerUserId: auth.userId,
            ownerName: null,
            dueDate: due,
          },
          sourceType: 'manual',
          sourceId: null,
        }),
      );
    }
    await this.tenant.run(session, (tx) =>
      tx
        .update(aiDraft)
        .set({ status: 'accepted', decidedBy: auth.userId, decidedAt: new Date() })
        .where(eq(aiDraft.id, draftId)),
    );
  }

  async discard(auth: AuthContext, draftId: string): Promise<void> {
    const session = this.session(auth);
    await this.tenant.run(session, async (tx) => {
      const [row] = await tx
        .select()
        .from(aiDraft)
        .where(
          and(
            eq(aiDraft.orgId, session.organizationId),
            eq(aiDraft.id, draftId),
            eq(aiDraft.kind, 'agent_result'),
          ),
        );
      if (!row || row.status !== 'draft') throw notFound();
      const content = JSON.parse(row.content) as { reviewer: string };
      if (content.reviewer !== auth.userId && auth.orgRole !== 'admin') throw forbidden();
      await tx
        .update(aiDraft)
        .set({ status: 'discarded', decidedBy: auth.userId, decidedAt: new Date() })
        .where(eq(aiDraft.id, draftId));
    });
  }

  // ------------------------------------------------------------- Zeitplan und Ereignisse

  /** Besitzer als handelnde Person; ohne Konto im Kunden pausiert der Agent */
  private async ownerActor(orgId: string, row: AgentRow) {
    if (!row.ownerUserId) return null;
    const account = await this.accounts.membershipOf(row.ownerUserId);
    if (!account?.organization.buyer || account.organization.id !== orgId) {
      await this.tenant.run({ userId: 'system:agenten', organizationId: orgId }, (tx) =>
        tx
          .update(agent)
          .set({ status: 'paused', pausedReason: 'kein_zugriff' })
          .where(eq(agent.id, row.id)),
      );
      return null;
    }
    return row.ownerUserId;
  }

  private async activeWith(orgId: string, trigger: 'schedule' | 'event') {
    return this.tenant.run({ userId: 'system:agenten', organizationId: orgId }, async (tx) => {
      const rows = await tx
        .select()
        .from(agent)
        .where(and(eq(agent.orgId, orgId), eq(agent.kind, 'custom'), eq(agent.status, 'active')));
      const result: { row: AgentRow; version: VersionRow }[] = [];
      for (const row of rows) {
        const version = await this.latestVersion(tx, orgId, row.id);
        if (version.trigger === trigger) result.push({ row, version });
      }
      return result;
    });
  }

  private async startFor(
    orgId: string,
    row: AgentRow,
    version: VersionRow,
    trigger: 'schedule' | 'event',
    relationshipId: string | null,
  ) {
    const owner = await this.ownerActor(orgId, row);
    if (!owner) return null;
    const ticket = randomUUID();
    const runId = await this.tenant.run({ userId: owner, organizationId: orgId }, (tx) =>
      this.insertRun(tx, orgId, version, owner, owner, trigger, false, ticket, relationshipId),
    );
    await this.enqueue({ orgId, userId: owner, runId, ticket });
    return runId;
  }

  /** Alle 15 Minuten: fällige Zeitpläne starten (einmal je Termin des Zeitplans) */
  async tick(orgId: string): Promise<number> {
    const now = this.clock();
    let started = 0;
    for (const { row, version } of await this.activeWith(orgId, 'schedule')) {
      const schedule = (() => {
        try {
          return saveCustomAgentSchema.shape.trigger.parse({
            kind: 'schedule',
            schedule: JSON.parse(version.schedule ?? ''),
          });
        } catch {
          return null;
        }
      })();
      if (!schedule || schedule.kind !== 'schedule') continue;
      const due = lastOccurrence(schedule.schedule, now);
      const already = await this.tenant.run(
        { userId: 'system:agenten', organizationId: orgId },
        async (tx) => {
          const [run] = await tx
            .select({ id: agentRun.id })
            .from(agentRun)
            .where(
              and(
                eq(agentRun.orgId, orgId),
                eq(agentRun.agentVersionId, version.id),
                eq(agentRun.trigger, 'schedule'),
                sql`${agentRun.createdAt} >= ${due}`,
              ),
            )
            .limit(1);
          return Boolean(run);
        },
      );
      if (already || now.getTime() - due.getTime() > 24 * 3_600_000) continue;
      if (await this.startFor(orgId, row, version, 'schedule', null)) started += 1;
    }
    return started;
  }

  /** Ereignis aus der festen Liste: aktive Agenten mit diesem Auslöser starten */
  async onEvent(
    orgId: string,
    event: CustomAgentEvent,
    relationshipId: string | null,
  ): Promise<number> {
    let started = 0;
    for (const { row, version } of await this.activeWith(orgId, 'event')) {
      if (version.eventKey !== event) continue;
      if (await this.startFor(orgId, row, version, 'event', relationshipId)) started += 1;
    }
    return started;
  }

  /** Täglich: Ereignisse „Zusage überfällig“ und „QBR in 7 Tagen“ */
  async dailyEvents(orgId: string): Promise<number> {
    const today = this.clock().toISOString().slice(0, 10);
    const rows = await this.tenant.run(
      { userId: 'system:agenten', organizationId: orgId },
      async (tx) => ({
        overdue: (
          await tx.execute<{ relationship_id: string }>(sql`
          select distinct c.relationship_id from commitment c join relationship r on r.id = c.relationship_id
          where r.buyer_org_id = ${orgId} and c.status = 'open' and c.due_on = (${today}::date - 1)`)
        ).rows,
        qbr: (
          await tx.execute<{ relationship_id: string }>(sql`
          select distinct relationship_id from meeting where owner_org_id = ${orgId}
            and type = 'quarterly_review' and status = 'planned'
            and starts_at::date = (${today}::date + 7)`)
        ).rows,
      }),
    );
    let started = 0;
    for (const row of rows.overdue)
      started += await this.onEvent(orgId, 'commitment_overdue', row.relationship_id);
    for (const row of rows.qbr)
      started += await this.onEvent(orgId, 'qbr_in_7_days', row.relationship_id);
    return started;
  }
}
