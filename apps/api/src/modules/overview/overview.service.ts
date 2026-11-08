import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  auditedChange,
  auditedObject,
  desc,
  eq,
  schema,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type DueItem,
  type SupplierCycle,
  type SupplierOverview,
  setJbpDateSchema,
  type UpdateCycleSettings,
  updateCycleSettingsSchema,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { meetingDate, nextMeetingOf } from '../meetings/next-meeting.js';
import { readDecisions } from '../ratings/consolidation.js';
import { ownRelationship, sroOf } from '../suppliers/team.service.js';
import {
  CYCLE_STEP_SOURCES,
  type CycleStepSource,
  ensureActiveCycle,
  readActiveCycle,
  readCycleSettings,
  segmentCycleStepSource,
} from './cycle.js';
import { OVERVIEW_METRIC_SOURCES, type OverviewMetricSource } from './overview-metric.js';

/** Der Überblick liest die Werte am Ursprung; der separate Zyklusstart schreibt buyer-private. */
@Injectable()
export class OverviewService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(OVERVIEW_METRIC_SOURCES) private readonly sources: OverviewMetricSource[],
    @Inject(CYCLE_STEP_SOURCES)
    private readonly cycleSteps: CycleStepSource[] = [segmentCycleStepSource],
  ) {}

  async overview(auth: AuthContext, relationshipId: string): Promise<SupplierOverview> {
    const organization = auth.organization;
    if (!organization?.buyer) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => {
        await ownRelationship(tx, organization, relationshipId);
        const metrics = [];
        for (const source of this.sources) {
          const metric = await source.overviewMetric(relationshipId, auth, tx);
          if (metric) metrics.push(metric);
        }
        const decided = (await readDecisions(tx, organization.id, relationshipId))[0]?.entries.find(
          (entry) => entry.scope === 'total',
        );
        const isFocus = await isFocusOf(tx, organization.id, relationshipId);
        const activeCycle = isFocus
          ? await readActiveCycle(tx, relationshipId, this.cycleSteps)
          : null;
        return {
          head: {
            // Konsolidiert aus SEG-06; der nächste Termin aus der Termin-Quelle (QBR-01b).
            segment: decided
              ? { current: decided.ist.typeName, target: decided.soll.typeName }
              : null,
            sro: await sroOf(tx, organization, relationshipId),
            nextMeeting: await nextMeetingOf(tx, [relationshipId]).then((row) =>
              row ? { date: meetingDate(row.startsAt) } : null,
            ),
            isFocus,
          },
          metrics,
          cycle: activeCycle,
          canStartCycle:
            isFocus && (await canStartCycleOf(tx, auth, organization.id, relationshipId)),
          canSetJbpDate:
            isFocus && (await canStartCycleOf(tx, auth, organization.id, relationshipId)),
        };
      },
      { readOnly: true },
    );
  }

  async startCycle(auth: AuthContext, relationshipId: string) {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'zyklus.starten')) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      if (!(await canStartCycleOf(tx, auth, organization.id, relationshipId))) {
        throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
      }
      if (!(await isFocusOf(tx, organization.id, relationshipId))) {
        throw new ConflictException({ statusCode: 409, code: 'kein_fokuslieferant' });
      }
      await ensureActiveCycle(tx, relationshipId);
      const activeCycle = await readActiveCycle(tx, relationshipId, this.cycleSteps);
      if (!activeCycle) throw new Error('Zyklus konnte nicht geladen werden');
      return activeCycle;
    });
  }

  async setJbpDate(
    auth: AuthContext,
    relationshipId: string,
    input: unknown,
  ): Promise<SupplierCycle> {
    const request = setJbpDateSchema.parse(input);
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'zyklus.starten')) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }

    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      if (!(await canStartCycleOf(tx, auth, organization.id, relationshipId))) {
        throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
      }

      const [cycle] = await tx
        .select()
        .from(schema.cycle)
        .where(
          and(eq(schema.cycle.relationshipId, relationshipId), eq(schema.cycle.status, 'active')),
        )
        .orderBy(desc(schema.cycle.startedAt))
        .limit(1);
      if (!cycle) throw new ConflictException({ statusCode: 409, code: 'zyklus_nicht_aktiv' });

      if (cycle.jbpDate === request.jbpDate) {
        const current = await readActiveCycle(tx, relationshipId, this.cycleSteps);
        if (!current) throw new Error('Zyklus konnte nicht geladen werden');
        return current;
      }

      const [actor] = await tx
        .select({ name: schema.appUser.name })
        .from(schema.appUser)
        .where(eq(schema.appUser.id, auth.userId))
        .limit(1);
      if (!actor) throw new Error('Akteur des Zyklusdatums nicht gefunden');

      return auditedChange(
        tx,
        { userId: auth.userId, name: actor.name, organizationId: organization.id },
        auditedObject({ type: 'cycle', visibility: 'internal', fields: ['jbpDate'] }),
        async () => {
          const [updated] = await tx
            .update(schema.cycle)
            .set({ jbpDate: request.jbpDate })
            .where(eq(schema.cycle.id, cycle.id))
            .returning({ id: schema.cycle.id });
          if (!updated) throw new Error('JBP-Termin konnte nicht gespeichert werden');
          const result = await readActiveCycle(tx, relationshipId, this.cycleSteps);
          if (!result) throw new Error('Zyklus konnte nicht geladen werden');
          return {
            objectId: cycle.id,
            relationshipId,
            action: 'updated',
            before: { jbpDate: cycle.jbpDate },
            after: { jbpDate: request.jbpDate },
            result,
          };
        },
      );
    });
  }

  async cycleSettings(auth: AuthContext) {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'einstellungen.verwalten')) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => ({ settings: await readCycleSettings(tx) }),
      { readOnly: true },
    );
  }

  async updateCycleSettings(auth: AuthContext, input: unknown) {
    const request: UpdateCycleSettings = updateCycleSettingsSchema.parse(input);
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'einstellungen.verwalten')) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      for (const setting of request.settings) {
        await tx
          .insert(schema.cycleSetting)
          .values({
            orgId: organization.id,
            step: setting.step,
            weeksRelativeToJbp: setting.weeksRelativeToJbp,
            reminderDaysBefore: setting.reminderDaysBefore,
          })
          .onConflictDoUpdate({
            target: [schema.cycleSetting.orgId, schema.cycleSetting.step],
            set: {
              weeksRelativeToJbp: setting.weeksRelativeToJbp,
              reminderDaysBefore: setting.reminderDaysBefore,
            },
          });
      }
      return { settings: await readCycleSettings(tx) };
    });
  }

  async overdueItems(auth: AuthContext): Promise<DueItem[]> {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'lieferanten.sehen')) return [];

    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => {
        const supplierName = schema.relationshipSide.displayName;
        const name = await tx
          .select({
            id: schema.cycle.id,
            relationshipId: schema.cycle.relationshipId,
            supplier: schema.organization.name,
            displayName: supplierName,
          })
          .from(schema.cycle)
          .innerJoin(schema.relationship, eq(schema.relationship.id, schema.cycle.relationshipId))
          .innerJoin(
            schema.organization,
            eq(schema.organization.id, schema.relationship.supplierOrgId),
          )
          .leftJoin(
            schema.relationshipSide,
            and(
              eq(schema.relationshipSide.relationshipId, schema.relationship.id),
              eq(schema.relationshipSide.orgId, organization.id),
            ),
          )
          .leftJoin(
            schema.relationshipMember,
            and(
              eq(schema.relationshipMember.relationshipId, schema.relationship.id),
              eq(schema.relationshipMember.orgId, organization.id),
              eq(schema.relationshipMember.userId, auth.userId),
            ),
          )
          .where(
            and(
              eq(schema.cycle.status, 'active'),
              eq(schema.relationship.buyerOrgId, organization.id),
              eq(schema.relationship.status, 'active'),
              auth.orgRole === 'admin'
                ? undefined
                : eq(schema.relationshipMember.userId, auth.userId),
            ),
          )
          .orderBy(asc(schema.organization.name));

        const items: DueItem[] = [];
        for (const row of name) {
          const cycle = await readActiveCycle(tx, row.relationshipId, this.cycleSteps);
          for (const step of cycle?.steps ?? []) {
            if (step.status !== 'overdue' || !step.dueDate) continue;
            items.push({
              id: `${row.id}:${step.key}`,
              kind: 'cycle',
              supplier: row.displayName ?? row.supplier,
              detail: step.key,
              dueDate: step.dueDate,
              href: `/lieferanten/${row.relationshipId}`,
            });
          }
        }
        return items;
      },
      { readOnly: true },
    );
  }
}

async function isFocusOf(tx: TenantTransaction, orgId: string, relationshipId: string) {
  const { relationshipSide } = schema;
  const [row] = await tx
    .select({ isFocus: relationshipSide.isFocus })
    .from(relationshipSide)
    .where(
      and(eq(relationshipSide.relationshipId, relationshipId), eq(relationshipSide.orgId, orgId)),
    );
  return row?.isFocus ?? false;
}

async function canStartCycleOf(
  tx: TenantTransaction,
  auth: AuthContext,
  orgId: string,
  relationshipId: string,
) {
  if (!can(auth, 'zyklus.starten')) return false;
  if (auth.orgRole === 'admin') return true;
  const [member] = await tx
    .select({ userId: schema.relationshipMember.userId })
    .from(schema.relationshipMember)
    .where(
      and(
        eq(schema.relationshipMember.relationshipId, relationshipId),
        eq(schema.relationshipMember.orgId, orgId),
        eq(schema.relationshipMember.userId, auth.userId),
        eq(schema.relationshipMember.teamRole, 'sro'),
      ),
    );
  return member !== undefined;
}
