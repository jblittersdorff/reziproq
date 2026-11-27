import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { currentTime, sql } from '@reziproq/db';
import {
  type AkteCommitment,
  type AkteShared,
  type AkteWeek,
  akteSharedSchema,
  offsetCycleDate,
  planYearOf,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { commitmentQuote } from '../commitments/commitment-rules.js';
import { JbpService } from '../jbp/jbp.service.js';
import { JbpScorecardService } from '../jbp/jbp-scorecard.service.js';
import { TeamService } from '../suppliers/team.service.js';
import { berlinDate } from '../today/berlin.js';

// AK-01 (K2-c.1): Akte einer Beziehung, Sicht Gemeinsam. Was hier steht, sieht das Gegenüber
// genauso: nur geteilte Objekte (Zusagen, Termine, Plan, Spielregeln, Feedback). Nur für die
// Käuferseite; die Akte des Lieferanten kommt mit LP-01. Scorecard und Team kommen aus ihren
// Diensten, mit deren Rechten.

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

/** „Nächste Wochen“: Termine und Fristen der nächsten vier Wochen */
const weeksAhead = 28;

type ConfirmState = 'draft' | 'buyer_confirmed' | 'supplier_confirmed' | 'both_confirmed';

/** Stand einer offenen Zusage aus Sicht des Käufers: Bestätigung vor Frist */
export function commitmentState(
  confirm: ConfirmState,
  dueOn: string,
  today: string,
): AkteCommitment['state'] {
  if (confirm === 'buyer_confirmed') return 'awaiting_counterpart';
  if (confirm === 'supplier_confirmed') return 'awaiting_own';
  return dueOn < today ? 'overdue' : 'open';
}

@Injectable()
export class AkteService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(JbpService) private readonly jbp: JbpService,
    @Inject(JbpScorecardService) private readonly scorecards: JbpScorecardService,
    @Inject(TeamService) private readonly teams: TeamService,
  ) {}

  /** Sicht Gemeinsam (`/beziehungen/<id>`) */
  async shared(auth: AuthContext, relationshipId: string): Promise<AkteShared> {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    const orgId = organization.id;
    const now = currentTime();
    const today = berlinDate(now);
    const year = Number(today.slice(0, 4));
    const until = offsetCycleDate(today, weeksAhead);

    const base = await this.tenant.run(
      { userId: auth.userId, organizationId: orgId },
      async (tx) => {
        const [relationship] = (
          await tx.execute<{ counterpart: string }>(sql`
            select o.name as counterpart from relationship r
            join organization o on o.id = r.supplier_org_id
            where r.id = ${relationshipId} and r.buyer_org_id = ${orgId}`)
        ).rows;
        if (!relationship) throw notFound();

        const quote = await commitmentQuote(tx, relationshipId, year);
        const open = (
          await tx.execute<{
            id: string;
            title: string;
            side: 'buyer' | 'supplier';
            owner_name: string;
            due_on: string;
            measure: string | null;
            source_type: string | null;
            plan_created: Date | string | null;
            owner_org_id: string;
            confirm_state: ConfirmState;
          }>(sql`
            select c.id, c.title, c.side, c.owner_name, c.due_on::text as due_on, c.measure,
              c.source_type, j.created_at as plan_created, c.owner_org_id, c.confirm_state
            from commitment c left join jbp j on j.id = c.jbp_id
            where c.relationship_id = ${relationshipId} and c.status = 'open'
              and c.confirm_state <> 'draft'
            order by c.due_on, c.created_at, c.id`)
        ).rows;
        const commitments: AkteCommitment[] = open.map((row) => ({
          id: row.id,
          title: row.title,
          side: row.side,
          ownerName: row.owner_name,
          dueOn: row.due_on,
          measure: row.measure,
          origin: (row.source_type ??
            (row.plan_created ? 'plan' : null)) as AkteCommitment['origin'],
          planYear: row.plan_created ? planYearOf(new Date(row.plan_created).toISOString()) : null,
          enteredBy: row.owner_org_id === orgId ? 'buyer' : 'supplier',
          state: commitmentState(row.confirm_state, row.due_on, today),
        }));
        const [last] = (
          await tx.execute<{ title: string; side: 'buyer' | 'supplier' }>(sql`
            select title, side from commitment
            where relationship_id = ${relationshipId} and status = 'kept'
              and confirm_state = 'both_confirmed'
              and extract(year from due_on) = ${year}
            order by done_at desc nulls last, due_on desc
            limit 1`)
        ).rows;

        // Nächste Wochen: geteilte Termine und Fristen offener Zusagen
        const meetings = (
          await tx.execute<{
            id: string;
            title: string;
            starts_at: Date | string;
            location: string | null;
          }>(sql`
            select m.id, m.title, m.starts_at, m.location from meeting m
            where m.relationship_id = ${relationshipId} and m.visibility = 'shared'
              and m.status = 'planned' and m.starts_at >= ${now.toISOString()}::timestamptz
              and m.starts_at < (${until}::date + 1)::timestamp at time zone 'Europe/Berlin'
            order by m.starts_at`)
        ).rows;
        const weeks: AkteWeek[] = [
          ...meetings.map((row) => ({
            kind: 'meeting' as const,
            id: row.id,
            startsAt: new Date(row.starts_at).toISOString(),
            title: row.title,
            location: row.location,
          })),
          ...commitments
            .filter((entry) => entry.dueOn >= today && entry.dueOn <= until)
            .map((entry) => ({
              kind: 'commitment' as const,
              id: entry.id,
              dueOn: entry.dueOn,
              title: entry.title,
              side: entry.side,
              state: entry.state,
            })),
        ].sort((a, b) => dayOf(a).localeCompare(dayOf(b)));

        const [plan] = (
          await tx.execute<{
            id: string;
            status: 'draft' | 'in_review' | 'approved';
            version: number;
            created_at: Date | string;
          }>(sql`
            select id, status, version, created_at from jbp
            where relationship_id = ${relationshipId} and visibility = 'shared'
            order by created_at desc, version desc
            limit 1`)
        ).rows;

        const ruleSets = (
          await tx.execute<{
            version: number;
            status: 'draft' | 'approved' | 'shared';
            type_name: string;
            approved_at: Date | string | null;
            created_at: Date | string;
          }>(sql`
            select version, status, type_name, approved_at, created_at from rule_set
            where relationship_id = ${relationshipId} and owner_org_id = ${orgId}
            order by version desc`)
        ).rows;
        const latestRules = ruleSets[0];
        const sharedRules = ruleSets.find((entry) => entry.status === 'shared');

        const waves = (
          await tx.execute<{
            id: string;
            kind: 'pulse' | 'annual';
            due_date: string;
            closed: boolean;
            revealed: boolean;
          }>(sql`
            select w.id, w.kind, w.due_date::text as due_date,
              (w.buyer_closed_at is not null and w.supplier_closed_at is not null) as closed,
              w.revealed_at is not null as revealed
            from survey_wave w
            where w.relationship_id = ${relationshipId} and w.visibility = 'shared'
            order by w.created_at desc
            limit 2`)
        ).rows;
        const feedback = [];
        for (const wave of waves) {
          const turnout = (
            await tx.execute<{ side: 'buyer' | 'supplier'; invited: number; completed: number }>(
              sql`select side, invited, completed from app_survey_turnout(${wave.id})`,
            )
          ).rows;
          const of = (side: 'buyer' | 'supplier') => {
            const row = turnout.find((entry) => entry.side === side);
            return { completed: Number(row?.completed ?? 0), invited: Number(row?.invited ?? 0) };
          };
          feedback.push({
            id: wave.id,
            kind: wave.kind,
            dueDate: wave.due_date,
            closed: wave.closed,
            revealed: wave.revealed,
            own: of('buyer'),
            counterpart: of('supplier'),
          });
        }

        return {
          counterpart: relationship.counterpart,
          quota: { own: quote.buyer, counterpart: quote.supplier },
          commitments,
          kept: { count: quote.buyer.kept + quote.supplier.kept, last: last ?? null },
          weeks,
          plan: plan
            ? {
                id: plan.id,
                status: plan.status,
                version: plan.version,
                year: planYearOf(new Date(plan.created_at).toISOString()),
              }
            : null,
          rules: latestRules
            ? {
                typeName: (sharedRules ?? latestRules).type_name,
                status: latestRules.status,
                since: sharedRules
                  ? new Date(sharedRules.approved_at ?? sharedRules.created_at).toISOString()
                  : null,
                unshared: latestRules.status !== 'shared',
              }
            : null,
          feedback,
        };
      },
      { readOnly: true },
    );

    // Scorecard des jüngsten Plans (JBP-09) und Team beider Seiten (PLT-05b), mit deren Rechten
    const card = await this.jbp.buyer(auth, relationshipId, (scope) => this.scorecards.view(scope));
    const team = await this.teams.team(auth, relationshipId);
    const periods = card.kpis.flatMap((kpi) => kpi.values.map((value) => value.period)).sort();

    return akteSharedSchema.parse({
      year,
      ...base,
      scorecard:
        card.hasPlan && card.kpis.length > 0
          ? {
              status: card.status,
              signed: {
                own: card.signatures.some((entry) => entry.side === 'buyer'),
                counterpart: card.signatures.some((entry) => entry.side === 'supplier'),
              },
              period: periods.at(-1) ?? null,
              kpis: card.kpis.map((kpi) => ({
                id: kpi.id,
                name: kpi.name,
                ownerSide: kpi.ownerSide,
                unit: kpi.unit,
                target: kpi.target,
                latest: kpi.values.at(-1) ?? null,
                track: kpi.track,
              })),
            }
          : null,
      team: {
        own: team.members.map((member) => ({ name: member.name, teamRole: member.teamRole })),
        counterpart: team.counterpart.map((member) => ({
          name: member.name,
          teamRole: member.teamRole,
        })),
      },
    });
  }
}

/** Tag eines Eintrags in Nächste Wochen, für die Sortierung */
function dayOf(entry: AkteWeek): string {
  return entry.kind === 'meeting' ? berlinDate(new Date(entry.startsAt)) : entry.dueOn;
}
