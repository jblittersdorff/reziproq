import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { currentTime, sql } from '@reziproq/db';
import {
  type AkteCommitment,
  type AkteCounterpart,
  type AkteCounterpartItem,
  type AkteHead,
  type AkteShared,
  type AkteWeek,
  akteCounterpartSchema,
  akteHeadSchema,
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
import { readSegments, readSpend } from './relationships.service.js';

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

  /** Kopf der Akte, für alle drei Sichten */
  async head(auth: AuthContext, relationshipId: string): Promise<AkteHead> {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    const orgId = organization.id;
    const year = Number(berlinDate(currentTime()).slice(0, 4));
    return this.tenant.run(
      { userId: auth.userId, organizationId: orgId },
      async (tx) => {
        const [row] = (
          await tx.execute<{
            name: string;
            status: 'draft' | 'active' | 'ended';
            is_focus: boolean;
            groups: string[];
            lead: string | null;
          }>(sql`
            select o.name, r.status, coalesce(s.is_focus, false) as is_focus,
              coalesce((
                select array_agg(g.name order by rg.is_primary desc, g.name)
                from relationship_material_group rg
                join material_group g on g.id = rg.material_group_id
                where rg.relationship_id = r.id
              ), '{}') as groups,
              (select u.name from relationship_material_group rg
                join material_group g on g.id = rg.material_group_id
                join app_user u on u.id = g.lead_user_id
                where rg.relationship_id = r.id
                order by rg.is_primary desc, g.name limit 1) as lead
            from relationship r
            join organization o on o.id = r.supplier_org_id
            left join relationship_side s on s.relationship_id = r.id and s.org_id = ${orgId}
            where r.id = ${relationshipId} and r.buyer_org_id = ${orgId}`)
        ).rows;
        if (!row) throw notFound();
        const { segments } = await readSegments(tx, orgId);
        const spend = await readSpend(tx, orgId, year);
        const [meeting] = (
          await tx.execute<{ id: string; type: string; title: string; starts_at: Date | string }>(
            sql`
            select id, type, title, starts_at from meeting
            where relationship_id = ${relationshipId} and visibility = 'shared'
              and status = 'planned' and type <> 'other'
              and starts_at >= ${currentTime().toISOString()}::timestamptz
            order by starts_at limit 1`,
          )
        ).rows;
        return akteHeadSchema.parse({
          relationshipId,
          name: row.name,
          status: row.status,
          segment: segments.get(relationshipId)?.ist ?? null,
          isFocus: row.is_focus,
          materialGroups: row.groups,
          lead: row.lead,
          year,
          spend: spend.get(relationshipId) ?? null,
          nextMeeting: meeting
            ? {
                id: meeting.id,
                type: meeting.type,
                title: meeting.title,
                startsAt: new Date(meeting.starts_at).toISOString(),
              }
            : null,
        });
      },
      { readOnly: true },
    );
  }

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
            shared_at: Date | string | null;
          }>(sql`
            select s.version, s.status, s.type_name, s.approved_at, s.created_at,
              t.shared_at
            from rule_set s
            left join relationship_target t on t.relationship_id = s.relationship_id
              and t.owner_org_id = s.owner_org_id and t.visibility = 'shared'
              and t.rule_set_version = s.version
            where s.relationship_id = ${relationshipId} and s.owner_org_id = ${orgId}
            order by s.version desc`)
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
                // Geteilte Spielregeln gelten ab dem Teilen (SEG-10), nicht ab der Freigabe
                since: sharedRules
                  ? new Date(
                      sharedRules.shared_at ?? sharedRules.approved_at ?? sharedRules.created_at,
                    ).toISOString()
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

  /**
   * Sicht Von <Gegenüber> (`?sicht=geteilt`, K2-c.4): was das Gegenüber aktiv geteilt hat, also
   * geteilte Zeilen, die ihm gehören (E-K0-31, E-K2-9): seine Kennzahlwerte (je Kennzahl der
   * jüngste), Themen fürs JBP, Kommentare, Unterschriften und die Lage im JBP. Dazu die Pflichten
   * aus der zuletzt geteilten Fassung der Spielregeln (SEG-10). Zusagen stehen in Gemeinsam.
   */
  async counterpart(auth: AuthContext, relationshipId: string): Promise<AkteCounterpart> {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    const orgId = organization.id;
    return this.tenant.run(
      { userId: auth.userId, organizationId: orgId },
      async (tx) => {
        const [relationship] = (
          await tx.execute<{ counterpart: string; other: string }>(sql`
            select o.name as counterpart, r.supplier_org_id as other from relationship r
            join organization o on o.id = r.supplier_org_id
            where r.id = ${relationshipId} and r.buyer_org_id = ${orgId}`)
        ).rows;
        if (!relationship) throw notFound();
        const other = relationship.other;

        const values = (
          await tx.execute<{
            id: string;
            kpi_id: string;
            name: string;
            unit: string;
            period: string;
            value: string;
            entered_by_name: string;
            entered_at: Date | string;
            confirm_state: ConfirmState;
          }>(sql`
            select distinct on (v.kpi_id) v.id, v.kpi_id, k.name, k.unit, v.period::text as period,
              v.value::text as value, v.entered_by_name, v.entered_at, v.confirm_state
            from kpi_value v join scorecard_kpi k on k.id = v.kpi_id
            where v.relationship_id = ${relationshipId} and v.owner_org_id = ${other}
              and v.visibility = 'shared'
            order by v.kpi_id, v.period desc, v.entered_at desc`)
        ).rows;
        const topics = (
          await tx.execute<{
            id: string;
            title: string;
            status: 'proposed' | 'merged' | 'parked';
            created_by_name: string;
            created_at: Date | string;
            plan_created: Date | string | null;
          }>(sql`
            select t.id, t.title, t.status, t.created_by_name, t.created_at,
              j.created_at as plan_created
            from jbp_topic t left join jbp j on j.id = t.jbp_id
            where t.relationship_id = ${relationshipId} and t.owner_org_id = ${other}
              and t.visibility = 'shared'`)
        ).rows;
        const comments = (
          await tx.execute<{
            id: string;
            object_type: AkteCounterpartComment['objectType'];
            object_id: string;
            author_name: string;
            body: string;
            created_at: Date | string;
            context: string | null;
          }>(sql`
            select c.id, c.object_type, c.object_id, c.author_name, c.body, c.created_at,
              case c.object_type
                when 'meeting' then (select m.title from meeting m where m.id = c.object_id)
                when 'commitment' then (select x.title from commitment x where x.id = c.object_id)
                when 'topic' then (select t.title from jbp_topic t where t.id = c.object_id)
              end as context
            from comment c
            where c.relationship_id = ${relationshipId} and c.owner_org_id = ${other}
              and c.visibility = 'shared' and c.deleted_at is null`)
        ).rows;
        const signatures = (
          await tx.execute<{
            id: string;
            user_name: string;
            signed_at: Date | string;
            plan_created: Date | string | null;
          }>(sql`
            select s.id, s.user_name, s.signed_at, j.created_at as plan_created
            from scorecard_signature s
            join scorecard sc on sc.id = s.scorecard_id
            left join jbp j on j.id = sc.jbp_id
            where s.relationship_id = ${relationshipId} and s.owner_org_id = ${other}
              and s.visibility = 'shared'`)
        ).rows;
        const updates = (
          await tx.execute<{
            id: string;
            text: string;
            updated_at: Date | string;
            plan_created: Date | string | null;
          }>(sql`
            select u.id, u.text, u.updated_at, j.created_at as plan_created
            from jbp_business_update u join jbp j on j.id = u.jbp_id
            where u.relationship_id = ${relationshipId} and u.owner_org_id = ${other}
              and u.visibility = 'shared' and length(trim(u.text)) > 0`)
        ).rows;
        const items: AkteCounterpartItem[] = [
          ...values.map((row) => ({
            kind: 'kpi_value' as const,
            id: row.id,
            at: iso(row.entered_at),
            personName: row.entered_by_name,
            kpiId: row.kpi_id,
            name: row.name,
            unit: row.unit,
            period: row.period,
            value: row.value,
            awaitingOwn: row.confirm_state === 'supplier_confirmed',
          })),
          ...topics.map((row) => ({
            kind: 'topic' as const,
            id: row.id,
            at: iso(row.created_at),
            personName: row.created_by_name,
            title: row.title,
            status: row.status,
            planYear: yearOfPlan(row.plan_created),
          })),
          ...comments.map((row) => ({
            kind: 'comment' as const,
            id: row.id,
            at: iso(row.created_at),
            personName: row.author_name,
            objectType: row.object_type,
            objectId: row.object_id,
            context: row.context,
            body: row.body,
          })),
          ...signatures.map((row) => ({
            kind: 'signature' as const,
            id: row.id,
            at: iso(row.signed_at),
            personName: row.user_name,
            planYear: yearOfPlan(row.plan_created),
          })),
          ...updates.map((row) => ({
            kind: 'business_update' as const,
            id: row.id,
            at: iso(row.updated_at),
            personName: null,
            planYear: yearOfPlan(row.plan_created),
            text: row.text,
          })),
        ].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));

        // Pflichten der Fassung, die das Gegenüber gerade sieht (SEG-10)
        const [rules] = (
          await tx.execute<{
            rule_set_id: string;
            version: number;
            type_name: string;
            shared_at: Date | string;
          }>(sql`
            select s.id as rule_set_id, t.rule_set_version as version, t.type_name, t.shared_at
            from relationship_target t
            join rule_set s on s.relationship_id = t.relationship_id
              and s.version = t.rule_set_version
            where t.relationship_id = ${relationshipId} and t.owner_org_id = ${orgId}
              and t.visibility = 'shared'
            limit 1`)
        ).rows;
        const duties = rules
          ? (
              await tx.execute<{
                id: string;
                title: { de: string; en: string };
                cadence: AkteCounterpartObligation['cadence'];
              }>(sql`
                select id, title, cadence from rule_set_item
                where rule_set_id = ${rules.rule_set_id} and kind = 'obligation'
                order by position, id`)
            ).rows
          : [];

        return akteCounterpartSchema.parse({
          counterpart: relationship.counterpart,
          items,
          obligations: rules
            ? {
                version: rules.version,
                typeName: rules.type_name,
                sharedAt: iso(rules.shared_at),
                items: duties.map((row) => ({
                  id: row.id,
                  title: row.title,
                  cadence: row.cadence,
                })),
              }
            : null,
        });
      },
      { readOnly: true },
    );
  }
}

type AkteCounterpartComment = Extract<AkteCounterpartItem, { kind: 'comment' }>;
type AkteCounterpartObligation = NonNullable<AkteCounterpart['obligations']>['items'][number];

/** Zeitpunkt aus der Datenbank als ISO-Text */
const iso = (value: Date | string) => new Date(value).toISOString();

/** Jahr des Plans aus seiner Anlage; ohne Plan null */
const yearOfPlan = (created: Date | string | null) => (created ? planYearOf(iso(created)) : null);

/** Tag eines Eintrags in Nächste Wochen, für die Sortierung */
function dayOf(entry: AkteWeek): string {
  return entry.kind === 'meeting' ? berlinDate(new Date(entry.startsAt)) : entry.dueOn;
}
