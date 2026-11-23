import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, schema, sql } from '@reziproq/db';
import {
  type OpportunityTemplateKey,
  progressFromBaseline,
  type QbrPrep,
  qbrPrepSchema,
  type SurveyDimension,
} from '@reziproq/shared';
import {
  createBuyerDraft,
  draftDecision,
  draftEvidence,
  ownDraftSource,
} from '../ai-drafts/evidence.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { templateTitles } from '../opportunities/templates.js';
import { type MeetingScope, MeetingsService } from './meetings.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

const kinds = { topics: 'qbr_topics', risks: 'qbr_risks', openPoints: 'qbr_open_points' } as const;
type Part = keyof typeof kinds;
type DraftRow = typeof schema.aiDraft.$inferSelect;
type Source = ReturnType<typeof ownDraftSource>;
interface Claim {
  text: string;
  sources: [Source, ...Source[]];
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
const day = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const sideName = (side: 'buyer' | 'supplier') => (side === 'buyer' ? 'eure Seite' : 'Lieferant');

/**
 * KI-07: interne QBR-Vorbereitung. Zahlen rechnet der Code aus der Datenbank; jede Aussage
 * verweist auf ihr Objekt. Ein neuer Lauf ersetzt nur die offenen Entwürfe desselben Termins
 * (Entscheidung F6 vom 23.11.2026). Der Lieferant sieht nichts davon (org_private).
 */
@Injectable()
export class QbrPrepService {
  constructor(@Inject(MeetingsService) private readonly meetings: MeetingsService) {}

  private canDraft(scope: MeetingScope) {
    return scope.side === 'buyer' && (scope.auth.orgRole === 'admin' || scope.teamRole === 'sro');
  }

  /** Risiken, offene Punkte und Themen aus der Datenbank, im Umfang der Session */
  async facts(
    scope: MeetingScope,
    meetingDay: string,
    today = new Date().toISOString().slice(0, 10),
  ) {
    const { tx, relationshipId } = scope;
    const risks: Claim[] = [];
    const topics: Claim[] = [];

    // Kennzahlen hinter Plan: Fortschritt von der Basis zum Ziel bleibt um mehr als zehn Punkte
    // hinter der verstrichenen Zeit zurück; ohne Basis zählt nur ein verfehltes Ziel nach Ablauf.
    const kpis = await tx
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
      .where(eq(schema.scorecardKpi.relationshipId, relationshipId));
    for (const kpi of kpis) {
      if (kpi.latest === null) continue;
      const latest = Number(kpi.latest);
      const target = Number(kpi.target);
      const start = kpi.createdAt.getTime();
      const end = new Date(`${kpi.targetDate}T00:00:00Z`).getTime();
      const elapsed =
        end > start ? Math.min(1, Math.max(0, (Date.now() - start) / (end - start))) : 1;
      const progress = progressFromBaseline(
        kpi.baseline === null ? null : Number(kpi.baseline),
        target,
        latest,
      );
      const reached = kpi.direction === 'higher' ? latest >= target : latest <= target;
      const behind =
        progress !== null ? progress < elapsed - 0.1 : today > kpi.targetDate && !reached;
      if (!behind) continue;
      const text = `„${kpi.name}“ liegt bei ${number(latest)} ${kpi.unit}, Ziel ${number(target)} ${kpi.unit} bis ${day(kpi.targetDate)}.`;
      const source = ownDraftSource('scorecard_kpi', kpi.id, kpi.name, kpi.period);
      risks.push({ text, sources: [source] });
      topics.push({ text: `„${kpi.name}“ wieder auf Kurs bringen — ${text}`, sources: [source] });
    }

    // Zusagen beider Seiten: überfällig als Risiko, bis zum Termin fällig als offene Punkte
    const commitments = await tx
      .select({
        id: schema.commitment.id,
        title: schema.commitment.title,
        side: schema.commitment.side,
        dueOn: schema.commitment.dueOn,
      })
      .from(schema.commitment)
      .where(
        and(
          eq(schema.commitment.relationshipId, relationshipId),
          eq(schema.commitment.status, 'open'),
          sql`${schema.commitment.dueOn} <= ${meetingDay}::date`,
        ),
      )
      .orderBy(schema.commitment.dueOn);
    const overdue = commitments.filter((entry) => entry.dueOn < today);
    for (const entry of overdue) {
      risks.push({
        text: `Zusage „${entry.title}“ (${sideName(entry.side)}) war am ${day(entry.dueOn)} fällig.`,
        sources: [ownDraftSource('commitment', entry.id, entry.title, entry.dueOn)],
      });
    }
    const openPoints: Claim[] = commitments.map((entry) => ({
      text: `${entry.title} (${sideName(entry.side)}, fällig ${day(entry.dueOn)})`,
      sources: [ownDraftSource('commitment', entry.id, entry.title, entry.dueOn)],
    }));
    const [firstOverdue, ...moreOverdue] = overdue.map((entry) =>
      ownDraftSource('commitment', entry.id, entry.title, entry.dueOn),
    );
    if (firstOverdue) {
      topics.push({
        text: `Überfällige Zusagen klären — ${overdue.length} Zusagen sind überfällig.`,
        sources: [firstOverdue, ...moreOverdue],
      });
    }

    // Feedback-Lücken ab 0,5 aus der jüngsten Welle mit Ergebnis
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
          where r2.relationship_id = ${relationshipId} order by w.created_at desc limit 1)`);
    for (const dimension of new Set(results.rows.map((row) => row.dimension))) {
      const buyer = results.rows.find((row) => row.dimension === dimension && row.side === 'buyer');
      const supplier = results.rows.find(
        (row) => row.dimension === dimension && row.side === 'supplier',
      );
      if (!buyer?.ist_mean || !supplier?.ist_mean) continue;
      if (Math.abs(Number(buyer.ist_mean) - Number(supplier.ist_mean)) < 0.5) continue;
      const name = dimensionNames[dimension] ?? dimension;
      const text = `Feedback-Lücke bei ${name}: eure Seite ${number(buyer.ist_mean)}, Lieferant ${number(supplier.ist_mean)}.`;
      const source = ownDraftSource('survey_result', buyer.id, `Feedback ${name}`);
      risks.push({ text, sources: [source] });
      topics.push({ text: `${name} besprechen — ${text}`, sources: [source] });
    }

    // Wertpotenzial mit dem höchsten Wert als Thema (Sicherheit hoch oder mittel)
    const [chance] = await tx
      .select()
      .from(schema.valueOpportunity)
      .where(
        and(
          eq(schema.valueOpportunity.relationshipId, relationshipId),
          eq(schema.valueOpportunity.orgId, scope.orgId),
          eq(schema.valueOpportunity.status, 'new'),
          inArray(schema.valueOpportunity.confidence, ['high', 'medium']),
        ),
      )
      .orderBy(desc(schema.valueOpportunity.buyerHighCents))
      .limit(1);
    if (chance) {
      const title = templateTitles[chance.templateKey as OpportunityTemplateKey] ?? chance.title;
      topics.push({
        text: `${title} vorschlagen — Potenzial von ${money(chance.buyerLowCents)} bis ${money(chance.buyerHighCents)} EBIT im Jahr.`,
        sources: [ownDraftSource('value_opportunity', chance.id, title)],
      });
    }
    const [firstOpen, ...moreOpen] = openPoints.flatMap((point) => point.sources);
    if (firstOpen && topics.length < 3) {
      topics.push({
        text: `Offene Zusagen bis zum Termin — ${openPoints.length} Zusagen sind bis zum Termin fällig.`,
        sources: [firstOpen, ...moreOpen],
      });
    }
    return { risks, openPoints, topics: topics.slice(0, 5) };
  }

  /** Entwürfe eines Laufs ablegen; offene Entwürfe desselben Termins werden verworfen. */
  saveAgentDrafts(auth: AuthContext, relationshipId: string, meetingId: string, runId: string) {
    return this.meetings.buyer(auth, relationshipId, async (scope) => {
      if (!this.canDraft(scope)) throw forbidden();
      const detail = await this.meetings.detail(scope, meetingId);
      if (detail.meeting.type !== 'quarterly_review') throw notFound();
      const [existing] = await scope.tx
        .select({ id: schema.aiDraft.id })
        .from(schema.aiDraft)
        .where(
          and(
            eq(schema.aiDraft.orgId, scope.orgId),
            eq(schema.aiDraft.runId, runId),
            inArray(schema.aiDraft.kind, Object.values(kinds)),
          ),
        );
      if (existing) return;
      const facts = await this.facts(scope, detail.meeting.startsAt.slice(0, 10));
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
            inArray(schema.aiDraft.kind, Object.values(kinds)),
          ),
        );
      for (const part of Object.keys(kinds) as Part[]) {
        const claims = facts[part];
        if (claims.length === 0) continue;
        await createBuyerDraft(
          scope.tx,
          {
            orgId: scope.orgId,
            relationshipId,
            runId,
            kind: kinds[part],
            objectType: 'meeting',
            objectId: meetingId,
            content: claims.map((claim) => `- ${claim.text}`).join('\n'),
            model: 'reziproq',
            createdBy: auth.userId,
          },
          claims,
        );
      }
    });
  }

  private async view(scope: MeetingScope, meetingId: string): Promise<QbrPrep> {
    const canDraft = this.canDraft(scope);
    const rows = await scope.tx
      .select()
      .from(schema.aiDraft)
      .where(
        and(
          eq(schema.aiDraft.orgId, scope.orgId),
          eq(schema.aiDraft.objectId, meetingId),
          inArray(schema.aiDraft.kind, Object.values(kinds)),
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
    });
    const part = (key: Part) => {
      const draft = rows.find((row) => row.kind === kinds[key] && row.status === 'draft');
      const accepted = rows.find((row) => row.kind === kinds[key] && row.status === 'accepted');
      return {
        draft: draft ? toDraft(draft) : null,
        accepted: accepted ? toDraft(accepted) : null,
      };
    };
    return qbrPrepSchema.parse({
      canDraft,
      topics: part('topics'),
      risks: part('risks'),
      openPoints: part('openPoints'),
    });
  }

  get(auth: AuthContext, relationshipId: string, meetingId: string) {
    return this.meetings.buyer(auth, relationshipId, async (scope) => {
      const detail = await this.meetings.detail(scope, meetingId);
      if (detail.meeting.type !== 'quarterly_review') throw notFound();
      return this.view(scope, meetingId);
    });
  }

  private async openDraft(scope: MeetingScope, meetingId: string, draftId: string) {
    if (!this.canDraft(scope)) throw forbidden();
    const [row] = await scope.tx
      .select()
      .from(schema.aiDraft)
      .where(
        and(
          eq(schema.aiDraft.id, draftId),
          eq(schema.aiDraft.orgId, scope.orgId),
          eq(schema.aiDraft.objectId, meetingId),
          inArray(schema.aiDraft.kind, Object.values(kinds)),
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

  /** Ein übernommenes Thema ausdrücklich in die geteilte Agenda bringen; nur der Titel geht mit. */
  addToAgenda(
    auth: AuthContext,
    relationshipId: string,
    meetingId: string,
    draftId: string,
    claimKey: string,
  ) {
    return this.meetings.buyer(auth, relationshipId, async (scope) => {
      const row = await this.openDraft(scope, meetingId, draftId);
      if (row.kind !== kinds.topics || row.status !== 'accepted') {
        throw new ConflictException({ statusCode: 409, code: 'thema_nicht_uebernommen' });
      }
      const claim = row.claims?.find((entry) => entry.key === claimKey);
      if (!claim) throw notFound();
      const title = claim.text.split(' — ')[0]?.trim() ?? claim.text;
      const detail = await this.meetings.detail(scope, meetingId);
      const own = detail.agenda.filter((item) => item.own).map((item) => item.title);
      if (!own.includes(title)) {
        await this.meetings.saveAgenda(scope, meetingId, { items: [...own, title] });
      }
      return this.view(scope, meetingId);
    });
  }
}
