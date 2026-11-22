import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, auditedChange, desc, eq, inArray, schema } from '@reziproq/db';
import {
  type AcceptPreRead,
  limitWords,
  type MeetingDetail,
  maxPreReadWords,
  type PreReadDraft,
  preReadDraftSchema,
} from '@reziproq/shared';
import { withoutNames } from '../ai-drafts/anonymize.js';
import { aiDraftAudit } from '../ai-drafts/audit.js';
import { DRAFT_MODEL, type DraftModel, draftModelName } from '../ai-drafts/draft-model.js';
import {
  createBuyerDraft,
  type DraftEvidence,
  draftDecision,
  draftEvidence,
  ownDraftSource,
} from '../ai-drafts/evidence.js';
import { gatewayContext } from '../ai-gateway/model-gateway.js';
import { actorOf } from '../audit/actor.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { type MeetingScope, MeetingsService } from './meetings.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

const kind = 'pre_read' as const;
const objectType = 'meeting';
type Side = 'buyer' | 'supplier';
type DraftRow = typeof schema.aiDraft.$inferSelect;

const sectionNames: Record<string, string> = {
  scorecard: 'Scorecard',
  initiatives: 'Initiativen',
  commitments: 'Offene Zusagen',
  actions: 'Offene Maßnahmen',
};

const system = [
  'Du schreibst für eine Seite einer Lieferantenbeziehung die Zusammenfassung im Pre-Read eines',
  `Termins. Höchstens ${maxPreReadWords} Wörter, Deutsch, in drei kurzen Absätzen: Stand, Erfolge,`,
  'offene Punkte. Stütze dich nur auf die gegebenen Angaben, erfinde keine Zahlen und nenne keine',
  'Personen.',
].join(' ');

const toDraft = (row: DraftRow, evidence?: DraftEvidence) => ({
  ...draftDecision(row),
  ...evidence,
  id: row.id,
  status: row.status,
  content: row.content,
  model: row.model,
  createdAt: row.createdAt.toISOString(),
  decidedAt: row.decidedAt?.toISOString() ?? null,
});

/**
 * Die Anfrage an die KI: nur, was die eigene Seite sehen darf. Die Abschnitte kommen aus
 * MeetingDetail (RLS der eigenen Seite); interne Notiz und Lieferantenplan nur beim Käufer.
 */
export function preReadPrompt(
  detail: MeetingDetail,
  side: Side,
  buyerOnly: { note: string | null; plan: { summary: string; objectives: string[] } | null },
  names: string[],
) {
  const clean = (text: string) => withoutNames(text, names);
  const lines = [
    `Termin: ${clean(detail.meeting.title)} am ${detail.meeting.startsAt.slice(0, 10)}`,
    `Seite: ${side === 'buyer' ? 'Käufer' : 'Lieferant'}`,
  ];
  if (detail.agenda.length > 0) {
    lines.push('Agenda:');
    for (const item of [...detail.agenda].sort((a, b) => a.position - b.position)) {
      lines.push(`- ${clean(item.title)}`);
    }
  }
  for (const section of detail.live.sections) {
    lines.push(`${sectionNames[section.key] ?? section.key}:`);
    if (section.items.length === 0) lines.push('- keine');
    for (const item of section.items) {
      const meta = [item.status, item.detail, item.dueDate ? `fällig ${item.dueDate}` : null]
        .filter(Boolean)
        .map((part) => clean(String(part)))
        .join(', ');
      lines.push(`- ${clean(item.title)}${meta ? ` (${meta})` : ''}`);
    }
  }
  if (side === 'buyer') {
    if (buyerOnly.note) lines.push(`Interne Notiz: ${clean(buyerOnly.note)}`);
    if (buyerOnly.plan) {
      lines.push(`Lieferantenplan: ${clean(buyerOnly.plan.summary) || 'ohne Zusammenfassung'}`);
      for (const objective of buyerOnly.plan.objectives) lines.push(`- Ziel: ${clean(objective)}`);
    }
  }
  return lines.join('\n');
}

/**
 * QBR-07: KI-Entwurf der Zusammenfassung im Pre-Read, je Seite getrennt (ai_draft ist
 * org_private). Erzeugen, Übernehmen und Verwerfen: SRO bzw. Key Account Manager oder Admin. Ein
 * übernommener Entwurf steht im Pre-Read-PDF der eigenen Seite.
 */
@Injectable()
export class PreReadDraftService {
  constructor(
    @Inject(MeetingsService) private readonly meetings: MeetingsService,
    @Inject(DRAFT_MODEL) private readonly model: DraftModel,
  ) {}

  private scoped<T>(
    side: Side,
    auth: AuthContext,
    relationshipId: string,
    work: (scope: MeetingScope) => Promise<T>,
  ) {
    return side === 'buyer'
      ? this.meetings.buyer(auth, relationshipId, work)
      : this.meetings.supplier(auth, relationshipId, work);
  }

  private canDraft(scope: MeetingScope) {
    return scope.auth.orgRole === 'admin' || scope.teamRole === 'sro';
  }

  private ofMeeting(scope: MeetingScope, meetingId: string, statuses: DraftRow['status'][]) {
    return and(
      eq(schema.aiDraft.orgId, scope.orgId),
      eq(schema.aiDraft.relationshipId, scope.relationshipId),
      eq(schema.aiDraft.kind, kind),
      eq(schema.aiDraft.objectId, meetingId),
      inArray(schema.aiDraft.status, statuses),
    );
  }

  assertAgentContext(auth: AuthContext, relationshipId: string, meetingId: string) {
    return this.meetings.buyer(auth, relationshipId, async (scope) => {
      if (!this.canDraft(scope)) throw forbidden();
      const [row] = await scope.tx
        .select({ id: schema.meeting.id })
        .from(schema.meeting)
        .where(
          and(
            eq(schema.meeting.id, meetingId),
            eq(schema.meeting.relationshipId, relationshipId),
            eq(schema.meeting.type, 'quarterly_review'),
          ),
        );
      if (!row) throw notFound();
    });
  }

  /** KI-04: Nur berechtigte Käufer erhalten Fakten zur Vorbereitung des Quartalsreviews. */
  agentFacts(auth: AuthContext, relationshipId: string, meetingId: string) {
    return this.meetings.buyer(auth, relationshipId, async (scope) => {
      if (!this.canDraft(scope)) throw forbidden();
      const detail = await this.meetings.detail(scope, meetingId);
      if (detail.meeting.type !== 'quarterly_review') throw notFound();
      const count = (key: string) =>
        detail.live.sections.find((section) => section.key === key)?.items.length ?? 0;
      return {
        meetingDay: detail.meeting.startsAt.slice(0, 10),
        agendaItems: detail.agenda.length,
        actions: count('actions'),
        commitments: count('commitments'),
        initiatives: count('initiatives'),
        scorecardItems: count('scorecard'),
      };
    });
  }

  saveAgentDraft(
    auth: AuthContext,
    relationshipId: string,
    meetingId: string,
    runId: string,
    content: string,
    model: string,
  ) {
    return this.meetings.buyer(auth, relationshipId, async (scope) => {
      if (!this.canDraft(scope)) throw forbidden();
      const detail = await this.meetings.detail(scope, meetingId);
      if (detail.meeting.type !== 'quarterly_review') throw notFound();
      // Dieser Lauf sperrt die Veröffentlichung, damit ein wiederholter Job keinen zweiten Entwurf erzeugt.
      const [run] = await scope.tx
        .select({ id: schema.agentRun.id })
        .from(schema.agentRun)
        .where(
          and(
            eq(schema.agentRun.id, runId),
            eq(schema.agentRun.orgId, scope.orgId),
            eq(schema.agentRun.actingUserId, auth.userId),
            eq(schema.agentRun.contextId, meetingId),
            eq(schema.agentRun.contextRelationshipId, relationshipId),
            eq(schema.agentRun.isTest, false),
          ),
        )
        .for('update');
      if (!run) throw notFound();
      const [existing] = await scope.tx
        .select({ id: schema.aiDraft.id })
        .from(schema.aiDraft)
        .where(and(eq(schema.aiDraft.orgId, scope.orgId), eq(schema.aiDraft.runId, run.id)));
      if (existing) return existing.id;

      return createBuyerDraft(
        scope.tx,
        {
          orgId: scope.orgId,
          relationshipId,
          runId: run.id,
          kind,
          objectType,
          objectId: meetingId,
          content,
          model,
          createdBy: auth.userId,
        },
        [
          {
            text: content,
            sources: [
              ownDraftSource(
                objectType,
                meetingId,
                'Termin und Vorbereitung',
                detail.meeting.startsAt.slice(0, 10),
              ),
              ownDraftSource('supplier_context', relationshipId, 'Lieferantenkontext'),
            ],
          },
        ],
      );
    });
  }

  /** Übernommene Zusammenfassung der eigenen Seite, für das PDF */
  async acceptedIn(scope: MeetingScope, meetingId: string): Promise<string | null> {
    const [row] = await scope.tx
      .select({ content: schema.aiDraft.content })
      .from(schema.aiDraft)
      .where(this.ofMeeting(scope, meetingId, ['accepted']))
      .orderBy(desc(schema.aiDraft.decidedAt))
      .limit(1);
    return row?.content ?? null;
  }

  private async view(scope: MeetingScope, meetingId: string): Promise<PreReadDraft> {
    const canDraft = this.canDraft(scope);
    const rows = await scope.tx
      .select()
      .from(schema.aiDraft)
      .where(this.ofMeeting(scope, meetingId, ['draft', 'accepted']))
      .orderBy(desc(schema.aiDraft.createdAt), desc(schema.aiDraft.id));
    const draft = rows.find((row) => row.status === 'draft');
    const accepted = rows.find((row) => row.status === 'accepted');
    const evidence =
      canDraft && scope.side === 'buyer' ? await draftEvidence(scope.tx, rows) : () => undefined;
    return preReadDraftSchema.parse({
      canDraft,
      draft: canDraft && draft ? toDraft(draft, evidence(draft)) : null,
      accepted: accepted ? toDraft(accepted, evidence(accepted)) : null,
    });
  }

  get(side: Side, auth: AuthContext, relationshipId: string, meetingId: string) {
    return this.scoped(side, auth, relationshipId, async (scope) => {
      await this.meetings.detail(scope, meetingId);
      return this.view(scope, meetingId);
    });
  }

  /** Lieferantenplan des laufenden Zyklus, nur beim Käufer */
  private async supplierPlan(scope: MeetingScope) {
    const [plan] = await scope.tx
      .select({ id: schema.supplierPlan.id, summary: schema.supplierPlan.summary })
      .from(schema.supplierPlan)
      .innerJoin(schema.cycle, eq(schema.cycle.id, schema.supplierPlan.cycleId))
      .where(
        and(
          eq(schema.supplierPlan.relationshipId, scope.relationshipId),
          eq(schema.cycle.status, 'active'),
        ),
      )
      .orderBy(desc(schema.supplierPlan.version))
      .limit(1);
    if (!plan) return null;
    const objectives = await scope.tx
      .select({ text: schema.planObjective.text })
      .from(schema.planObjective)
      .where(eq(schema.planObjective.planId, plan.id))
      .orderBy(asc(schema.planObjective.text));
    return { id: plan.id, summary: plan.summary, objectives: objectives.map((row) => row.text) };
  }

  /** „Zusammenfassung vorschlagen“: höchstens 200 Wörter */
  async propose(side: Side, auth: AuthContext, relationshipId: string, meetingId: string) {
    const prepared = await this.scoped(side, auth, relationshipId, async (scope) => {
      if (!this.canDraft(scope)) throw forbidden();
      const detail = await this.meetings.detail(scope, meetingId);
      const people = await scope.tx.select({ name: schema.appUser.name }).from(schema.appUser);
      const names = [
        ...people.map((person) => person.name),
        ...detail.participants.map((person) => person.name),
      ];
      const buyerOnly =
        scope.side === 'buyer'
          ? { note: detail.note, plan: await this.supplierPlan(scope) }
          : { note: null, plan: null };
      return {
        prompt: preReadPrompt(detail, scope.side, buyerOnly, names),
        sources: [
          ownDraftSource(
            'meeting',
            meetingId,
            'Termin und Vorbereitung',
            detail.meeting.startsAt.slice(0, 10),
          ),
          ...(buyerOnly.plan
            ? [ownDraftSource('supplier_plan', buyerOnly.plan.id, 'Lieferantenplan')]
            : []),
        ],
      };
    });
    const written = await this.model.write({
      context: gatewayContext(auth, 'pre_read'),
      system,
      prompt: prepared.prompt,
      maxOutputTokens: 600,
    });
    const content = limitWords(written, maxPreReadWords);
    return this.scoped(side, auth, relationshipId, async (scope) => {
      if (!this.canDraft(scope)) throw forbidden();
      await this.meetings.detail(scope, meetingId);
      // Ein neuer Entwurf ersetzt den offenen; die übernommene Zusammenfassung bleibt.
      await scope.tx.delete(schema.aiDraft).where(this.ofMeeting(scope, meetingId, ['draft']));
      const draft = {
        orgId: scope.orgId,
        relationshipId: scope.relationshipId,
        kind,
        objectType,
        objectId: meetingId,
        content,
        model: draftModelName(this.model, 'pre_read'),
        createdBy: auth.userId,
      };
      if (scope.side === 'buyer') {
        await createBuyerDraft(
          scope.tx,
          draft,
          [content].map((text) => ({ text, sources: [...prepared.sources] })),
        );
      } else {
        await scope.tx.insert(schema.aiDraft).values(draft);
      }
      return this.view(scope, meetingId);
    });
  }

  /** Übernehmen (auch bearbeitet) oder Verwerfen des offenen Entwurfs */
  decide(
    side: Side,
    auth: AuthContext,
    relationshipId: string,
    meetingId: string,
    draftId: string,
    decision:
      | { status: 'accepted'; input: AcceptPreRead }
      | { status: 'discarded'; reason?: string | undefined },
  ) {
    return this.scoped(side, auth, relationshipId, async (scope) => {
      if (!this.canDraft(scope)) throw forbidden();
      const [row] = await scope.tx
        .select()
        .from(schema.aiDraft)
        .where(
          and(
            this.ofMeeting(scope, meetingId, ['draft', 'accepted', 'discarded']),
            eq(schema.aiDraft.id, draftId),
          ),
        )
        .for('update');
      if (!row) throw notFound();
      if (row.status !== 'draft') {
        throw new ConflictException({ statusCode: 409, code: 'schon_entschieden' });
      }
      const now = new Date();
      if (decision.status === 'accepted') {
        await scope.tx
          .update(schema.aiDraft)
          .set({ status: 'discarded', decidedBy: auth.userId, decidedAt: now })
          .where(this.ofMeeting(scope, meetingId, ['accepted']));
      }
      const actor = await actorOf(scope.tx, auth, scope.orgId);
      await auditedChange(scope.tx, actor, aiDraftAudit, async () => {
        await scope.tx
          .update(schema.aiDraft)
          .set({
            status: decision.status,
            dismissReason:
              decision.status === 'discarded' && row.claims !== null
                ? decision.reason || null
                : null,
            decidedBy: auth.userId,
            decidedAt: now,
            // Bearbeitet übernommen: der Text der Person, nie mehr als 200 Wörter.
            ...(decision.status === 'accepted'
              ? {
                  content: limitWords(decision.input.content, maxPreReadWords),
                  edited:
                    row.claims !== null &&
                    limitWords(decision.input.content, maxPreReadWords) !== row.content,
                }
              : {}),
          })
          .where(eq(schema.aiDraft.id, row.id));
        return {
          relationshipId: scope.relationshipId,
          objectId: row.id,
          action: 'updated' as const,
          before: { status: 'draft' },
          after: { status: decision.status },
          result: null,
        };
      });
      return this.view(scope, meetingId);
    });
  }
}
