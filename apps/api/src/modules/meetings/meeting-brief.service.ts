import { createHash } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, desc, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  agendaMinutes,
  type BriefAgendaItem,
  type BriefContent,
  type BriefGoal,
  type BriefPart,
  type BriefSettings,
  briefContentSchemas,
  briefDraftKinds,
  briefParts,
  defaultBriefLeadDays,
  type EditBriefAgenda,
  earlyWarningRuleKeys,
  hasBindingCommitment,
  type MeetingBrief,
  type MeetingType,
  meetingBriefSchema,
  meetingTypes,
  planAgendaMinutes,
  progressFromBaseline,
  type SurveyDimension,
  withStartTimes,
} from '@reziproq/shared';
import { NotificationBus } from '../../common/notification-bus.js';
import { ActionsService } from '../actions/actions.service.js';
import {
  createBuyerDraft,
  draftDecision,
  draftEvidence,
  ownDraftSource,
} from '../ai-drafts/evidence.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { type MeetingScope, MeetingsService } from './meetings.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

type DraftRow = typeof schema.aiDraft.$inferSelect;
type Source = ReturnType<typeof ownDraftSource>;
interface Claim {
  text: string;
  sources: [Source, ...Source[]];
}
interface PartResult<P extends BriefPart> {
  data: BriefContent[P];
  claims: Claim[];
}

const dimensionNames: Record<SurveyDimension, string> = {
  trust: 'Vertrauen',
  collaboration: 'Zusammenarbeit',
  integration: 'Integration',
  transparency: 'Transparenz',
  strategy: 'Strategie',
};
const number = (value: string | number) =>
  new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(Number(value));
const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const money = (cents: number) => euro.format(Math.round(cents / 100));
const day = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const kinds = Object.values(briefDraftKinds);
const partOfKind = Object.fromEntries(
  Object.entries(briefDraftKinds).map(([part, kind]) => [kind, part as BriefPart]),
) as Record<string, BriefPart>;
const berlinTime = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const berlinDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' });
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Was das Briefing liest; daraus entstehen Teile und Prüfsumme. */
export interface BriefInputs {
  meeting: {
    id: string;
    type: MeetingType;
    title: string;
    startsAt: string;
    durationMinutes: number;
    participants: { name: string; side: 'buyer' | 'supplier' }[];
  };
  supplier: string;
  team: { userId: string; name: string; teamRole: string }[];
  spend: { year: number; cents: number; previous: number | null } | null;
  kpis: {
    id: string;
    name: string;
    unit: string;
    latest: number;
    target: number;
    targetDate: string;
    period: string | null;
  }[];
  commitments: {
    id: string;
    title: string;
    side: 'buyer' | 'supplier';
    dueOn: string;
    ownerUserId: string | null;
    ownerName: string;
  }[];
  feedbackGaps: { id: string; dimension: SurveyDimension; buyer: number; supplier: number }[];
  opportunities: { id: string; title: string; low: number; high: number }[];
  dataGaps: { id: string; description: string }[];
  hints: { id: string; ruleKey: string; title: string | null }[];
  topics: { id: string; title: string; side: 'buyer' | 'supplier' }[];
  signals: { id: string; title: string }[];
  /** KI-17: übernommene offene Fragen früherer Termine dieser Beziehung */
  earlierQuestions: { id: string; text: string; meetingTitle: string }[];
  notes: number;
  previousQuestions: {
    text: string;
    actionId: string;
    answer: string | null;
  }[];
}

interface Candidate {
  goal: Omit<BriefGoal, 'key'>;
  agendaTitle: string;
  subline: string | null;
  supplierQuestion: string;
  supplierLeads: boolean;
  source: Source;
}

/**
 * KI-07 Termin-Briefing: Lage, Ziele, Agenda mit Zeiten, was geklärt werden muss, Risiken und offene
 * Punkte, je als Entwurf mit Quelle (KI-03). Zahlen und Zeiten rechnet der Code; das Modell
 * formuliert höchstens die Lage. Nur der Käufer sieht das Briefing; die Agenda wird erst beim
 * Übernehmen geteilt, ohne Ziele, interne Fragen oder Antwortvorschläge.
 */
@Injectable()
export class MeetingBriefService {
  constructor(
    @Inject(MeetingsService) private readonly meetings: MeetingsService,
    @Inject(ActionsService) private readonly actions: ActionsService,
    @Inject(NotificationBus) private readonly bus: NotificationBus,
  ) {}

  private canDecide(scope: MeetingScope) {
    return scope.side === 'buyer' && (scope.auth.orgRole === 'admin' || scope.teamRole === 'sro');
  }

  private async meetingRow(scope: MeetingScope, meetingId: string) {
    const [row] = await scope.tx
      .select()
      .from(schema.meeting)
      .where(
        and(
          eq(schema.meeting.id, meetingId),
          eq(schema.meeting.relationshipId, scope.relationshipId),
        ),
      );
    if (!row) throw notFound();
    return row;
  }

  /** Alles, was das Briefing liest, im Umfang der Session des Käufers */
  async inputs(scope: MeetingScope, meetingId: string, today = new Date()): Promise<BriefInputs> {
    const { tx, relationshipId, orgId } = scope;
    const meeting = await this.meetingRow(scope, meetingId);
    const meetingDay = berlinDay.format(meeting.startsAt);
    const todayIso = today.toISOString().slice(0, 10);
    const participants = await tx
      .select({
        name: schema.meetingParticipant.name,
        ownerOrgId: schema.meetingParticipant.ownerOrgId,
      })
      .from(schema.meetingParticipant)
      .where(eq(schema.meetingParticipant.meetingId, meetingId))
      .orderBy(schema.meetingParticipant.ownerOrgId, schema.meetingParticipant.position);
    const [name] = await tx
      .execute<{ name: string }>(sql`
      select coalesce(s.display_name, o.name) as name from relationship r
      join organization o on o.id = r.supplier_org_id
      left join relationship_side s on s.relationship_id = r.id and s.org_id = ${orgId}
      where r.id = ${relationshipId}`)
      .then((result) => result.rows);
    const team = await tx
      .select({
        userId: schema.relationshipMember.userId,
        name: schema.appUser.name,
        teamRole: schema.relationshipMember.teamRole,
      })
      .from(schema.relationshipMember)
      .innerJoin(schema.appUser, eq(schema.appUser.id, schema.relationshipMember.userId))
      .where(
        and(
          eq(schema.relationshipMember.relationshipId, relationshipId),
          eq(schema.relationshipMember.orgId, orgId),
        ),
      )
      .orderBy(schema.appUser.name);
    const spendRows = await tx.execute<{ year: number; cents: string }>(sql`
      select year, sum(amount_cents)::text as cents from relationship_spend
      where relationship_id = ${relationshipId} and kind = 'actual'
      group by year order by year desc limit 2`);
    const [latestSpend, previousSpend] = spendRows.rows;

    // Kennzahlen hinter Plan: Fortschritt von der Basis zum Ziel bleibt um mehr als zehn Punkte
    // hinter der verstrichenen Zeit zurück; ohne Basis zählt ein verfehltes Ziel nach Ablauf.
    const kpiRows = await tx
      .select({
        id: schema.scorecardKpi.id,
        name: schema.scorecardKpi.name,
        unit: schema.scorecardKpi.unit,
        direction: schema.scorecardKpi.direction,
        baseline: schema.scorecardKpi.baseline,
        target: schema.scorecardKpi.target,
        targetDate: schema.scorecardKpi.targetDate,
        createdAt: schema.scorecardKpi.createdAt,
        latest: sql<
          string | null
        >`(select v.value from kpi_value v where v.kpi_id = scorecard_kpi.id order by v.period desc limit 1)`,
        period: sql<
          string | null
        >`(select v.period::text from kpi_value v where v.kpi_id = scorecard_kpi.id order by v.period desc limit 1)`,
      })
      .from(schema.scorecardKpi)
      .where(eq(schema.scorecardKpi.relationshipId, relationshipId))
      .orderBy(schema.scorecardKpi.name);
    const kpis: BriefInputs['kpis'] = [];
    for (const kpi of kpiRows) {
      if (kpi.latest === null) continue;
      const latest = Number(kpi.latest);
      const target = Number(kpi.target);
      const start = kpi.createdAt.getTime();
      const end = new Date(`${kpi.targetDate}T00:00:00Z`).getTime();
      const elapsed =
        end > start ? Math.min(1, Math.max(0, (today.getTime() - start) / (end - start))) : 1;
      const progress = progressFromBaseline(
        kpi.baseline === null ? null : Number(kpi.baseline),
        target,
        latest,
      );
      const reached = kpi.direction === 'higher' ? latest >= target : latest <= target;
      const behind =
        progress !== null ? progress < elapsed - 0.1 : todayIso > kpi.targetDate && !reached;
      if (behind) {
        kpis.push({
          id: kpi.id,
          name: kpi.name,
          unit: kpi.unit,
          latest,
          target,
          targetDate: kpi.targetDate,
          period: kpi.period,
        });
      }
    }

    const commitments = await tx
      .select({
        id: schema.commitment.id,
        title: schema.commitment.title,
        side: schema.commitment.side,
        dueOn: schema.commitment.dueOn,
        ownerUserId: schema.commitment.ownerUserId,
        ownerName: schema.commitment.ownerName,
      })
      .from(schema.commitment)
      .where(
        and(
          eq(schema.commitment.relationshipId, relationshipId),
          eq(schema.commitment.status, 'open'),
          sql`${schema.commitment.dueOn} <= ${meetingDay}::date`,
        ),
      )
      .orderBy(schema.commitment.dueOn, schema.commitment.title);

    const results = await tx.execute<{
      id: string;
      dimension: SurveyDimension;
      side: 'buyer' | 'supplier';
      ist_mean: string | null;
    }>(sql`
      select r.id, r.dimension, r.side, r.ist_mean from survey_result r
      where r.relationship_id = ${relationshipId} and r.function is null and r.question_key is null
        and r.wave_id = (
          select r2.wave_id from survey_result r2 join survey_wave w on w.id = r2.wave_id
          where r2.relationship_id = ${relationshipId} order by w.created_at desc limit 1)
      order by r.dimension`);
    const feedbackGaps: BriefInputs['feedbackGaps'] = [];
    for (const dimension of new Set(results.rows.map((row) => row.dimension))) {
      const buyer = results.rows.find((row) => row.dimension === dimension && row.side === 'buyer');
      const supplier = results.rows.find(
        (row) => row.dimension === dimension && row.side === 'supplier',
      );
      if (!buyer?.ist_mean || !supplier?.ist_mean) continue;
      if (Math.abs(Number(buyer.ist_mean) - Number(supplier.ist_mean)) < 0.5) continue;
      feedbackGaps.push({
        id: buyer.id,
        dimension,
        buyer: Number(buyer.ist_mean),
        supplier: Number(supplier.ist_mean),
      });
    }

    const opportunities = await tx
      .select({
        id: schema.valueOpportunity.id,
        title: schema.valueOpportunity.title,
        low: schema.valueOpportunity.buyerLowCents,
        high: schema.valueOpportunity.buyerHighCents,
      })
      .from(schema.valueOpportunity)
      .where(
        and(
          eq(schema.valueOpportunity.relationshipId, relationshipId),
          eq(schema.valueOpportunity.orgId, orgId),
          eq(schema.valueOpportunity.status, 'new'),
          inArray(schema.valueOpportunity.confidence, ['high', 'medium']),
        ),
      )
      .orderBy(desc(schema.valueOpportunity.buyerHighCents), schema.valueOpportunity.id)
      .limit(2);
    const dataGaps = await tx
      .select({ id: schema.valueDataGap.id, description: schema.valueDataGap.description })
      .from(schema.valueDataGap)
      .where(
        and(
          eq(schema.valueDataGap.relationshipId, relationshipId),
          eq(schema.valueDataGap.orgId, orgId),
          eq(schema.valueDataGap.status, 'open'),
        ),
      )
      .orderBy(schema.valueDataGap.createdAt, schema.valueDataGap.id)
      .limit(2);
    const hints = await tx
      .select({ id: schema.hint.id, ruleKey: schema.hint.ruleKey, title: schema.hint.title })
      .from(schema.hint)
      .where(
        and(
          eq(schema.hint.orgId, orgId),
          eq(schema.hint.relationshipId, relationshipId),
          inArray(schema.hint.status, ['open', 'in_progress']),
          inArray(schema.hint.ruleKey, [...earlyWarningRuleKeys]),
        ),
      )
      .orderBy(desc(schema.hint.score), schema.hint.id);
    const [plan] = await tx
      .select({ id: schema.jbp.id })
      .from(schema.jbp)
      .where(eq(schema.jbp.relationshipId, relationshipId))
      .orderBy(desc(schema.jbp.createdAt))
      .limit(1);
    const topics = plan
      ? await tx
          .select({
            id: schema.jbpTopic.id,
            title: schema.jbpTopic.title,
            side: schema.jbpTopic.side,
          })
          .from(schema.jbpTopic)
          .where(and(eq(schema.jbpTopic.jbpId, plan.id), eq(schema.jbpTopic.status, 'proposed')))
          .orderBy(schema.jbpTopic.priority, schema.jbpTopic.id)
      : [];
    const signals = await tx
      .select({ id: schema.valueMarketSignal.id, title: schema.valueMarketSignal.title })
      .from(schema.valueMarketSignal)
      .where(
        and(
          eq(schema.valueMarketSignal.relationshipId, relationshipId),
          eq(schema.valueMarketSignal.orgId, orgId),
          sql`${schema.valueMarketSignal.outcome} <> 'no_effect'`,
        ),
      )
      .orderBy(desc(schema.valueMarketSignal.observedAt), schema.valueMarketSignal.id)
      .limit(3);
    const [notes] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.note)
      .where(eq(schema.note.relationshipId, relationshipId));
    const earlier = await tx.execute<{ id: string; content: string; title: string }>(sql`
      select d.id, d.content, m.title from ai_draft d
      join meeting m on m.id = d.object_id
      where d.org_id = ${orgId} and d.relationship_id = ${relationshipId}
        and d.kind = 'capture_question' and d.status = 'accepted' and d.object_id <> ${meetingId}
      order by d.decided_at desc limit 3`);
    const earlierQuestions = earlier.rows.flatMap((row) => {
      try {
        const item = JSON.parse(row.content) as { title?: string };
        return item.title ? [{ id: row.id, text: item.title, meetingTitle: row.title }] : [];
      } catch {
        return [];
      }
    });

    return {
      meeting: {
        id: meeting.id,
        type: meeting.type,
        title: meeting.title,
        startsAt: meeting.startsAt.toISOString(),
        durationMinutes: meeting.durationMinutes,
        participants: participants.map((row) => ({
          name: row.name,
          side: row.ownerOrgId === scope.buyerOrgId ? ('buyer' as const) : ('supplier' as const),
        })),
      },
      supplier: name?.name ?? '',
      team,
      spend: latestSpend
        ? {
            year: latestSpend.year,
            cents: Number(latestSpend.cents),
            previous: previousSpend ? Number(previousSpend.cents) : null,
          }
        : null,
      kpis,
      commitments,
      feedbackGaps,
      opportunities,
      dataGaps,
      hints,
      topics,
      signals,
      earlierQuestions,
      notes: notes?.count ?? 0,
      previousQuestions: await this.previousQuestions(tx, orgId, meetingId),
    };
  }

  /** Gesendete Fragen des letzten Briefings mit der Antwort aus der Aufgabe (Kommentar) */
  private async previousQuestions(tx: TenantTransaction, orgId: string, meetingId: string) {
    const [row] = await tx
      .select()
      .from(schema.aiDraft)
      .where(
        and(
          eq(schema.aiDraft.orgId, orgId),
          eq(schema.aiDraft.objectId, meetingId),
          eq(schema.aiDraft.kind, briefDraftKinds.internalQuestions),
          inArray(schema.aiDraft.status, ['draft', 'accepted']),
        ),
      )
      .orderBy(desc(schema.aiDraft.createdAt), desc(schema.aiDraft.id))
      .limit(1);
    if (!row) return [];
    const parsed = briefContentSchemas.internalQuestions.safeParse(safeJson(row.content));
    if (!parsed.success) return [];
    const sent = parsed.data.questions.filter(
      (question): question is typeof question & { actionId: string } => question.actionId !== null,
    );
    if (sent.length === 0) return [];
    const comments = await tx
      .select({ objectId: schema.comment.objectId, body: schema.comment.body })
      .from(schema.comment)
      .where(
        and(
          eq(schema.comment.objectType, 'action'),
          inArray(
            schema.comment.objectId,
            sent.map((question) => question.actionId),
          ),
          sql`${schema.comment.deletedAt} is null`,
        ),
      )
      .orderBy(desc(schema.comment.createdAt));
    return sent.map((question) => ({
      text: question.text,
      actionId: question.actionId,
      answer: comments.find((comment) => comment.objectId === question.actionId)?.body ?? null,
    }));
  }

  /**
   * Prüfsummen: „meeting“ über Zeit, Dauer und Teilnehmer (bei Änderung läuft der Agent erneut),
   * „all“ über alle gelesenen Objekte (ohne Änderung startet kein neuer Lauf).
   */
  checksum(inputs: BriefInputs) {
    const { id, startsAt, durationMinutes, participants } = inputs.meeting;
    return `${sha({ id, startsAt, durationMinutes, participants }).slice(0, 16)}:${sha(inputs).slice(0, 32)}`;
  }

  /** Drei Sätze zur Lage, jede Zahl aus der Datenbank */
  situation(inputs: BriefInputs, meetingSource: Source): Claim[] {
    const sentences: Claim[] = [];
    const supplier = inputs.supplier;
    if (inputs.spend) {
      const growth =
        inputs.spend.previous && inputs.spend.previous > 0
          ? Math.round(((inputs.spend.cents - inputs.spend.previous) / inputs.spend.previous) * 100)
          : null;
      sentences.push({
        text: `${supplier} hat bei euch ${inputs.spend.year} einen Spend von ${money(inputs.spend.cents)}${
          growth === null
            ? ''
            : `, ${growth >= 0 ? 'plus' : 'minus'} ${Math.abs(growth)} % zum Vorjahr`
        }.`,
        sources: [ownDraftSource('relationship', inputs.meeting.id, `Spend ${inputs.spend.year}`)],
      });
    }
    const risks = this.risks(inputs);
    const [firstRisk] = risks;
    if (firstRisk) {
      sentences.push({
        text: `Vor dem Termin stehen ${risks.length === 1 ? 'ein Risiko' : `${risks.length} Risiken`} offen, zuerst: ${firstRisk.text}`,
        sources: firstRisk.sources,
      });
    } else {
      sentences.push({
        text: 'Keine Kennzahl liegt hinter Plan, und keine Zusage ist überfällig.',
        sources: [meetingSource],
      });
    }
    const [chance] = inputs.opportunities;
    if (chance) {
      sentences.push({
        text: `Der Wertpotenzial-Finder sieht ${money(chance.low)} bis ${money(chance.high)} EBIT im Jahr, vor allem über ${chance.title}.`,
        sources: [ownDraftSource('value_opportunity', chance.id, chance.title)],
      });
    } else if (inputs.topics.length > 0) {
      const [first, ...rest] = inputs.topics.map((topic) =>
        ownDraftSource('jbp_topic', topic.id, topic.title),
      );
      sentences.push({
        text: `Im Gemeinsamen Plan sind ${inputs.topics.length === 1 ? 'ein Thema' : `${inputs.topics.length} Themen`} offen.`,
        sources: [first as Source, ...rest],
      });
    }
    return sentences.slice(0, 3);
  }

  private risks(inputs: BriefInputs): Claim[] {
    const risks: Claim[] = [];
    for (const kpi of inputs.kpis) {
      risks.push({
        text: `„${kpi.name}“ liegt bei ${number(kpi.latest)} ${kpi.unit}, Ziel ${number(kpi.target)} ${kpi.unit}.`,
        sources: [ownDraftSource('scorecard_kpi', kpi.id, kpi.name, kpi.period)],
      });
    }
    const today = new Date().toISOString().slice(0, 10);
    for (const entry of inputs.commitments.filter((item) => item.dueOn < today)) {
      risks.push({
        text: `Zusage „${entry.title}“ (${entry.side === 'buyer' ? 'eure Seite' : inputs.supplier}) war am ${day(entry.dueOn)} fällig.`,
        sources: [ownDraftSource('commitment', entry.id, entry.title, entry.dueOn)],
      });
    }
    for (const hint of inputs.hints) {
      if (!hint.title) continue;
      if (hint.ruleKey === 'performance_drop' || hint.ruleKey === 'supplier_commitment_overdue')
        continue;
      risks.push({
        text: `Hinweis offen: ${hint.title}.`,
        sources: [ownDraftSource('hint', hint.id, hint.title)],
      });
    }
    for (const gap of inputs.feedbackGaps) {
      const name = dimensionNames[gap.dimension] ?? gap.dimension;
      risks.push({
        text: `Feedback-Lücke bei ${name}: eure Seite ${number(gap.buyer)}, ${inputs.supplier} ${number(gap.supplier)}.`,
        sources: [ownDraftSource('survey_result', gap.id, `Feedback ${name}`)],
      });
    }
    return risks.slice(0, 12);
  }

  /** Ziele mit „Erreicht, wenn …“, je mit Verweis auf das Objekt; Schwerpunkt nach Termintyp */
  private candidates(inputs: BriefInputs) {
    const supplier = inputs.supplier;
    const today = new Date().toISOString().slice(0, 10);
    const byKind: Record<string, Candidate[]> = {
      kpi: inputs.kpis.map((kpi) => ({
        goal: {
          title: `„${kpi.name}“ wieder auf Kurs bringen`,
          reachedWhen: `${supplier} nennt die Ursachen und einen Termin, bis wann ${kpi.name} das Ziel von ${number(kpi.target)} ${kpi.unit} erreicht.`,
          ref: { objectType: 'scorecard_kpi', objectId: kpi.id, title: kpi.name },
        },
        agendaTitle: `${kpi.name}: Stand und Maßnahmen`,
        subline: `Stand ${number(kpi.latest)} ${kpi.unit}, Zielwert ${number(kpi.target)} ${kpi.unit}`,
        supplierQuestion: `Was sind die Ursachen bei ${kpi.name}, und bis wann seid ihr wieder beim Zielwert?`,
        supplierLeads: true,
        source: ownDraftSource('scorecard_kpi', kpi.id, kpi.name, kpi.period),
      })),
      commitment: inputs.commitments
        .filter((entry) => entry.side === 'supplier' && entry.dueOn < today)
        .map((entry) => ({
          goal: {
            title: `Zusage „${entry.title}“ abschließen`,
            reachedWhen: `${supplier} nennt einen neuen, verbindlichen Termin für „${entry.title}“.`,
            ref: { objectType: 'commitment', objectId: entry.id, title: entry.title },
          },
          agendaTitle: 'Offene Zusagen',
          subline: `${entry.title}, fällig ${day(entry.dueOn)}`,
          supplierQuestion: `Bis wann liefert ihr „${entry.title}“?`,
          supplierLeads: true,
          source: ownDraftSource('commitment', entry.id, entry.title, entry.dueOn),
        })),
      opportunity: inputs.opportunities.map((chance) => ({
        goal: {
          title: `${chance.title} anstoßen`,
          reachedWhen: `${supplier} ist bereit, den Vorschlag gemeinsam zu prüfen, und nennt einen Termin für ein Angebot.`,
          ref: { objectType: 'value_opportunity', objectId: chance.id, title: chance.title },
        },
        agendaTitle: `Vorschlag: ${chance.title}`,
        subline: null,
        supplierQuestion: `Wäre das für euch denkbar: ${chance.title}? Was braucht ihr dafür?`,
        supplierLeads: false,
        source: ownDraftSource('value_opportunity', chance.id, chance.title),
      })),
      hint: inputs.hints.flatMap((hint): Candidate[] => {
        const source = ownDraftSource('hint', hint.id, hint.title ?? 'Hinweis');
        const ref = { objectType: 'hint', objectId: hint.id, title: hint.title ?? 'Hinweis' };
        if (hint.ruleKey === 'dependency')
          return [
            {
              goal: {
                title: 'Versorgung absichern',
                reachedWhen: `${supplier} nennt Kapazität und Liefermöglichkeiten für die nächsten zwölf Monate.`,
                ref,
              },
              agendaTitle: 'Kapazität und Versorgung',
              subline: null,
              supplierQuestion: 'Wie sichert ihr Kapazität für unsere Mengen im nächsten Jahr?',
              supplierLeads: true,
              source,
            },
          ];
        if (hint.ruleKey === 'public_event')
          return [
            {
              goal: {
                title: `Lage bei ${supplier} klären`,
                reachedWhen: `${supplier} erklärt, was die aktuelle Lage für die Lieferungen an euch bedeutet.`,
                ref,
              },
              agendaTitle: `Aktuelle Lage bei ${supplier}`,
              subline: null,
              supplierQuestion: 'Was bedeutet die aktuelle Lage für eure Lieferungen an uns?',
              supplierLeads: true,
              source,
            },
          ];
        if (hint.ruleKey === 'feedback_drop')
          return [
            {
              goal: {
                title: 'Zusammenarbeit verbessern',
                reachedWhen:
                  'Beide Seiten vereinbaren zwei Punkte, die die Zusammenarbeit verbessern.',
                ref,
              },
              agendaTitle: 'Zusammenarbeit',
              subline: null,
              supplierQuestion: 'Was sollten wir in der Zusammenarbeit ändern?',
              supplierLeads: false,
              source,
            },
          ];
        return [];
      }),
      topic: inputs.topics.map((topic) => ({
        goal:
          topic.side === 'supplier'
            ? {
                title: `Thema „${topic.title}“ von ${supplier} klären`,
                reachedWhen: `Beide Seiten einigen sich, ob „${topic.title}“ in den Plan kommt.`,
                ref: { objectType: 'jbp_topic', objectId: topic.id, title: topic.title },
              }
            : {
                title: `Eigenes Thema „${topic.title}“ platzieren`,
                reachedWhen: `${supplier} sagt zu, „${topic.title}“ im Plan mitzutragen.`,
                ref: { objectType: 'jbp_topic', objectId: topic.id, title: topic.title },
              },
        agendaTitle: topic.title,
        subline: topic.side === 'supplier' ? `Thema von ${supplier}` : 'Thema von uns',
        supplierQuestion: `Was erwartet ihr beim Thema „${topic.title}“?`,
        supplierLeads: topic.side === 'supplier',
        source: ownDraftSource('jbp_topic', topic.id, topic.title),
      })),
    };
    const order: Record<MeetingType, string[]> = {
      quarterly_review: ['kpi', 'commitment', 'hint', 'opportunity', 'topic'],
      jbp: ['topic', 'opportunity', 'kpi', 'commitment', 'hint'],
      negotiation: ['opportunity', 'commitment', 'kpi', 'hint', 'topic'],
      site_visit: ['kpi', 'hint', 'commitment', 'topic', 'opportunity'],
      escalation: ['hint', 'kpi', 'commitment', 'opportunity', 'topic'],
      strategy_dialogue: ['topic', 'opportunity', 'kpi', 'hint', 'commitment'],
      format: ['kpi', 'commitment', 'opportunity', 'hint', 'topic'],
      other: ['kpi', 'commitment', 'opportunity', 'hint', 'topic'],
    };
    return order[inputs.meeting.type].flatMap((kind) => byKind[kind] ?? []);
  }

  /** Alle acht Teile aus den Eingaben; die Lage kann das Modell umformulieren. */
  build(inputs: BriefInputs, summary?: string) {
    const supplier = inputs.supplier;
    const meetingSource = ownDraftSource('meeting', inputs.meeting.id, inputs.meeting.title);
    const parts: { [P in BriefPart]?: PartResult<P> } = {};

    // Lage
    const sentences = this.situation(inputs, meetingSource);
    const modelText = summary ? acceptedSummary(summary, sentences) : null;
    const situationClaims: Claim[] = modelText
      ? [
          {
            text: modelText,
            sources: sentences.flatMap((sentence) => sentence.sources) as [Source, ...Source[]],
          },
        ]
      : sentences;
    parts.situation = {
      data: {
        sentences: modelText
          ? splitSentences(modelText)
          : sentences.map((sentence) => sentence.text),
      },
      claims: situationClaims,
    };

    // Ziele: zwei bis vier, so viele, wie die Agenda Platz hat
    const candidates = this.candidates(inputs);
    const room = planAgendaMinutes(inputs.meeting.durationMinutes, 4).topics.length;
    const chosen = candidates.slice(0, Math.min(4, room));
    const fallback: Candidate = {
      goal: {
        title: 'Nächste Schritte vereinbaren',
        reachedWhen:
          'Beide Seiten vereinbaren Verantwortliche und Termine für die nächsten Schritte.',
        ref: { objectType: 'meeting', objectId: inputs.meeting.id, title: inputs.meeting.title },
      },
      agendaTitle: 'Themen beider Seiten',
      subline: null,
      supplierQuestion: 'Welche Themen sind euch für die nächsten Monate am wichtigsten?',
      supplierLeads: false,
      source: meetingSource,
    };
    const goals = chosen.length > 0 ? chosen : [fallback];
    const goalList: BriefGoal[] = goals.map((entry, index) => ({
      key: `g${index + 1}`,
      ...entry.goal,
    }));
    parts.goals = {
      data: { goals: goalList },
      claims: goals.map((entry) => ({
        text: `${entry.goal.title}. Erreicht, wenn ${entry.goal.reachedWhen}`,
        sources: [entry.source],
      })),
    };

    // Agenda: Zeiten rechnet der Code, wer führt nur aus der Teilnehmerliste
    const buyers = inputs.meeting.participants.filter((entry) => entry.side === 'buyer');
    const suppliers = inputs.meeting.participants.filter((entry) => entry.side === 'supplier');
    const plan = planAgendaMinutes(inputs.meeting.durationMinutes, goals.length);
    const host = buyers[0]?.name;
    const pauseAfter = Math.ceil(plan.topics.length / 2);
    const goalTexts = goalList.flatMap((goal) => [goal.title, goal.reachedWhen]);
    const cleanSubline = (text: string | null) =>
      text && !goalTexts.some((goal) => text.includes(goal) || goal === text) ? text : null;
    const draftItems: Omit<BriefAgendaItem, 'start'>[] = [
      {
        key: 'a0',
        kind: 'welcome',
        minutes: plan.welcome,
        title: 'Begrüßung und Ziele des Termins',
        subline: null,
        leads: host ? [host] : [],
        goalKey: null,
      },
    ];
    plan.topics.forEach((minutes, index) => {
      const entry = goals[index] as Candidate;
      const leads = [
        buyers[index % Math.max(1, buyers.length)]?.name,
        entry.supplierLeads ? suppliers[index % Math.max(1, suppliers.length)]?.name : undefined,
      ].filter((value): value is string => Boolean(value));
      draftItems.push({
        key: `a${index + 1}`,
        kind: 'topic',
        minutes,
        title: entry.agendaTitle,
        subline: cleanSubline(entry.subline),
        leads: [...new Set(leads)],
        goalKey: goalList[index]?.key ?? null,
      });
      if (plan.pause > 0 && index + 1 === pauseAfter && index + 1 < plan.topics.length) {
        draftItems.push({
          key: 'pause',
          kind: 'break',
          minutes: plan.pause,
          title: 'Pause',
          subline: null,
          leads: [],
          goalKey: null,
        });
      }
    });
    if (plan.pause > 0 && !draftItems.some((item) => item.kind === 'break')) {
      // Nur ein Thema: die Pause steht davor, damit die Summe stimmt.
      draftItems.splice(1, 0, {
        key: 'pause',
        kind: 'break',
        minutes: plan.pause,
        title: 'Pause',
        subline: null,
        leads: [],
        goalKey: null,
      });
    }
    draftItems.push({
      key: 'close',
      kind: 'closing',
      minutes: plan.closing,
      title: 'Zusagen und nächste Schritte',
      subline: 'Wer macht was bis wann',
      leads: host ? [host] : [],
      goalKey: null,
    });
    const items = withStartTimes(berlinTime.format(new Date(inputs.meeting.startsAt)), draftItems);
    const omitted = [
      ...candidates.slice(goals === chosen ? chosen.length : 0, chosen.length + 2).map((entry) => ({
        topic: entry.agendaTitle,
        reason: 'Kein Platz in der Agenda; Vorschlag: im nächsten Termin.',
      })),
      ...inputs.feedbackGaps.slice(0, 1).map((gap) => ({
        topic: `${dimensionNames[gap.dimension]} (Feedback-Lücke ${number(Math.abs(gap.buyer - gap.supplier))})`,
        reason: 'Vorschlag von Reziproq: ein eigener Termin mit den Feedback-Ergebnissen.',
      })),
    ].slice(0, 3);
    parts.agenda = {
      data: { items, omitted },
      claims: items.map((item) => {
        const goalIndex = goalList.findIndex((goal) => goal.key === item.goalKey);
        return {
          text: `${item.start} ${item.title} (${item.minutes} Min.)`,
          sources: [goalIndex >= 0 ? (goals[goalIndex] as Candidate).source : meetingSource],
        };
      }),
    };

    // Vorher intern klären: an Personen im Team, mit Anlass
    const sro = inputs.team.find((member) => member.teamRole === 'sro') ?? inputs.team[0];
    const helper =
      inputs.team.find((member) => member.teamRole !== 'sro' && member.teamRole !== 'viewer') ??
      sro;
    const person = (member: { userId: string; name: string } | undefined) =>
      member ? { userId: member.userId, name: member.name } : { userId: null, name: 'Team' };
    const internal: {
      text: string;
      occasion: string;
      addressee: ReturnType<typeof person>;
      source: Source;
    }[] = [];
    for (const entry of inputs.commitments.filter((item) => item.side === 'buyer')) {
      const owner = inputs.team.find((member) => member.userId === entry.ownerUserId);
      internal.push({
        text: `Wer erledigt „${entry.title}“ bis zum Termin?`,
        occasion: `Zusage eurer Seite, fällig ${day(entry.dueOn)}`,
        addressee: owner ? person(owner) : person(sro),
        source: ownDraftSource('commitment', entry.id, entry.title, entry.dueOn),
      });
    }
    for (const gap of inputs.dataGaps) {
      internal.push({
        text: `Woher bekommen wir diese Angabe: ${gap.description}?`,
        occasion: 'Datenlücke im Wertpotenzial-Finder',
        addressee: person(helper),
        source: ownDraftSource('value_data_gap', gap.id, gap.description),
      });
    }
    for (const entry of goals.filter((item) => item.goal.ref.objectType === 'value_opportunity')) {
      internal.push({
        text: `Wie weit dürfen wir beim Vorschlag „${entry.goal.ref.title}“ gehen?`,
        occasion: `Ziel: ${entry.goal.title}`,
        addressee: person(sro),
        source: entry.source,
      });
    }
    const previous = new Map(inputs.previousQuestions.map((item) => [item.text, item]));
    const internalQuestions = internal.slice(0, 6).map((entry, index) => ({
      key: `q${index + 1}`,
      text: entry.text,
      occasion: entry.occasion,
      addressee: entry.addressee,
      actionId: previous.get(entry.text)?.actionId ?? null,
      answer: previous.get(entry.text)?.answer ?? null,
    }));
    if (internalQuestions.length > 0) {
      parts.internalQuestions = {
        data: { questions: internalQuestions },
        claims: internal.slice(0, 6).map((entry, index) => {
          const answered = internalQuestions[index]?.answer;
          return {
            text: answered ? `${entry.text} Antwort: ${answered}` : entry.text,
            sources: [entry.source],
          };
        }),
      };
    }

    // Im Termin an den Lieferanten: je Ziel eine Frage, dazu Datenlücken
    const supplierQuestions = [
      ...goals.map((entry, index) => ({
        text: entry.supplierQuestion,
        goalKey: goalList[index]?.key ?? null,
        about: null,
        source: entry.source,
      })),
      ...inputs.dataGaps.map((gap) => ({
        text: `Könnt ihr uns sagen: ${gap.description}?`,
        goalKey: null,
        about: 'Datenlücke im Wertpotenzial-Finder',
        source: ownDraftSource('value_data_gap', gap.id, gap.description),
      })),
      // KI-17: offene Fragen aus dem letzten Termin kommen wieder auf den Tisch
      ...inputs.earlierQuestions.map((question) => ({
        text: question.text,
        goalKey: null,
        about: `Offen aus „${question.meetingTitle}“`,
        source: ownDraftSource('ai_draft', question.id, `Ergebnisse ${question.meetingTitle}`),
      })),
    ].slice(0, 8);
    parts.supplierQuestions = {
      data: {
        questions: supplierQuestions.map(({ source: _source, ...entry }, index) => ({
          key: `s${index + 1}`,
          ...entry,
        })),
      },
      claims: supplierQuestions.map((entry) => ({ text: entry.text, sources: [entry.source] })),
    };

    // Was der Lieferant fragen wird: mit Antwortvorschlag ohne verbindliche Zusage
    const expected: { text: string; origin: string; answer: string; source: Source }[] = [];
    for (const topic of inputs.topics.filter((entry) => entry.side === 'supplier')) {
      expected.push({
        text: `Wie steht ihr zu unserem Thema „${topic.title}“?`,
        origin: `Thema von ${supplier} im Gemeinsamen Plan`,
        answer:
          'Wir sehen das Thema und prüfen es gemeinsam mit euch. Eine Entscheidung treffen wir nach dem Termin.',
        source: ownDraftSource('jbp_topic', topic.id, topic.title),
      });
    }
    for (const gap of inputs.feedbackGaps.slice(0, 2)) {
      const name = dimensionNames[gap.dimension] ?? gap.dimension;
      expected.push({
        text: `Warum seht ihr ${name} anders als wir?`,
        origin: `Feedback: Lücke bei ${name}`,
        answer:
          'Wir nehmen die Rückmeldung ernst und schlagen einen eigenen Termin zu den Ergebnissen vor.',
        source: ownDraftSource('survey_result', gap.id, `Feedback ${name}`),
      });
    }
    for (const entry of inputs.commitments.filter((item) => item.side === 'buyer')) {
      expected.push({
        text: `Wann kommt „${entry.title}“ von euch?`,
        origin: 'Zusage eurer Seite',
        answer: 'Wir klären das vor dem Termin intern und nennen im Termin den Stand.',
        source: ownDraftSource('commitment', entry.id, entry.title, entry.dueOn),
      });
    }
    const safe = expected.filter((entry) => !hasBindingCommitment(entry.answer)).slice(0, 5);
    if (safe.length > 0) {
      parts.expectedQuestions = {
        data: {
          questions: safe.map(({ source: _source, ...entry }, index) => ({
            key: `e${index + 1}`,
            ...entry,
          })),
        },
        claims: safe.map((entry) => ({
          text: `${entry.text} Antwortvorschlag: ${entry.answer}`,
          sources: [entry.source],
        })),
      };
    }

    // Risiken und offene Punkte aus der Datenbank
    const risks = this.risks(inputs);
    if (risks.length > 0) {
      parts.risks = {
        data: { risks: risks.map((risk, index) => ({ key: `r${index + 1}`, text: risk.text })) },
        claims: risks,
      };
    }
    const today = new Date().toISOString().slice(0, 10);
    if (inputs.commitments.length > 0) {
      parts.openPoints = {
        data: {
          points: inputs.commitments.map((entry, index) => ({
            key: `o${index + 1}`,
            title: entry.title,
            side: entry.side,
            dueOn: entry.dueOn,
            overdue: entry.dueOn < today,
          })),
        },
        claims: inputs.commitments.map((entry) => ({
          text: `${entry.title} (${entry.side === 'buyer' ? 'eure Seite' : supplier}, fällig ${day(entry.dueOn)})`,
          sources: [ownDraftSource('commitment', entry.id, entry.title, entry.dueOn)],
        })),
      };
    }
    return parts;
  }

  /** Für den Agenten: die Sätze zur Lage, die das Modell nur umformulieren darf */
  situationFor(auth: AuthContext, relationshipId: string, meetingId: string) {
    return this.meetings.buyer(auth, relationshipId, async (scope) => {
      const inputs = await this.inputs(scope, meetingId);
      return this.situation(inputs, ownDraftSource('meeting', meetingId, inputs.meeting.title)).map(
        (sentence) => sentence.text,
      );
    });
  }

  /** Prüfsumme der Eingaben eines Termins, im Umfang der Session */
  checksumFor(auth: AuthContext, relationshipId: string, meetingId: string) {
    return this.meetings.buyer(auth, relationshipId, async (scope) =>
      this.checksum(await this.inputs(scope, meetingId)),
    );
  }

  /** Entwürfe eines Laufs ablegen; offene Entwürfe desselben Termins werden verworfen. */
  saveAgentDrafts(
    auth: AuthContext,
    relationshipId: string,
    meetingId: string,
    runId: string,
    summary?: string,
  ) {
    return this.meetings.buyer(auth, relationshipId, async (scope) => {
      if (!this.canDecide(scope)) throw forbidden();
      const [existing] = await scope.tx
        .select({ id: schema.aiDraft.id })
        .from(schema.aiDraft)
        .where(
          and(
            eq(schema.aiDraft.orgId, scope.orgId),
            eq(schema.aiDraft.runId, runId),
            inArray(schema.aiDraft.kind, kinds),
          ),
        );
      if (existing) return;
      const inputs = await this.inputs(scope, meetingId);
      const parts = this.build(inputs, summary);
      await scope.tx
        .update(schema.aiDraft)
        .set({
          status: 'discarded',
          dismissReason: 'neuer Lauf',
          decidedBy: auth.userId,
          decidedAt: new Date(),
        })
        .where(
          and(
            eq(schema.aiDraft.orgId, scope.orgId),
            eq(schema.aiDraft.objectId, meetingId),
            eq(schema.aiDraft.status, 'draft'),
            inArray(schema.aiDraft.kind, kinds),
          ),
        );
      for (const part of briefParts) {
        const result = parts[part] as PartResult<typeof part> | undefined;
        if (!result || result.claims.length === 0) continue;
        await createBuyerDraft(
          scope.tx,
          {
            orgId: scope.orgId,
            relationshipId,
            runId,
            kind: briefDraftKinds[part],
            objectType: 'meeting',
            objectId: meetingId,
            content: JSON.stringify(result.data),
            model: summary && part === 'situation' ? 'standard' : 'reziproq',
            createdBy: auth.userId,
          },
          result.claims,
        );
      }
      // IN-06: „Briefing fertig“ an den SRO; nur Zahlen, keine Inhalte (Ziele bleiben privat)
      const count = (part: BriefPart) => {
        const data = (parts[part] as PartResult<BriefPart> | undefined)?.data as
          | Record<string, unknown>
          | undefined;
        const list = data && Object.values(data).find((value) => Array.isArray(value));
        return Array.isArray(list) ? list.length : 0;
      };
      const day = new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'Europe/Berlin',
      }).format(new Date(inputs.meeting.startsAt));
      const questions =
        count('internalQuestions') + count('supplierQuestions') + count('expectedQuestions');
      await this.bus.emit({
        orgId: scope.orgId,
        userIds: inputs.team
          .filter((member) => member.teamRole === 'sro')
          .map((member) => member.userId),
        kind: 'brief_ready',
        objectType: 'meeting',
        objectId: meetingId,
        title: `${inputs.meeting.title} am ${day}.: Briefing steht`,
        line: `${count('goals')} Ziele, Agenda mit ${count('agenda')} Punkten, ${questions} offene Fragen`,
        href: `/lieferanten/${relationshipId}/umsetzung/termine/${meetingId}`,
        relationshipId,
      });
    });
  }

  private async view(scope: MeetingScope, meetingId: string): Promise<MeetingBrief> {
    const meeting = await this.meetingRow(scope, meetingId);
    const rows = await scope.tx
      .select()
      .from(schema.aiDraft)
      .where(
        and(
          eq(schema.aiDraft.orgId, scope.orgId),
          eq(schema.aiDraft.objectId, meetingId),
          inArray(schema.aiDraft.kind, kinds),
          inArray(schema.aiDraft.status, ['draft', 'accepted']),
        ),
      )
      .orderBy(desc(schema.aiDraft.createdAt), desc(schema.aiDraft.id));
    const evidence = await draftEvidence(scope.tx, rows);
    const toDraft = (row: DraftRow) => ({
      ...draftDecision(row),
      ...evidence(row),
      id: row.id,
      status: row.status,
      content: row.content,
      model: row.model,
      createdAt: row.createdAt.toISOString(),
      decidedAt: row.decidedAt?.toISOString() ?? null,
      data: safeJson(row.content),
    });
    const parts = Object.fromEntries(
      briefParts.map((part) => {
        const kind = briefDraftKinds[part];
        const draft = rows.find((row) => row.kind === kind && row.status === 'draft');
        const accepted = rows.find((row) => row.kind === kind && row.status === 'accepted');
        return [
          part,
          { draft: draft ? toDraft(draft) : null, accepted: accepted ? toDraft(accepted) : null },
        ];
      }),
    );
    const inputs = await this.inputs(scope, meetingId);
    const [run] = await scope.tx
      .select({
        id: schema.agentRun.id,
        status: schema.agentRun.status,
        finishedAt: schema.agentRun.finishedAt,
        createdAt: schema.agentRun.createdAt,
        checksum: schema.agentRun.inputChecksum,
      })
      .from(schema.agentRun)
      .where(
        and(
          eq(schema.agentRun.orgId, scope.orgId),
          eq(schema.agentRun.contextId, meetingId),
          eq(schema.agentRun.isTest, false),
        ),
      )
      .orderBy(desc(schema.agentRun.createdAt), desc(schema.agentRun.id))
      .limit(1);
    const lastDraft = rows[0];
    const settings = await this.settingsIn(scope.tx, scope.orgId);
    return meetingBriefSchema.parse({
      canDecide: this.canDecide(scope),
      leadDays: settings.leadDays[meeting.type] ?? null,
      durationMinutes: meeting.durationMinutes,
      parts,
      participants: inputs.meeting.participants,
      sourceCounts: [
        { kind: 'value', count: inputs.opportunities.length + inputs.signals.length },
        { kind: 'activities', count: inputs.notes },
        { kind: 'commitments', count: inputs.commitments.length + inputs.hints.length },
        { kind: 'topics', count: inputs.topics.length },
        { kind: 'feedback', count: inputs.feedbackGaps.length > 0 ? 1 : 0 },
        { kind: 'scorecard', count: inputs.kpis.length },
      ],
      freshness: {
        runId: run?.id ?? null,
        preparedAt: lastDraft ? lastDraft.createdAt.toISOString() : null,
        unchanged: Boolean(run?.checksum) && run?.checksum === this.checksum(inputs),
        running: run?.status === 'queued' || run?.status === 'running',
      },
      agendaShared: rows.some(
        (row) => row.kind === briefDraftKinds.agenda && row.status === 'accepted',
      ),
    });
  }

  get(auth: AuthContext, relationshipId: string, meetingId: string) {
    return this.meetings.buyer(auth, relationshipId, (scope) => this.view(scope, meetingId));
  }

  private async openDraft(scope: MeetingScope, meetingId: string, draftId: string) {
    if (!this.canDecide(scope)) throw forbidden();
    const [row] = await scope.tx
      .select()
      .from(schema.aiDraft)
      .where(
        and(
          eq(schema.aiDraft.id, draftId),
          eq(schema.aiDraft.orgId, scope.orgId),
          eq(schema.aiDraft.objectId, meetingId),
          inArray(schema.aiDraft.kind, kinds),
        ),
      );
    if (!row) throw notFound();
    return row;
  }

  decide(
    auth: AuthContext,
    relationshipId: string,
    meetingId: string,
    draftId: string,
    decision: { status: 'accepted' } | { status: 'discarded'; reason: string | null },
  ) {
    return this.meetings.buyer(auth, relationshipId, async (scope) => {
      const row = await this.openDraft(scope, meetingId, draftId);
      if (row.status !== 'draft')
        throw new ConflictException({ statusCode: 409, code: 'nicht_offen' });
      if (decision.status === 'accepted') {
        // Je Teil gilt nur ein übernommener Entwurf; der frühere wird verworfen.
        await scope.tx
          .update(schema.aiDraft)
          .set({ status: 'discarded', dismissReason: 'ersetzt' })
          .where(
            and(
              eq(schema.aiDraft.orgId, scope.orgId),
              eq(schema.aiDraft.objectId, meetingId),
              eq(schema.aiDraft.kind, row.kind),
              eq(schema.aiDraft.status, 'accepted'),
            ),
          );
        if (row.kind === briefDraftKinds.agenda) await this.shareAgenda(scope, meetingId, row);
      }
      await scope.tx
        .update(schema.aiDraft)
        .set({
          status: decision.status,
          dismissReason: decision.status === 'discarded' ? decision.reason : null,
          decidedBy: auth.userId,
          decidedAt: new Date(),
        })
        .where(eq(schema.aiDraft.id, draftId));
      return this.view(scope, meetingId);
    });
  }

  /**
   * „Agenda übernehmen“: Die Punkte stehen danach in der geteilten Agenda des Termins, mit Zeit,
   * Dauer, wer führt und den Fragen an den Lieferanten zum jeweiligen Ziel. Ziele, interne Fragen
   * und Antwortvorschläge gehen nie mit; Unterzeilen mit Text eines Ziels bleiben leer.
   */
  private async shareAgenda(scope: MeetingScope, meetingId: string, row: DraftRow) {
    if (!can(scope.auth, 'termine.bearbeiten')) throw forbidden();
    const agenda = briefContentSchemas.agenda.parse(safeJson(row.content));
    const goalsRow = await this.latestPart(scope, meetingId, 'goals');
    const goals = goalsRow
      ? (briefContentSchemas.goals.safeParse(safeJson(goalsRow.content)).data?.goals ?? [])
      : [];
    const questionsRow = await this.latestPart(scope, meetingId, 'supplierQuestions');
    const questions = questionsRow
      ? (briefContentSchemas.supplierQuestions.safeParse(safeJson(questionsRow.content)).data
          ?.questions ?? [])
      : [];
    const secret = goals.flatMap((goal) => [goal.title, goal.reachedWhen]);
    const clean = (text: string | null) =>
      text && !secret.some((entry) => text.includes(entry)) ? text : null;
    const items = agenda.items.map((item) => ({
      title: `${item.start} ${item.title}`.slice(0, 200),
      detail: [
        `${item.minutes} Min.`,
        item.leads.length > 0 ? item.leads.join(', ') : null,
        clean(item.subline),
        ...questions
          .filter((question) => question.goalKey !== null && question.goalKey === item.goalKey)
          .map((question) => clean(question.text)),
      ]
        .filter(Boolean)
        .join(' · '),
    }));
    await this.meetings.saveAgendaWithDetail(scope, meetingId, items);
    // IN-03: „Agenda einfügen“ schreibt sie in den markierten Block der Einladung in Outlook
    await this.meetings.notifyAgendaShared(scope, meetingId, items);
  }

  private async latestPart(scope: MeetingScope, meetingId: string, part: BriefPart) {
    const [row] = await scope.tx
      .select()
      .from(schema.aiDraft)
      .where(
        and(
          eq(schema.aiDraft.orgId, scope.orgId),
          eq(schema.aiDraft.objectId, meetingId),
          eq(schema.aiDraft.kind, briefDraftKinds[part]),
          inArray(schema.aiDraft.status, ['draft', 'accepted']),
        ),
      )
      .orderBy(desc(schema.aiDraft.createdAt), desc(schema.aiDraft.id))
      .limit(1);
    return row;
  }

  /** Agenda vor dem Übernehmen ändern; Zeiten rechnet der Code, die Summe muss stimmen. */
  editAgenda(auth: AuthContext, relationshipId: string, meetingId: string, input: EditBriefAgenda) {
    return this.meetings.buyer(auth, relationshipId, async (scope) => {
      if (!this.canDecide(scope)) throw forbidden();
      const meeting = await this.meetingRow(scope, meetingId);
      const row = await this.latestPart(scope, meetingId, 'agenda');
      if (row?.status !== 'draft') throw notFound();
      const current = briefContentSchemas.agenda.parse(safeJson(row.content));
      if (agendaMinutes(input.items) !== meeting.durationMinutes) {
        throw new UnprocessableEntityException({ statusCode: 422, code: 'agenda_dauer' });
      }
      const participants = (await this.inputs(scope, meetingId)).meeting.participants.map(
        (entry) => entry.name,
      );
      if (input.items.some((item) => item.leads.some((lead) => !participants.includes(lead)))) {
        throw new UnprocessableEntityException({ statusCode: 422, code: 'nur_teilnehmer' });
      }
      const goalsRow = await this.latestPart(scope, meetingId, 'goals');
      const goals = goalsRow
        ? (briefContentSchemas.goals.safeParse(safeJson(goalsRow.content)).data?.goals ?? [])
        : [];
      const secret = goals.flatMap((goal) => [goal.title, goal.reachedWhen]);
      const items = withStartTimes(
        berlinTime.format(meeting.startsAt),
        input.items.map((item) => {
          const before = current.items.find((entry) => entry.key === item.key);
          return {
            key: item.key,
            kind: before?.kind ?? ('topic' as const),
            minutes: item.minutes,
            title: item.title,
            subline:
              item.subline && !secret.some((entry) => item.subline?.includes(entry))
                ? item.subline
                : null,
            leads: item.leads,
            goalKey: before?.goalKey ?? null,
          };
        }),
      );
      await scope.tx
        .update(schema.aiDraft)
        .set({ content: JSON.stringify({ ...current, items }), edited: true })
        .where(eq(schema.aiDraft.id, row.id));
      return this.view(scope, meetingId);
    });
  }

  /** „An … senden“: Die Frage wird zur internen Aufgabe beim Adressaten. */
  sendQuestion(auth: AuthContext, relationshipId: string, meetingId: string, key: string) {
    return this.meetings.buyer(auth, relationshipId, async (scope) => {
      if (!this.canDecide(scope)) throw forbidden();
      const meeting = await this.meetingRow(scope, meetingId);
      const row = await this.latestPart(scope, meetingId, 'internalQuestions');
      if (!row) throw notFound();
      const data = briefContentSchemas.internalQuestions.parse(safeJson(row.content));
      const question = data.questions.find((entry) => entry.key === key);
      if (!question) throw notFound();
      if (question.actionId)
        throw new ConflictException({ statusCode: 409, code: 'schon_gesendet' });
      if (!question.addressee.userId) {
        throw new UnprocessableEntityException({ statusCode: 422, code: 'adressat_fehlt' });
      }
      const due = new Date(meeting.startsAt);
      due.setUTCDate(due.getUTCDate() - 1);
      const today = new Date().toISOString().slice(0, 10);
      // Fällig am Tag vor dem Termin, aber nie in der Vergangenheit (ISO-Daten sortieren richtig)
      const dueDate = [today, due.toISOString().slice(0, 10)].sort().at(-1) as string;
      const action = await this.actions.create(
        { ...scope, canEdit: true },
        {
          action: {
            title: `Frage zum Termin: ${question.text}`.slice(0, 200),
            description: `${question.occasion}. Antwort bitte als Kommentar; sie fließt in das nächste Briefing.`,
            visibility: 'internal',
            ownerSide: 'buyer',
            ownerUserId: question.addressee.userId,
            ownerName: null,
            dueDate,
          },
          sourceType: 'meeting',
          sourceId: meetingId,
        },
      );
      const questions = data.questions.map((entry) =>
        entry.key === key ? { ...entry, actionId: action.id } : entry,
      );
      await scope.tx
        .update(schema.aiDraft)
        .set({ content: JSON.stringify({ questions }) })
        .where(eq(schema.aiDraft.id, row.id));
      return this.view(scope, meetingId);
    });
  }

  private async settingsIn(tx: TenantTransaction, orgId: string) {
    const [row] = await tx
      .select({ value: schema.orgSetting.value })
      .from(schema.orgSetting)
      .where(and(eq(schema.orgSetting.orgId, orgId), eq(schema.orgSetting.key, 'brief_lead_days')));
    const stored = (row?.value ?? {}) as Record<string, unknown>;
    const leadDays = Object.fromEntries(
      meetingTypes.map((type) => {
        const value = stored[type];
        return [
          type,
          value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0)
            ? (value as number | null)
            : defaultBriefLeadDays[type],
        ];
      }),
    ) as Record<MeetingType, number | null>;
    return { leadDays };
  }

  /** Vorlauf je Termintyp; Startwerte aus der Spec, je Kunde änderbar */
  leadDaysIn(tx: TenantTransaction, orgId: string) {
    return this.settingsIn(tx, orgId).then((settings) => settings.leadDays);
  }

  /** Einstellungen › Termin-Briefing (KI-07); Lesen für Käufer, Ändern nur Admins */
  readSettings(tx: TenantTransaction, orgId: string): Promise<BriefSettings> {
    return this.settingsIn(tx, orgId);
  }

  async saveSettings(
    tx: TenantTransaction,
    orgId: string,
    userId: string,
    input: BriefSettings,
  ): Promise<BriefSettings> {
    const current = await this.settingsIn(tx, orgId);
    const value = { ...current.leadDays, ...input.leadDays };
    await tx
      .insert(schema.orgSetting)
      .values({ orgId, key: 'brief_lead_days', value, updatedBy: userId })
      .onConflictDoUpdate({
        target: [schema.orgSetting.orgId, schema.orgSetting.key],
        set: { value, updatedBy: userId },
      });
    return this.settingsIn(tx, orgId);
  }
}

/** Ein Entwurf enthält JSON; alte oder kaputte Inhalte zählen als leer. */
function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 3);
}

/**
 * Die Lage vom Modell gilt nur, wenn sie höchstens drei Sätze hat und jede Zahl darin in den Sätzen
 * aus der Datenbank vorkommt; sonst gelten die Sätze des Codes.
 */
export function acceptedSummary(summary: string, sentences: { text: string }[]): string | null {
  const text = summary.trim();
  if (!text || splitSentences(text).length > 3 || text.split(/(?<=[.!?])\s+/).length > 3)
    return null;
  const digits = (value: string) =>
    (value.match(/\d[\d.,]*/g) ?? []).map((entry) => entry.replace(/[.,]/g, ''));
  const allowed = new Set(digits(sentences.map((sentence) => sentence.text).join(' ')));
  return digits(text).every((entry) => allowed.has(entry)) ? text : null;
}

export { partOfKind };
