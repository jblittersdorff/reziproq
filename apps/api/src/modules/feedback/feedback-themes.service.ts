import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  and,
  auditedChange,
  currentTime,
  desc,
  eq,
  inArray,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type FeedbackThemes,
  feedbackThemesOf,
  feedbackThemesSchema,
  maxFeedbackThemes,
  minFreeTextsForThemes,
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
import { quotes } from '../ai-drafts/quotes.js';
import { gatewayContext } from '../ai-gateway/model-gateway.js';
import { actorOf } from '../audit/actor.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { type WaveScope, WavesService } from './waves.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

const kind = 'feedback_themes' as const;
const objectType = 'survey_wave';

const system = [
  'Du fasst die Freitexte einer Feedback-Umfrage zwischen Käufer und Lieferant zusammen.',
  `Nenne höchstens ${maxFeedbackThemes} Themen, je Thema eine Zeile mit genau einem Satz auf`,
  'Deutsch, beginnend mit „- “. Formuliere mit eigenen Worten: keine wörtlichen Zitate, keine',
  'Namen von Personen, keine Funktionen oder Abteilungen. Erfinde nichts, was nicht in den',
  'Freitexten steht.',
].join(' ');

type DraftRow = typeof schema.aiDraft.$inferSelect;
type Side = 'buyer' | 'supplier';

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
 * PUL-08: Die KI fasst die Freitexte der anderen Seite einer Welle zu höchstens fünf Themen
 * zusammen. Erzeugen, Übernehmen und Verwerfen dürfen SRO bzw. Key Account Manager und Admins;
 * jede Seite sieht nur ihre eigene Zusammenfassung (ai_draft ist org_private).
 */
@Injectable()
export class FeedbackThemesService {
  constructor(
    @Inject(WavesService) private readonly waves: WavesService,
    @Inject(DRAFT_MODEL) private readonly model: DraftModel,
  ) {}

  private scoped<T>(
    side: Side,
    auth: AuthContext,
    relationshipId: string,
    work: (scope: WaveScope) => Promise<T>,
  ) {
    return side === 'buyer'
      ? this.waves.buyer(auth, relationshipId, work)
      : this.waves.supplier(auth, relationshipId, work);
  }

  private canSummarize(scope: WaveScope) {
    return scope.auth.orgRole === 'admin' || scope.teamRole === 'sro';
  }

  /** Freitexte der anderen Seite; es gibt sie erst nach der Aufdeckung (PUL-03). */
  private async freeTexts(scope: WaveScope, waveId: string) {
    const [wave] = await scope.tx
      .select({ id: schema.surveyWave.id })
      .from(schema.surveyWave)
      .where(
        and(
          eq(schema.surveyWave.id, waveId),
          eq(schema.surveyWave.relationshipId, scope.relationshipId),
          sql`${schema.surveyWave.revealedAt} is not null`,
        ),
      );
    if (!wave) throw notFound();
    const rows = await scope.tx
      .select({ text: schema.surveyFreeText.text })
      .from(schema.surveyFreeText)
      .where(
        and(
          eq(schema.surveyFreeText.waveId, waveId),
          eq(schema.surveyFreeText.side, scope.side === 'buyer' ? 'supplier' : 'buyer'),
        ),
      );
    return rows.map((row) => row.text);
  }

  private async view(scope: WaveScope, waveId: string, count: number): Promise<FeedbackThemes> {
    const canSummarize = this.canSummarize(scope);
    const rows = await scope.tx
      .select()
      .from(schema.aiDraft)
      .where(this.ofWave(scope, waveId, ['draft', 'accepted']))
      .orderBy(desc(schema.aiDraft.createdAt), desc(schema.aiDraft.id));
    const draft = rows.find((row) => row.status === 'draft');
    const accepted = rows.find((row) => row.status === 'accepted');
    const evidence =
      canSummarize && scope.side === 'buyer'
        ? await draftEvidence(scope.tx, rows)
        : () => undefined;
    return feedbackThemesSchema.parse({
      freeTexts: count,
      canSummarize,
      draft: canSummarize && draft ? toDraft(draft, evidence(draft)) : null,
      accepted: accepted ? toDraft(accepted, evidence(accepted)) : null,
    });
  }

  private ofWave(scope: WaveScope, waveId: string, statuses: DraftRow['status'][]) {
    return and(
      eq(schema.aiDraft.orgId, scope.orgId),
      eq(schema.aiDraft.relationshipId, scope.relationshipId),
      eq(schema.aiDraft.kind, kind),
      eq(schema.aiDraft.objectId, waveId),
      inArray(schema.aiDraft.status, statuses),
    );
  }

  get(side: Side, auth: AuthContext, relationshipId: string, waveId: string) {
    return this.scoped(side, auth, relationshipId, async (scope) =>
      this.view(scope, waveId, (await this.freeTexts(scope, waveId)).length),
    );
  }

  /** „Freitexte zusammenfassen“: ab drei Freitexten ein Entwurf ohne Zitate. */
  async summarize(side: Side, auth: AuthContext, relationshipId: string, waveId: string) {
    const prepared = await this.scoped(side, auth, relationshipId, async (scope) => {
      if (!this.canSummarize(scope)) throw forbidden();
      const texts = await this.freeTexts(scope, waveId);
      if (texts.length < minFreeTextsForThemes) {
        throw new ConflictException({
          statusCode: 409,
          code: 'zu_wenige_freitexte',
          message: `Eine Zusammenfassung braucht mindestens ${minFreeTextsForThemes} Freitexte.`,
        });
      }
      const people = await scope.tx.select({ name: schema.appUser.name }).from(schema.appUser);
      const names = people.map((person) => person.name);
      return { texts, cleaned: texts.map((text) => withoutNames(text, names)) };
    });

    const prompt = ['Freitexte:', ...prepared.cleaned.map((text) => `- ${text}`)].join('\n');
    // Zitiert der Entwurf doch, fragt Reziproq ein zweites Mal mit deutlicher Vorgabe.
    let content = '';
    for (const attempt of [0, 1]) {
      const written = await this.model.write({
        context: gatewayContext(auth, 'feedback_themes'),
        system:
          attempt === 0
            ? system
            : `${system} Wichtig: Übernimm nie mehr als vier Wörter am Stück aus einem Freitext.`,
        prompt,
        maxOutputTokens: 500,
      });
      const themes = feedbackThemesOf(written);
      const candidate = themes.map((theme) => `- ${theme}`).join('\n');
      if (themes.length > 0 && !quotes(candidate, [...prepared.texts, ...prepared.cleaned])) {
        content = candidate;
        break;
      }
    }
    if (!content) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'zitat',
        message: 'Der Entwurf enthielt Zitate und wurde nicht gespeichert. Bitte erneut versuchen.',
      });
    }

    return this.scoped(side, auth, relationshipId, async (scope) => {
      if (!this.canSummarize(scope)) throw forbidden();
      // Ein neuer Entwurf ersetzt den offenen; die übernommene Zusammenfassung bleibt.
      await scope.tx.delete(schema.aiDraft).where(this.ofWave(scope, waveId, ['draft']));
      const draft = {
        orgId: scope.orgId,
        relationshipId: scope.relationshipId,
        kind,
        objectType,
        objectId: waveId,
        content,
        model: draftModelName(this.model, 'feedback_themes'),
        createdBy: auth.userId,
      };
      if (scope.side === 'buyer') {
        await createBuyerDraft(
          scope.tx,
          draft,
          feedbackThemesOf(content).map((text) => ({
            text,
            sources: [ownDraftSource(objectType, waveId, 'Aufgedecktes Feedback')],
          })),
        );
      } else {
        await scope.tx.insert(schema.aiDraft).values(draft);
      }
      return this.view(scope, waveId, prepared.texts.length);
    });
  }

  decide(
    side: Side,
    auth: AuthContext,
    relationshipId: string,
    waveId: string,
    draftId: string,
    decision: 'accepted' | 'discarded',
    reason?: string,
    editedContent?: string,
  ) {
    return this.scoped(side, auth, relationshipId, async (scope) => {
      if (!this.canSummarize(scope)) throw forbidden();
      const texts = await this.freeTexts(scope, waveId);
      const [row] = await scope.tx
        .select()
        .from(schema.aiDraft)
        .where(
          and(
            this.ofWave(scope, waveId, ['draft', 'accepted', 'discarded']),
            eq(schema.aiDraft.id, draftId),
          ),
        )
        .for('update');
      if (!row) throw notFound();
      if (row.status !== 'draft') {
        throw new ConflictException({ statusCode: 409, code: 'schon_entschieden' });
      }
      let content = row.content;
      if (row.claims !== null && decision === 'accepted' && editedContent !== undefined) {
        content = feedbackThemesOf(editedContent)
          .map((theme) => `- ${theme}`)
          .join('\n');
        if (!content || quotes(content, texts)) {
          throw new UnprocessableEntityException({ statusCode: 422, code: 'zitat' });
        }
      }
      await this.apply(scope.tx, scope, waveId, row, decision, content, reason);
      return this.view(scope, waveId, texts.length);
    });
  }

  private async apply(
    tx: TenantTransaction,
    scope: WaveScope,
    waveId: string,
    row: DraftRow,
    decision: 'accepted' | 'discarded',
    content: string,
    reason?: string,
  ) {
    const now = currentTime();
    if (decision === 'accepted') {
      // Je Welle gilt eine übernommene Zusammenfassung; die vorige tritt zurück.
      await tx
        .update(schema.aiDraft)
        .set({ status: 'discarded', decidedBy: scope.auth.userId, decidedAt: now })
        .where(this.ofWave(scope, waveId, ['accepted']));
    }
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    await auditedChange(tx, actor, aiDraftAudit, async () => {
      await tx
        .update(schema.aiDraft)
        .set({
          status: decision,
          content,
          edited: content !== row.content,
          dismissReason: decision === 'discarded' && row.claims !== null ? reason || null : null,
          decidedBy: scope.auth.userId,
          decidedAt: now,
        })
        .where(eq(schema.aiDraft.id, row.id));
      return {
        relationshipId: scope.relationshipId,
        objectId: row.id,
        action: 'updated' as const,
        before: { status: 'draft' },
        after: { status: decision },
        result: null,
      };
    });
  }
}
