import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  auditedChange,
  auditedObject,
  desc,
  eq,
  gte,
  inArray,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type CycleArchive,
  cycleArchiveSchema,
  jbpContentSchema,
  type NextCyclePreview,
  nextCycleAfterMonths,
  nextCyclePreviewSchema,
  type StartNextCycle,
  type SupplierCycle,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { copyPlan } from '../supplier-plans/copy-plan.js';
import { ownRelationship } from '../suppliers/team.service.js';
import { CYCLE_STEP_SOURCES, type CycleStepSource, readActiveCycle } from './cycle.js';
import { canStartCycleOf } from './overview.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const conflict = (code: string) => new ConflictException({ statusCode: 409, code });

const cycleAudit = auditedObject({
  type: 'cycle',
  visibility: 'internal',
  fields: ['status', 'label', 'jbpDate'],
});

/** Elf Monate nach dem JBP-Termin (ZYK-05); ohne Termin nie. */
export function nextCycleDue(jbpDate: string | null, today = new Date()): boolean {
  if (!jbpDate) return false;
  const due = new Date(`${jbpDate}T00:00:00Z`);
  due.setUTCMonth(due.getUTCMonth() + nextCycleAfterMonths);
  return today >= due;
}

/** „2026“ wird „2027“; andere Namen bekommen „(neu)“. */
export function nextLabel(label: string): string {
  return /^\d{4}$/.test(label) ? String(Number(label) + 1) : `${label} (neu)`;
}

/**
 * ZYK-05: Nächster Zyklus. Der alte wird geschlossen und bleibt lesbar; der neue übernimmt den
 * letzten freigegebenen Lieferantenplan als Entwurf, und der Gemeinsame Plan läuft als neue Version
 * weiter. Initiativen, Zusagen und Maßnahmen bleiben, wo sie sind.
 */
@Injectable()
export class NextCycleService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(CYCLE_STEP_SOURCES) private readonly cycleSteps: CycleStepSource[],
  ) {}

  private session(auth: AuthContext) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return { organization, session: { userId: auth.userId, organizationId: organization.id } };
  }

  /** SRO der Beziehung oder Admin, mit dem Recht zyklus.starten (wie ZYK-01). */
  private canStart(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    relationshipId: string,
  ) {
    return canStartCycleOf(tx, auth, orgId, relationshipId);
  }

  private async activeCycle(tx: TenantTransaction, relationshipId: string) {
    const [cycle] = await tx
      .select()
      .from(schema.cycle)
      .where(
        and(eq(schema.cycle.relationshipId, relationshipId), eq(schema.cycle.status, 'active')),
      )
      .orderBy(desc(schema.cycle.startedAt))
      .limit(1);
    return cycle;
  }

  private async latestApprovedPlan(tx: TenantTransaction, relationshipId: string) {
    const [plan] = await tx
      .select()
      .from(schema.supplierPlan)
      .where(
        and(
          eq(schema.supplierPlan.relationshipId, relationshipId),
          eq(schema.supplierPlan.status, 'approved'),
        ),
      )
      .orderBy(desc(schema.supplierPlan.createdAt))
      .limit(1);
    return plan;
  }

  private async latestJointPlan(tx: TenantTransaction, relationshipId: string) {
    const [plan] = await tx
      .select()
      .from(schema.jbp)
      .where(eq(schema.jbp.relationshipId, relationshipId))
      .orderBy(desc(schema.jbp.version), desc(schema.jbp.createdAt))
      .limit(1);
    return plan;
  }

  async preview(auth: AuthContext, relationshipId: string): Promise<NextCyclePreview> {
    const { organization, session } = this.session(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        await ownRelationship(tx, organization, relationshipId);
        const cycle = await this.activeCycle(tx, relationshipId);
        if (!cycle) throw conflict('zyklus_nicht_aktiv');
        const plan = await this.latestApprovedPlan(tx, relationshipId);
        const objectives = plan
          ? await tx
              .select({ count: sql<number>`count(*)::int` })
              .from(schema.planObjective)
              .where(eq(schema.planObjective.planId, plan.id))
          : [];
        const joint = await this.latestJointPlan(tx, relationshipId);
        const count = async (query: Promise<{ count: number }[]>) => (await query)[0]?.count ?? 0;
        return nextCyclePreviewSchema.parse({
          current: {
            label: cycle.label,
            startedAt: cycle.startedAt.toISOString(),
            jbpDate: cycle.jbpDate,
          },
          nextLabel: nextLabel(cycle.label),
          approvedPlan: plan
            ? { version: plan.version, objectives: objectives[0]?.count ?? 0 }
            : null,
          jointPlan: joint
            ? { version: joint.version, approved: joint.status === 'approved' }
            : null,
          runningInitiatives: await count(
            tx
              .select({ count: sql<number>`count(*)::int` })
              .from(schema.initiative)
              .where(
                and(
                  eq(schema.initiative.relationshipId, relationshipId),
                  inArray(schema.initiative.status, ['planned', 'running']),
                ),
              ),
          ),
          openCommitments: await count(
            tx
              .select({ count: sql<number>`count(*)::int` })
              .from(schema.commitment)
              .where(
                and(
                  eq(schema.commitment.relationshipId, relationshipId),
                  eq(schema.commitment.status, 'open'),
                ),
              ),
          ),
          openActions: await count(
            tx
              .select({ count: sql<number>`count(*)::int` })
              .from(schema.action)
              .where(
                and(
                  eq(schema.action.relationshipId, relationshipId),
                  inArray(schema.action.status, ['open', 'in_progress']),
                ),
              ),
          ),
          canStart: await this.canStart(tx, auth, organization.id, relationshipId),
        });
      },
      { readOnly: true },
    );
  }

  async start(
    auth: AuthContext,
    relationshipId: string,
    input: StartNextCycle,
  ): Promise<SupplierCycle> {
    const { organization, session } = this.session(auth);
    return this.tenant.run(session, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      if (!(await this.canStart(tx, auth, organization.id, relationshipId))) throw forbidden();
      const old = await this.activeCycle(tx, relationshipId);
      if (!old) throw conflict('zyklus_nicht_aktiv');
      const actor = await actorOf(tx, auth, organization.id);
      const now = new Date();

      // Der alte Zyklus wird geschlossen; sonst bleibt alles an ihm unverändert.
      await auditedChange(tx, actor, cycleAudit, async () => {
        await tx
          .update(schema.cycle)
          .set({ status: 'closed', closedAt: now })
          .where(eq(schema.cycle.id, old.id));
        return {
          relationshipId,
          objectId: old.id,
          action: 'updated' as const,
          before: { status: 'active' },
          after: { status: 'closed' },
          result: null,
        };
      });
      const created = await auditedChange(tx, actor, cycleAudit, async () => {
        const [row] = await tx
          .insert(schema.cycle)
          .values({ relationshipId, label: input.label, jbpDate: input.jbpDate, startedAt: now })
          .returning();
        if (!row) throw new Error('Zyklus nicht angelegt');
        return {
          relationshipId,
          objectId: row.id,
          action: 'created' as const,
          before: null,
          after: { status: 'active', label: row.label, jbpDate: row.jbpDate },
          result: row,
        };
      });

      // Lieferantenplan: Kopie des letzten freigegebenen als Entwurf im neuen Zyklus.
      const plan = await this.latestApprovedPlan(tx, relationshipId);
      if (plan) await copyPlan(tx, plan, { cycleId: created.id, version: 1 });

      // Gemeinsamer Plan: läuft als neue Version weiter, mit seinen laufenden Initiativen.
      const joint = await this.latestJointPlan(tx, relationshipId);
      if (joint) {
        if (joint.status === 'approved') {
          await tx.execute(sql`select app_jbp_transition(${joint.id}, 'new_version')`);
        }
        await tx
          .insert(schema.jbpCycleLink)
          .values({ relationshipId, jbpId: joint.id, cycleId: created.id })
          .onConflictDoNothing();
      }

      const cycle = await readActiveCycle(tx, relationshipId, this.cycleSteps);
      if (!cycle) throw new Error('Zyklus konnte nicht geladen werden');
      return cycle;
    });
  }

  /** Frühere Zyklen, nur lesend: was im jeweiligen Zeitraum galt. */
  async archive(auth: AuthContext, relationshipId: string): Promise<CycleArchive> {
    const { organization, session } = this.session(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        await ownRelationship(tx, organization, relationshipId);
        const cycles = await tx
          .select()
          .from(schema.cycle)
          .where(
            and(eq(schema.cycle.relationshipId, relationshipId), eq(schema.cycle.status, 'closed')),
          )
          .orderBy(desc(schema.cycle.startedAt));
        const result = [];
        for (const cycle of cycles) {
          const end = cycle.closedAt ?? new Date();
          const plans = await tx
            .select()
            .from(schema.supplierPlan)
            .where(eq(schema.supplierPlan.cycleId, cycle.id))
            .orderBy(asc(schema.supplierPlan.version));
          const supplierPlans = [];
          for (const plan of plans) {
            const objectives = await tx
              .select({
                text: schema.planObjective.text,
                targetYear: schema.planObjective.targetYear,
                category: sql<string>`coalesce((select c.name from objective_category c
                  where c.org_id = ${organization.id} and c.key = ${schema.planObjective.categoryKey}
                  limit 1), ${schema.planObjective.categoryKey})`,
              })
              .from(schema.planObjective)
              .where(eq(schema.planObjective.planId, plan.id));
            const topics = await tx
              .select({ title: schema.strategicTopic.title })
              .from(schema.strategicTopic)
              .where(eq(schema.strategicTopic.planId, plan.id));
            supplierPlans.push({
              id: plan.id,
              version: plan.version,
              status: plan.status,
              summary: plan.summary,
              objectives,
              topics: topics.map((topic) => topic.title),
            });
          }
          const period = (column: Parameters<typeof gte>[0]) =>
            and(gte(column, cycle.startedAt), sql`${column} < ${end}`);
          const versions = await tx
            .select({
              version: schema.jbpVersion.version,
              approvedAt: schema.jbpVersion.approvedAt,
              content: schema.jbpVersion.content,
            })
            .from(schema.jbpVersion)
            .innerJoin(schema.jbp, eq(schema.jbp.id, schema.jbpVersion.jbpId))
            .where(
              and(
                eq(schema.jbp.relationshipId, relationshipId),
                period(schema.jbpVersion.approvedAt),
              ),
            )
            .orderBy(asc(schema.jbpVersion.version));
          const cards = await tx
            .select()
            .from(schema.scorecard)
            .innerJoin(schema.jbp, eq(schema.jbp.id, schema.scorecard.jbpId))
            .where(
              and(
                eq(schema.jbp.relationshipId, relationshipId),
                period(schema.scorecard.createdAt),
              ),
            )
            .orderBy(asc(schema.scorecard.version));
          const scorecards = [];
          for (const { scorecard } of cards) {
            const kpis = await tx
              .select({
                name: schema.scorecardKpi.name,
                target: schema.scorecardKpi.target,
                unit: schema.scorecardKpi.unit,
              })
              .from(schema.scorecardKpi)
              .where(eq(schema.scorecardKpi.scorecardId, scorecard.id));
            scorecards.push({ version: scorecard.version, status: scorecard.status, kpis });
          }
          const waves = await tx
            .select({
              id: schema.surveyWave.id,
              kind: schema.surveyWave.kind,
              dueDate: schema.surveyWave.dueDate,
              revealedAt: schema.surveyWave.revealedAt,
            })
            .from(schema.surveyWave)
            .where(
              and(
                eq(schema.surveyWave.relationshipId, relationshipId),
                period(schema.surveyWave.createdAt),
              ),
            )
            .orderBy(asc(schema.surveyWave.createdAt));
          result.push({
            id: cycle.id,
            label: cycle.label,
            startedAt: cycle.startedAt.toISOString(),
            closedAt: cycle.closedAt?.toISOString() ?? null,
            jbpDate: cycle.jbpDate,
            supplierPlans,
            jointPlans: versions.map((version) => {
              const content = jbpContentSchema.parse(version.content);
              return {
                version: version.version,
                approvedAt: version.approvedAt.toISOString(),
                topics: content.topics.map((topic) => topic.title),
                initiatives: content.initiatives.map((initiative) => ({
                  title: initiative.title,
                  startsOn: initiative.startsOn,
                  endsOn: initiative.endsOn,
                })),
                commitments: content.commitments.map((commitment) => ({
                  title: commitment.title,
                  ownerName: commitment.ownerName,
                  dueOn: commitment.dueOn,
                })),
              };
            }),
            scorecards,
            feedback: waves.map((wave) => ({
              id: wave.id,
              kind: wave.kind,
              dueDate: wave.dueDate,
              revealed: wave.revealedAt !== null,
            })),
          });
        }
        return cycleArchiveSchema.parse({ cycles: result });
      },
      { readOnly: true },
    );
  }
}
