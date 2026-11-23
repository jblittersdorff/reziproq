import { Inject, Injectable } from '@nestjs/common';
import { sql } from '@reziproq/db';
import {
  type CustomAgentScope,
  type CustomAgentTool,
  customAgentToolKeys,
  customAgentTools,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';

/**
 * KI-09: Lesende Werkzeuge für eigene Agenten. Jedes Werkzeug liest unter der Mandanten-Session der
 * handelnden Person (Zeilensicherheit) und nur mit dem Recht seines Datenbereichs (can). Geliefert
 * werden Zahlen und Titel zu Lieferant und Beziehung, nie Namen oder Leistungsdaten von Personen.
 */
@Injectable()
export class CustomAgentTools {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  /** Werkzeuge, deren Datenbereich die Person sehen darf */
  allowed(auth: AuthContext): CustomAgentTool[] {
    return customAgentToolKeys.filter((key) => can(auth, customAgentTools[key]));
  }

  private session(auth: AuthContext) {
    const organization = auth.organization;
    if (!organization?.buyer) throw new Error('kein_kaeufer');
    return { userId: auth.userId, organizationId: organization.id };
  }

  /** Beziehungen im Umfang, die die Person sieht; ohne Zugriff fallen sie weg */
  async relationships(auth: AuthContext, scope: CustomAgentScope) {
    const session = this.session(auth);
    const orgId = session.organizationId;
    return this.tenant.run(
      session,
      async (tx) => {
        const filter =
          scope.kind === 'supplier'
            ? sql`r.id = ${scope.relationshipId}`
            : scope.kind === 'category'
              ? sql`exists (select 1 from relationship_material_group m
                  where m.relationship_id = r.id and m.material_group_id = ${scope.materialGroupId})`
              : sql`coalesce(s.is_focus, false) and exists (select 1 from relationship_member t
                  where t.relationship_id = r.id and t.org_id = ${orgId} and t.user_id = ${auth.userId})`;
        const rows = await tx.execute<{ id: string; name: string }>(sql`
          select r.id, coalesce(s.display_name, o.name) as name from relationship r
          join organization o on o.id = r.supplier_org_id
          left join relationship_side s on s.relationship_id = r.id and s.org_id = ${orgId}
          where r.buyer_org_id = ${orgId} and r.status <> 'ended' and ${filter}
          order by name limit 50`);
        return rows.rows;
      },
      { readOnly: true },
    );
  }

  /** Daten eines Werkzeugs zu einer Beziehung; ohne Recht oder Zugriff null */
  async read(auth: AuthContext, tool: CustomAgentTool, relationshipId: string) {
    if (!can(auth, customAgentTools[tool])) return null;
    const session = this.session(auth);
    const orgId = session.organizationId;
    return this.tenant.run(
      session,
      async (tx) => {
        const [visible] = (
          await tx.execute<{ id: string }>(
            sql`select id from relationship where id = ${relationshipId} and buyer_org_id = ${orgId}`,
          )
        ).rows;
        if (!visible) return null;
        const rows = async <T extends Record<string, unknown>>(query: ReturnType<typeof sql>) =>
          (await tx.execute<T>(query)).rows;
        switch (tool) {
          case 'supplier_master': {
            const [row] = await rows<{
              name: string;
              country: string | null;
              status: string;
              focus: boolean;
            }>(sql`
              select coalesce(s.display_name, o.name) as name, o.country, r.status, coalesce(s.is_focus, false) as focus
              from relationship r join organization o on o.id = r.supplier_org_id
              left join relationship_side s on s.relationship_id = r.id and s.org_id = ${orgId}
              where r.id = ${relationshipId}`);
            const groups = await rows<{ name: string }>(sql`
              select g.name from relationship_material_group m join material_group g on g.id = m.material_group_id
              where m.relationship_id = ${relationshipId} order by g.name limit 10`);
            return { ...row, materialGroups: groups.map((group) => group.name) };
          }
          case 'spend':
            return {
              byYear: await rows<{ year: number; currency: string; amount: string }>(sql`
                select year, currency, sum(amount_cents)::text as amount from relationship_spend
                where relationship_id = ${relationshipId} and kind = 'actual'
                group by year, currency order by year desc limit 6`),
            };
          case 'segmentation': {
            const [row] = await rows<Record<string, unknown>>(sql`
              select ist_impact_level, ist_quality_level, soll_impact_level, soll_quality_level, decided_at
              from segment_decision where relationship_id = ${relationshipId} and scope = 'total'
              order by version desc limit 1`);
            return row ?? null;
          }
          case 'commitments': {
            const counts = await rows<{ status: string; n: number }>(sql`
              select status, count(*)::int as n from commitment where relationship_id = ${relationshipId}
              group by status`);
            const due = await rows<{ title: string; due_on: string; side: string }>(sql`
              select title, due_on::text, side from commitment
              where relationship_id = ${relationshipId} and status = 'open' order by due_on limit 5`);
            return { counts, nextDue: due };
          }
          case 'actions': {
            const counts = await rows<{ status: string; n: number }>(sql`
              select status, count(*)::int as n from action where relationship_id = ${relationshipId}
              group by status`);
            const overdue = await rows<{ title: string; due_date: string }>(sql`
              select title, due_date::text from action where relationship_id = ${relationshipId}
                and status in ('open', 'in_progress') and due_date < current_date
              order by due_date limit 5`);
            return { counts, overdue };
          }
          case 'meetings':
            return {
              upcoming: await rows<{ title: string; type: string; starts_at: string }>(sql`
                select title, type, starts_at::text from meeting where relationship_id = ${relationshipId}
                  and starts_at >= now() and status <> 'cancelled' order by starts_at limit 3`),
              last: await rows<{ title: string; type: string; starts_at: string }>(sql`
                select title, type, starts_at::text from meeting where relationship_id = ${relationshipId}
                  and starts_at < now() and status <> 'cancelled' order by starts_at desc limit 3`),
            };
          case 'feedback':
            return {
              revealed: await rows<{ kind: string; revealed_at: string }>(sql`
                select kind, revealed_at::text from survey_wave where relationship_id = ${relationshipId}
                  and revealed_at is not null order by revealed_at desc limit 3`),
            };
          case 'hints':
            return {
              open: await rows<{ rule_key: string; severity: string; title: string | null }>(sql`
                select rule_key, severity, title from hint where relationship_id = ${relationshipId}
                  and status in ('open', 'in_progress') order by score desc limit 5`),
            };
        }
      },
      { readOnly: true },
    );
  }
}
