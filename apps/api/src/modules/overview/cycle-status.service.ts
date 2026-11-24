import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, currentTime, eq, schema, sql } from '@reziproq/db';
import {
  type CycleStatus,
  type CycleStatusQuery,
  type CycleStatusRow,
  cycleStatusSchema,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CYCLE_STEP_SOURCES, type CycleStepSource, readActiveCycle } from './cycle.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const day = 24 * 60 * 60 * 1000;
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / day);

/**
 * ZYK-04: Stand der Zyklen aller Fokuslieferanten des Käufers. Schritt, Fälligkeit und Verzug
 * rechnet readActiveCycle (ZYK-01, ZYK-02) wie auf dem Überblick; gespeichert wird nichts.
 */
@Injectable()
export class CycleStatusService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(CYCLE_STEP_SOURCES) private readonly cycleSteps: CycleStepSource[],
  ) {}

  async status(
    auth: AuthContext,
    query: CycleStatusQuery,
    today = isoToday(),
  ): Promise<CycleStatus> {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => {
        const { relationship, relationshipSide, organization: org } = schema;
        const focus = await tx
          .select({
            relationshipId: relationship.id,
            supplier: sql<string>`coalesce(${relationshipSide.displayName}, ${org.name})`,
            sro: sql<{ userId: string; name: string } | null>`(
              select json_build_object('userId', m.user_id, 'name', coalesce(u.name, m.member_name))
              from relationship_member m left join app_user u on u.id = m.user_id
              where m.relationship_id = ${relationship.id} and m.org_id = ${organization.id}
                and m.team_role = 'sro'
              limit 1)`,
            businessUnits: sql<{ id: string; name: string }[]>`coalesce((
              select json_agg(json_build_object('id', b.id, 'name', b.name) order by b.name)
              from relationship_business_unit rb join business_unit b on b.id = rb.business_unit_id
              where rb.relationship_id = ${relationship.id}), '[]'::json)`,
            materialGroups: sql<{ id: string; name: string }[]>`coalesce((
              select json_agg(json_build_object('id', g.id, 'name', g.name) order by g.name)
              from relationship_material_group rg join material_group g on g.id = rg.material_group_id
              where rg.relationship_id = ${relationship.id}), '[]'::json)`,
          })
          .from(relationship)
          .innerJoin(org, eq(org.id, relationship.supplierOrgId))
          .innerJoin(
            relationshipSide,
            and(
              eq(relationshipSide.relationshipId, relationship.id),
              eq(relationshipSide.orgId, organization.id),
            ),
          )
          .where(
            and(
              eq(relationship.buyerOrgId, organization.id),
              eq(relationship.status, 'active'),
              eq(relationshipSide.isFocus, true),
            ),
          );

        // Auswahl für die Filter: alles, was bei den Fokuslieferanten vorkommt.
        const unique = (items: { id: string; name: string }[]) =>
          [...new Map(items.map((item) => [item.id, item])).values()].sort((a, b) =>
            a.name.localeCompare(b.name, 'de'),
          );
        const options = {
          sros: unique(
            focus.flatMap((row) => (row.sro ? [{ id: row.sro.userId, name: row.sro.name }] : [])),
          ),
          businessUnits: unique(focus.flatMap((row) => row.businessUnits)),
          materialGroups: unique(focus.flatMap((row) => row.materialGroups)),
        };

        const filtered = focus.filter(
          (row) =>
            (!query.sro || row.sro?.userId === query.sro) &&
            (!query.bu || row.businessUnits.some((unit) => unit.id === query.bu)) &&
            (!query.wg || row.materialGroups.some((group) => group.id === query.wg)),
        );

        const rows: CycleStatusRow[] = [];
        for (const row of filtered) {
          const cycle = await readActiveCycle(tx, row.relationshipId, this.cycleSteps);
          // Aktueller Schritt wie im Überblick: der erste, der noch offen ist.
          const current = cycle?.steps.find((step) =>
            ['open', 'in_progress', 'overdue'].includes(step.status),
          );
          const missed = (cycle?.steps ?? [])
            .filter((step) => step.status === 'overdue' && step.dueDate)
            .map((step) => daysBetween(step.dueDate as string, today));
          rows.push({
            relationshipId: row.relationshipId,
            supplier: row.supplier,
            sro: row.sro?.name ?? null,
            hasCycle: cycle !== null,
            step: current?.key ?? null,
            dueDate: current?.dueDate ?? null,
            daysOverdue: Math.max(0, ...missed),
            jbpDate: cycle?.jbpDate ?? null,
          });
        }

        // Ohne JBP-Termin zuerst („Termin fehlt“), dann nach Verzug oder nach Termin.
        rows.sort((a, b) => {
          if ((a.jbpDate === null) !== (b.jbpDate === null)) return a.jbpDate === null ? -1 : 1;
          if (query.sortierung === 'termin' && a.jbpDate && b.jbpDate && a.jbpDate !== b.jbpDate) {
            return a.jbpDate.localeCompare(b.jbpDate);
          }
          if (query.sortierung !== 'termin' && a.daysOverdue !== b.daysOverdue) {
            return b.daysOverdue - a.daysOverdue;
          }
          return a.supplier.localeCompare(b.supplier, 'de');
        });

        const withCycle = rows.filter((row) => row.hasCycle);
        const overdue = withCycle.filter((row) => row.daysOverdue > 0).length;
        return cycleStatusSchema.parse({
          metrics: { total: withCycle.length, onTrack: withCycle.length - overdue, overdue },
          rows,
          options,
        });
      },
      { readOnly: true },
    );
  }
}

function isoToday() {
  return currentTime().toISOString().slice(0, 10);
}
