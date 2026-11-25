import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  and,
  currentTime,
  eq,
  or,
  schema,
  sql,
  type TenantSession,
  type TenantTransaction,
} from '@reziproq/db';
import {
  acceptPreReadSchema,
  editCaptureItemSchema,
  type ReviewAdjust,
  type ReviewDecision,
  type ReviewItem,
  type ReviewResult,
  type ReviewStack,
  reviewStackSchema,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { CustomAgentsService } from '../agents/custom-agents.service.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CalendarIntakeService } from '../calendar/calendar.service.js';
import { FeedbackThemesService } from '../feedback/feedback-themes.service.js';
import { MeetingBriefService } from '../meetings/meeting-brief.service.js';
import { MeetingCaptureService } from '../meetings/meeting-capture.service.js';
import { PreReadDraftService } from '../meetings/pre-read-draft.service.js';
import { DeviationExplanationsService } from '../ratings/deviation-explanations.service.js';
import { visibleRelationships } from '../start/my-day-data.js';
import { PlanSummaryDraftService } from '../supplier-plans/plan-summary-draft.service.js';
import { nextMorning } from '../today/berlin.js';
import { TriageService } from '../today/triage.service.js';

// HE-01 Kurz prüfen (K1-e.2): der Stapel aus den Fokus-Themen der Stufe review und die
// Entscheidung je Entwurf. Übernehmen und Verwerfen laufen über den Dienst des Moduls, dem der
// Entwurf gehört; dessen Rechte und Regeln gelten unverändert. Nie hier: alles, was an das
// Gegenüber geht oder im Namen der eigenen Seite bindet (die Triage macht daraus Fokus-Themen).

const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const unprocessable = (code: string) => new UnprocessableEntityException({ statusCode: 422, code });

/** Arten, die nie in Kurz prüfen entschieden werden (HE-01, E-K0-27); doppelt gesichert */
const neverHere = new Set([
  'share_request',
  'brief_agenda',
  'data_request',
  'capture_commitment_change',
  'hint_explanation',
]);

/** Ohne Schätzung am Entwurf eine Minute je Entwurf (wie die Triage) */
const defaultReviewSeconds = 60;

interface StackRow extends Record<string, unknown> {
  id: string;
  title: string;
  source_type: string;
  source_id: string;
  relationship_id: string | null;
  href: string | null;
  created_at: Date | string;
  kind: string | null;
  object_type: string | null;
  object_id: string | null;
  subject: string | null;
  content: string | null;
  claims: { key: string; text: string }[] | null;
  review_seconds: number | null;
  draft_created_at: Date | string | null;
  meeting_title: string | null;
  inbound_subject: string | null;
  inbound_details: { startsAt?: string } | null;
  inbound_kind: string | null;
  inbound_suggested: string[] | null;
  inbound_type: string | null;
  inbound_reason: string | null;
  inbound_received_at: Date | string | null;
  inbound_item_kind: 'meeting' | 'mail' | null;
  inbound_from: string | null;
}

interface DraftRecord {
  focusId: string;
  sourceType: 'ai_draft' | 'inbound';
  sourceId: string;
  kind: string;
  objectType: string;
  objectId: string;
  relationshipId: string | null;
  content: string;
  status: string;
}

/** Was „Anpassen“ je Art heißt (siehe reviewAdjustKinds) */
function adjustOf(kind: string): ReviewAdjust {
  if (['plan_summary', 'deviation_explanation', 'pre_read', 'feedback_themes'].includes(kind)) {
    return 'text';
  }
  if (kind.startsWith('capture_')) return 'title';
  return 'place';
}

function captureTitle(content: string | null): string | null {
  try {
    const parsed = JSON.parse(content ?? '') as { title?: unknown };
    return typeof parsed.title === 'string' ? parsed.title : null;
  } catch {
    return null;
  }
}

@Injectable()
export class ReviewService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(TriageService) private readonly triage: TriageService,
    @Inject(MeetingBriefService) private readonly brief: MeetingBriefService,
    @Inject(MeetingCaptureService) private readonly capture: MeetingCaptureService,
    @Inject(PreReadDraftService) private readonly preRead: PreReadDraftService,
    @Inject(PlanSummaryDraftService) private readonly planSummary: PlanSummaryDraftService,
    @Inject(FeedbackThemesService) private readonly themes: FeedbackThemesService,
    @Inject(DeviationExplanationsService)
    private readonly deviations: DeviationExplanationsService,
    @Inject(CustomAgentsService) private readonly customAgents: CustomAgentsService,
    @Inject(CalendarIntakeService) private readonly intake: CalendarIntakeService,
  ) {}

  private session(auth: AuthContext): TenantSession | null {
    return auth.organization ? { userId: auth.userId, organizationId: auth.organization.id } : null;
  }

  /** Der Stapel: offene Entwürfe der Person in der Reihenfolge der Triage, mit Text und Quellen */
  /**
   * Stapel der Entwürfe. `entwurf` nimmt dazu einen Vorschlag zum Zuordnen auf, der nicht im
   * Stapel liegt (Stufe Vorschlagen der Aufgabe Postfach, MA-01, K1-f): Die Zeile in Alles öffnet
   * ihn hier.
   */
  async stack(auth: AuthContext, entwurf?: string): Promise<ReviewStack> {
    const session = this.session(auth);
    const organization = auth.organization;
    if (!session || !organization) return { items: [], minutes: 0 };
    await this.triage.refresh(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        const rows = await tx.execute<StackRow>(sql`
          select f.id, f.title, f.source_type, f.source_id, f.relationship_id, f.href, f.created_at,
            d.kind, d.object_type, d.object_id, d.subject, d.content, d.claims, d.review_seconds,
            d.created_at as draft_created_at,
            m.title as meeting_title,
            i.subject as inbound_subject, i.details as inbound_details,
            i.suggestion_kind as inbound_kind, i.suggested_relationship_ids as inbound_suggested,
            i.suggested_type as inbound_type, i.suggestion_reason as inbound_reason,
            i.received_at as inbound_received_at, i.kind as inbound_item_kind,
            coalesce(i.details->>'organizerName', i.details->>'organizerEmail', i.from_email)
              as inbound_from
          from focus_item f
          left join ai_draft d on f.source_type = 'ai_draft' and d.id = f.source_id
          left join meeting m on d.object_type = 'meeting' and m.id = d.object_id
          left join inbound_item i on f.source_type = 'inbound' and i.id = f.source_id
          where f.org_id = ${organization.id} and f.user_id = ${auth.userId}
            and f.state = 'open'
            and (f.level = 'review' or (f.level = 'focus' and f.source_type = 'inbound'
              and f.id = ${entwurf ?? null}::uuid))
          order by d.review_order nulls last,
            coalesce(d.created_at, i.received_at, f.created_at), f.id`);
        const draftIds = rows.rows.flatMap((row) =>
          row.source_type === 'ai_draft' ? [row.source_id] : [],
        );
        const sources = draftIds.length
          ? await tx.execute<{ draft_id: string; title: string }>(sql`
              select draft_id, title from ai_source
              where draft_id = any(${sql`${`{${draftIds.join(',')}}`}::uuid[]`})
              order by draft_id, claim_key nulls last, title`)
          : { rows: [] };
        const names = organization.buyer
          ? await visibleRelationships(tx, {
              orgId: organization.id,
              userId: auth.userId,
              admin: auth.orgRole === 'admin',
            })
          : new Map<string, string>();
        let seconds = 0;
        const items: ReviewItem[] = rows.rows.flatMap((row): ReviewItem[] => {
          const createdAt = new Date(
            row.draft_created_at ?? row.inbound_received_at ?? row.created_at,
          ).toISOString();
          const counterpart = row.relationship_id ? (names.get(row.relationship_id) ?? null) : null;
          if (row.source_type === 'inbound') {
            const suggested = (row.inbound_suggested ?? []).filter((id) => names.has(id));
            const kind = (row.inbound_kind ?? 'none') as 'supplier' | 'several' | 'event' | 'none';
            // Übernehmen geht immer: mit Vorschlag direkt, sonst nach der Wahl in der Karte.
            const canAccept = true;
            // Zur Wahl: erst die Vorschläge, dann alle übrigen Beziehungen der Person
            const options = [
              ...suggested,
              ...[...names.keys()].filter((id) => !suggested.includes(id)),
            ]
              .slice(0, 500)
              .map((id) => ({ relationshipId: id, name: names.get(id) ?? '' }));
            seconds += 20;
            return [
              {
                id: row.id,
                source: 'inbound',
                kind: 'inbound',
                objectType: 'inbound_item',
                subject: row.inbound_subject,
                counterpart,
                relationshipId: row.relationship_id,
                title: row.title,
                lines: [],
                sources: [],
                createdAt,
                reviewSeconds: 20,
                adjust: 'place',
                text: null,
                href: row.href,
                canAccept,
                inbound: {
                  kind: row.inbound_item_kind ?? 'meeting',
                  from: row.inbound_from,
                  startsAt: new Date(
                    row.inbound_details?.startsAt ?? row.inbound_received_at ?? row.created_at,
                  ).toISOString(),
                  suggestionKind: kind,
                  suggestions: suggested.map((id) => ({
                    relationshipId: id,
                    name: names.get(id) ?? '',
                  })),
                  suggestedType: row.inbound_type ?? 'other',
                  reason: row.inbound_reason,
                  options,
                },
              },
            ];
          }
          if (!row.kind || neverHere.has(row.kind)) return [];
          const reviewSeconds = row.review_seconds ?? defaultReviewSeconds;
          seconds += reviewSeconds;
          const adjust = adjustOf(row.kind);
          const lines = (row.claims ?? []).map((claim) => claim.text).filter(Boolean);
          return [
            {
              id: row.id,
              source: 'ai_draft',
              kind: row.kind,
              objectType: row.object_type ?? '',
              subject: row.meeting_title ?? null,
              counterpart,
              relationshipId: row.relationship_id,
              title: row.title,
              lines: lines.length > 0 ? lines : (row.content ?? '').split('\n').slice(0, 6),
              sources: [
                ...new Set(
                  sources.rows
                    .filter((source) => source.draft_id === row.source_id)
                    .map((source) => source.title),
                ),
              ],
              createdAt,
              reviewSeconds,
              adjust,
              text:
                adjust === 'text'
                  ? (row.content ?? '')
                  : adjust === 'title'
                    ? captureTitle(row.content)
                    : null,
              href: row.href,
              canAccept: true,
              inbound: null,
            },
          ];
        });
        return reviewStackSchema.parse({ items, minutes: Math.ceil(seconds / 60) });
      },
      { readOnly: true },
    );
  }

  /**
   * Entscheidung über einen Entwurf: Übernehmen (optional angepasst), Verwerfen mit Grund oder
   * Später (bis zum nächsten Morgen 07:00). Danach ist das Fokus-Thema erledigt.
   */
  async decide(auth: AuthContext, id: string, decision: ReviewDecision): Promise<ReviewResult> {
    const session = this.session(auth);
    if (!session || auth.supportOrganization) throw notFound();
    const record = await this.tenant.run(session, (tx) => this.record(tx, auth, id), {
      readOnly: true,
    });
    if (decision.decision === 'spaeter') {
      await this.tenant.run(session, (tx) =>
        tx
          .update(schema.focusItem)
          .set({ state: 'snoozed', snoozedUntil: nextMorning(currentTime()) })
          .where(eq(schema.focusItem.id, record.focusId)),
      );
      return { state: 'snoozed' };
    }
    if (record.sourceType === 'inbound') {
      await this.decideInbound(auth, record, decision);
    } else {
      if (record.status !== 'draft') {
        throw new ConflictException({ statusCode: 409, code: 'nicht_offen' });
      }
      if (neverHere.has(record.kind)) {
        throw new ConflictException({ statusCode: 409, code: 'nicht_in_kurz_pruefen' });
      }
      await this.decideDraft(auth, record, decision);
    }
    await this.tenant.run(session, (tx) =>
      tx
        .update(schema.focusItem)
        .set({ state: 'decided', snoozedUntil: null })
        .where(eq(schema.focusItem.id, record.focusId)),
    );
    return { state: decision.decision === 'uebernehmen' ? 'accepted' : 'discarded' };
  }

  /**
   * Eigenes, offenes Fokus-Thema der Stufe review mit seinem Entwurf oder Eingang; dazu ein
   * Vorschlag zum Zuordnen der Stufe focus (Aufgabe Postfach auf Vorschlagen, MA-01)
   */
  private async record(tx: TenantTransaction, auth: AuthContext, id: string): Promise<DraftRecord> {
    const [focus] = await tx
      .select()
      .from(schema.focusItem)
      .where(
        and(
          eq(schema.focusItem.id, id),
          eq(schema.focusItem.userId, auth.userId),
          or(
            eq(schema.focusItem.level, 'review'),
            and(eq(schema.focusItem.level, 'focus'), eq(schema.focusItem.sourceType, 'inbound')),
          ),
          eq(schema.focusItem.state, 'open'),
        ),
      );
    if (!focus) throw notFound();
    if (focus.sourceType === 'inbound') {
      return {
        focusId: focus.id,
        sourceType: 'inbound',
        sourceId: focus.sourceId,
        kind: 'inbound',
        objectType: 'inbound_item',
        objectId: focus.sourceId,
        relationshipId: focus.relationshipId,
        content: '',
        status: 'draft',
      };
    }
    if (focus.sourceType !== 'ai_draft') throw notFound();
    const [draft] = await tx
      .select()
      .from(schema.aiDraft)
      .where(and(eq(schema.aiDraft.id, focus.sourceId), eq(schema.aiDraft.createdBy, auth.userId)));
    if (!draft) throw notFound();
    return {
      focusId: focus.id,
      sourceType: 'ai_draft',
      sourceId: draft.id,
      kind: draft.kind,
      objectType: draft.objectType,
      objectId: draft.objectId,
      relationshipId: draft.relationshipId,
      content: draft.content,
      status: draft.status,
    };
  }

  /** Eingang zuordnen: Übernehmen nimmt den Vorschlag, Verwerfen ignoriert den Termin */
  private async decideInbound(auth: AuthContext, record: DraftRecord, decision: ReviewDecision) {
    if (decision.decision === 'verwerfen') {
      await this.intake.decide(auth, record.sourceId, { action: 'ignore' });
      return;
    }
    const inbox = await this.intake.inbox(auth);
    const item = inbox.open.find((entry) => entry.id === record.sourceId);
    if (!item) throw notFound();
    // Die Wahl der Person geht vor den Vorschlag (mehrere oder kein Vorschlag).
    if (decision.decision === 'uebernehmen' && decision.asEvent) {
      await this.intake.decide(auth, item.id, { action: 'event' });
      return;
    }
    if (decision.decision === 'uebernehmen' && decision.relationshipIds) {
      await this.intake.decide(auth, item.id, {
        action: 'assign',
        relationshipIds: decision.relationshipIds,
        type: item.suggestedType,
      });
      return;
    }
    if (item.suggestionKind === 'event') {
      await this.intake.decide(auth, item.id, { action: 'event' });
      return;
    }
    const [only] = item.suggestions;
    if (item.suggestionKind !== 'supplier' || item.suggestions.length !== 1 || !only) {
      // Mehrere oder kein Vorschlag: die Wahl trifft die Person in Neu eingegangen.
      throw unprocessable('auswahl_noetig');
    }
    await this.intake.decide(auth, item.id, {
      action: 'assign',
      relationshipIds: [only.relationshipId],
      type: item.suggestedType,
    });
  }

  /** Entwurf über den Dienst seines Moduls übernehmen oder verwerfen */
  private async decideDraft(auth: AuthContext, record: DraftRecord, decision: ReviewDecision) {
    const accepted = decision.decision === 'uebernehmen';
    const reason = decision.decision === 'verwerfen' ? decision.reason : undefined;
    const text = decision.decision === 'uebernehmen' ? decision.text : undefined;
    const relationshipId = record.relationshipId;
    if (!relationshipId) throw notFound();
    const { kind, objectId: objectIdOf, sourceId: draftId } = record;
    if (kind.startsWith('brief_')) {
      await this.brief.decide(
        auth,
        relationshipId,
        objectIdOf,
        draftId,
        accepted ? { status: 'accepted' } : { status: 'discarded', reason: reason ?? null },
      );
      return;
    }
    if (kind.startsWith('capture_')) {
      if (!accepted) {
        await this.capture.discard(auth, relationshipId, objectIdOf, draftId, reason ?? null);
        return;
      }
      if (text) {
        // Dieselben Grenzen wie beim Ändern am Termin
        const edit = editCaptureItemSchema.safeParse({ title: text });
        if (!edit.success) throw unprocessable('text_ungueltig');
        await this.capture.edit(auth, relationshipId, objectIdOf, draftId, edit.data);
      }
      await this.capture.accept(auth, relationshipId, objectIdOf, [draftId]);
      return;
    }
    switch (kind) {
      case 'pre_read': {
        // Dieselben Grenzen wie am Termin (Wortzahl des Pre-Reads)
        const input = acceptPreReadSchema.safeParse({ content: text ?? record.content });
        if (accepted && !input.success) throw unprocessable('text_ungueltig');
        await this.preRead.decide(
          'buyer',
          auth,
          relationshipId,
          objectIdOf,
          draftId,
          accepted && input.success
            ? { status: 'accepted', input: input.data }
            : { status: 'discarded', reason },
        );
        return;
      }
      case 'plan_summary':
        await this.planSummary.decide(
          auth,
          relationshipId,
          objectIdOf,
          draftId,
          accepted ? 'accepted' : 'discarded',
          reason,
          text,
        );
        return;
      case 'feedback_themes':
        await this.themes.decide(
          'buyer',
          auth,
          relationshipId,
          objectIdOf,
          draftId,
          accepted ? 'accepted' : 'discarded',
          reason,
          text,
        );
        return;
      case 'deviation_explanation':
        await this.deviations.decide(
          auth,
          relationshipId,
          draftId,
          accepted ? 'accepted' : 'discarded',
          reason,
          text,
        );
        return;
      case 'agent_result':
        if (accepted) await this.customAgents.accept(auth, draftId);
        else {
          await this.customAgents.discard(auth, draftId);
          await this.keepReason(auth, draftId, reason);
        }
        return;
      default:
        await this.decideOwn(auth, draftId, accepted, reason);
    }
  }

  /** Verwerfen merkt sich den Grund, auch wo das Modul selbst keinen kennt */
  private async keepReason(auth: AuthContext, draftId: string, reason: string | undefined) {
    const session = this.session(auth);
    if (!session || !reason) return;
    await this.tenant.run(session, (tx) =>
      tx
        .update(schema.aiDraft)
        .set({ dismissReason: reason })
        .where(and(eq(schema.aiDraft.id, draftId), eq(schema.aiDraft.status, 'discarded'))),
    );
  }

  /**
   * Entwürfe ohne eigenen Dienst (z. B. die frühere QBR-Vorbereitung): nur der Stand, mit Person,
   * Zeit und Grund. Nur eigene, offene Entwürfe.
   */
  private async decideOwn(
    auth: AuthContext,
    draftId: string,
    accepted: boolean,
    reason: string | undefined,
  ) {
    const session = this.session(auth);
    if (!session) throw notFound();
    const changed = await this.tenant.run(session, (tx) =>
      tx
        .update(schema.aiDraft)
        .set({
          status: accepted ? 'accepted' : 'discarded',
          dismissReason: accepted ? null : (reason ?? null),
          decidedBy: auth.userId,
          decidedAt: currentTime(),
        })
        .where(
          and(
            eq(schema.aiDraft.id, draftId),
            eq(schema.aiDraft.createdBy, auth.userId),
            eq(schema.aiDraft.status, 'draft'),
          ),
        )
        .returning({ id: schema.aiDraft.id }),
    );
    if (changed.length === 0) throw new ConflictException({ statusCode: 409, code: 'nicht_offen' });
  }
}
