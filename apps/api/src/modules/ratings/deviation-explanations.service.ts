import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  auditedChange,
  desc,
  eq,
  inArray,
  schema,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type AiDraft,
  type DeviationExplanations,
  deviationExplanationCount,
  deviationExplanationsSchema,
  type Segmentation,
  type UserFunction,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
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
import { ownRelationship, sroOf } from '../suppliers/team.service.js';
import { RatingsService } from './ratings.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });

const kind = 'deviation_explanation' as const;
const objectType = 'segmentation_round';

const functionNames: Record<UserFunction, string> = {
  purchasing: 'Einkauf',
  quality: 'Qualität',
  engineering: 'Entwicklung',
  logistics: 'Logistik',
  programs: 'Programme',
  after_sales: 'After Sales',
};

const system = [
  'Du hilfst einem Einkäufer, Abweichungen in der Segmentierung eines Lieferanten zu verstehen.',
  'Du bekommst ein Kriterium, die Ist-Werte der Bewertenden (0 bis 100) mit Business Unit und',
  'Funktion und ihre Begründungen. Erkläre in genau zwei Sätzen auf Deutsch, warum die Werte',
  'auseinandergehen. Stütze dich nur auf die Begründungen. Nenne keine Personen und erfinde nichts.',
].join(' ');

type Data = NonNullable<Segmentation['segmentation']>;

/** Die drei Kriterien mit der größten Spannweite der Ist-Werte, ohne Kriterien ohne Abweichung */
export function largestDeviations(segmentation: Data) {
  return segmentation.stats
    .map((stat) => ({ ...stat, range: stat.max - stat.min }))
    .filter((stat) => stat.range > 0)
    .sort((a, b) => b.range - a.range || a.criterionKey.localeCompare(b.criterionKey))
    .slice(0, deviationExplanationCount)
    .map((stat) => {
      const criterion = segmentation.model.criteria.find(
        (entry) => entry.key === stat.criterionKey,
      );
      const entries = segmentation.rows.flatMap((row) => {
        const value = row.values.find((entry) => entry.criterionKey === stat.criterionKey);
        if (value?.ist == null) return [];
        return [
          {
            businessUnit: row.businessUnit.name,
            materialGroup: row.materialGroup?.name ?? null,
            function: functionNames[row.function],
            ist: value.ist,
            reason: value.comment?.trim() || null,
          },
        ];
      });
      return {
        criterionKey: stat.criterionKey,
        criterionName: criterion?.name ?? stat.criterionKey,
        range: stat.range,
        entries,
        reasons: entries.filter((entry) => entry.reason).length,
      };
    });
}

/** Die Anfrage an die KI: Werte und Begründungen, die der SRO sehen darf, ohne Namen. */
export function explanationPrompt(
  deviation: ReturnType<typeof largestDeviations>[number],
  names: string[],
) {
  const lines = deviation.entries.map((entry) => {
    const where = [entry.businessUnit, entry.materialGroup, entry.function]
      .filter(Boolean)
      .join(', ');
    const reason = entry.reason ? withoutNames(entry.reason, names) : 'ohne Begründung';
    return `- ${withoutNames(where, names)}: ${entry.ist}. ${reason}`;
  });
  return [`Kriterium: ${deviation.criterionName}`, 'Bewertungen:', ...lines].join('\n');
}

type DraftRow = typeof schema.aiDraft.$inferSelect;

function toDraft(row: DraftRow, evidence?: DraftEvidence): AiDraft {
  return {
    ...draftDecision(row),
    ...evidence,
    id: row.id,
    status: row.status,
    content: row.content,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}

/**
 * SEG-11: Die KI erklärt die drei größten Abweichungen der Segmentierung in zwei Sätzen, aus den
 * Begründungen der Bewertenden. Erzeugen, Übernehmen und Verwerfen dürfen SRO und Admin; die
 * übernommene Erklärung sehen alle, die die Segmentierung sehen.
 */
@Injectable()
export class DeviationExplanationsService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(RatingsService) private readonly ratings: RatingsService,
    @Inject(DRAFT_MODEL) private readonly model: DraftModel,
  ) {}

  private organization(auth: AuthContext) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return organization;
  }

  private async context(tx: TenantTransaction, auth: AuthContext, relationshipId: string) {
    const organization = this.organization(auth);
    await ownRelationship(tx, organization, relationshipId);
    const sro = await sroOf(tx, organization, relationshipId);
    const canExplain = auth.orgRole === 'admin' || sro?.userId === auth.userId;
    const { segmentation } = await this.ratings.segmentationIn(
      tx,
      auth,
      organization.id,
      relationshipId,
    );
    return { organization, canExplain, segmentation };
  }

  private async view(
    tx: TenantTransaction,
    relationshipId: string,
    segmentation: Data | null,
    canExplain: boolean,
    withoutReasons: string[] = [],
  ): Promise<DeviationExplanations> {
    if (!segmentation) {
      return { roundId: null, explanations: [], canExplain, withoutReasons };
    }
    const rows = await tx
      .select()
      .from(schema.aiDraft)
      .where(
        and(
          eq(schema.aiDraft.relationshipId, relationshipId),
          eq(schema.aiDraft.kind, kind),
          eq(schema.aiDraft.objectId, segmentation.roundId),
          inArray(schema.aiDraft.status, ['draft', 'accepted']),
        ),
      )
      .orderBy(desc(schema.aiDraft.createdAt), desc(schema.aiDraft.id));
    const evidence = canExplain ? await draftEvidence(tx, rows) : () => undefined;
    return deviationExplanationsSchema.parse({
      roundId: segmentation.roundId,
      canExplain,
      withoutReasons,
      explanations: largestDeviations(segmentation).map((deviation) => {
        const of = (status: DraftRow['status']) =>
          rows.find((row) => row.subject === deviation.criterionKey && row.status === status);
        const draft = of('draft');
        const accepted = of('accepted');
        return {
          criterionKey: deviation.criterionKey,
          criterionName: deviation.criterionName,
          range: deviation.range,
          reasons: deviation.reasons,
          // Entwürfe sehen nur SRO und Admin; alle anderen nur übernommene Erklärungen.
          draft: canExplain && draft ? toDraft(draft, evidence(draft)) : null,
          accepted: accepted ? toDraft(accepted, evidence(accepted)) : null,
        };
      }),
    });
  }

  list(auth: AuthContext, relationshipId: string): Promise<DeviationExplanations> {
    const organization = this.organization(auth);
    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => {
        const { canExplain, segmentation } = await this.context(tx, auth, relationshipId);
        return this.view(tx, relationshipId, segmentation, canExplain);
      },
      { readOnly: true },
    );
  }

  /**
   * „Abweichungen erklären“: je der drei größten Abweichungen ein Entwurf. Ohne Begründungen
   * entsteht kein Entwurf; das Kriterium steht dann in withoutReasons.
   */
  async explain(auth: AuthContext, relationshipId: string): Promise<DeviationExplanations> {
    const organization = this.organization(auth);
    const session = { userId: auth.userId, organizationId: organization.id };
    // Erst lesen, dann die KI fragen, dann schreiben: Die Anfrage hält keine Transaktion offen.
    const prepared = await this.tenant.run(
      session,
      async (tx) => {
        const { canExplain, segmentation } = await this.context(tx, auth, relationshipId);
        if (!canExplain) throw forbidden();
        if (!segmentation) {
          throw new ConflictException({
            statusCode: 409,
            code: 'keine_bewertungen',
            message: 'Ohne abgegebene Bewertung gibt es keine Abweichung.',
          });
        }
        const people = await tx.select({ name: schema.appUser.name }).from(schema.appUser);
        const names = people.map((person) => person.name);
        return {
          roundId: segmentation.roundId,
          deviations: largestDeviations(segmentation).map((deviation) => ({
            criterionKey: deviation.criterionKey,
            prompt: deviation.reasons > 0 ? explanationPrompt(deviation, names) : null,
          })),
        };
      },
      { readOnly: true },
    );

    const withoutReasons = prepared.deviations
      .filter((deviation) => deviation.prompt === null)
      .map((deviation) => deviation.criterionKey);
    const written = await Promise.all(
      prepared.deviations.flatMap((deviation) =>
        deviation.prompt === null
          ? []
          : [
              this.model
                .write({
                  context: gatewayContext(auth, 'deviation_explanation'),
                  system,
                  prompt: deviation.prompt,
                  maxOutputTokens: 300,
                })
                .then((content) => ({ criterionKey: deviation.criterionKey, content })),
            ],
      ),
    );

    return this.tenant.run(session, async (tx) => {
      const { canExplain, segmentation } = await this.context(tx, auth, relationshipId);
      if (!canExplain) throw forbidden();
      if (segmentation?.roundId !== prepared.roundId) {
        throw new ConflictException({ statusCode: 409, code: 'bewertungsrunde_geaendert' });
      }
      for (const { criterionKey, content } of written) {
        // Ein neuer Entwurf ersetzt den offenen; übernommene Erklärungen bleiben.
        await tx
          .delete(schema.aiDraft)
          .where(
            and(
              eq(schema.aiDraft.relationshipId, relationshipId),
              eq(schema.aiDraft.kind, kind),
              eq(schema.aiDraft.objectId, prepared.roundId),
              eq(schema.aiDraft.subject, criterionKey),
              eq(schema.aiDraft.status, 'draft'),
            ),
          );
        if (!content) continue;
        const draft = {
          orgId: organization.id,
          relationshipId,
          kind,
          objectType,
          objectId: prepared.roundId,
          subject: criterionKey,
          content,
          model: draftModelName(this.model, 'deviation_explanation'),
          createdBy: auth.userId,
        };
        await createBuyerDraft(
          tx,
          draft,
          [content].map((text) => ({
            text,
            sources: [ownDraftSource(objectType, prepared.roundId, 'Abgegebene Bewertungen')],
          })),
        );
      }
      return this.view(tx, relationshipId, segmentation, canExplain, withoutReasons);
    });
  }

  /** Übernehmen oder Verwerfen eines offenen Entwurfs; verworfene verschwinden. */
  decide(
    auth: AuthContext,
    relationshipId: string,
    draftId: string,
    decision: 'accepted' | 'discarded',
    reason?: string,
    editedContent?: string,
  ): Promise<DeviationExplanations> {
    const organization = this.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const { canExplain, segmentation } = await this.context(tx, auth, relationshipId);
      if (!canExplain) throw forbidden();
      const [row] = await tx
        .select()
        .from(schema.aiDraft)
        .where(
          and(
            eq(schema.aiDraft.id, draftId),
            eq(schema.aiDraft.relationshipId, relationshipId),
            eq(schema.aiDraft.kind, kind),
          ),
        )
        .for('update');
      if (!row) throw new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
      if (row.status !== 'draft') {
        throw new ConflictException({
          statusCode: 409,
          code: 'schon_entschieden',
          message: 'Der Entwurf ist schon übernommen oder verworfen.',
        });
      }
      const actor = await actorOf(tx, auth, organization.id);
      const now = new Date();
      if (decision === 'accepted') {
        // Je Kriterium gilt eine übernommene Erklärung; die vorige tritt zurück.
        await tx
          .update(schema.aiDraft)
          .set({ status: 'discarded', decidedBy: auth.userId, decidedAt: now })
          .where(
            and(
              eq(schema.aiDraft.relationshipId, relationshipId),
              eq(schema.aiDraft.kind, kind),
              eq(schema.aiDraft.objectId, row.objectId),
              eq(schema.aiDraft.status, 'accepted'),
              row.subject === null
                ? eq(schema.aiDraft.id, row.id)
                : eq(schema.aiDraft.subject, row.subject),
            ),
          );
      }
      const content =
        row.claims !== null && decision === 'accepted'
          ? (editedContent ?? row.content)
          : row.content;
      await auditedChange(tx, actor, aiDraftAudit, async () => {
        await tx
          .update(schema.aiDraft)
          .set({
            status: decision,
            content,
            edited: content !== row.content,
            dismissReason: decision === 'discarded' && row.claims !== null ? reason || null : null,
            decidedBy: auth.userId,
            decidedAt: now,
          })
          .where(eq(schema.aiDraft.id, row.id));
        return {
          relationshipId,
          objectId: row.id,
          action: 'updated' as const,
          before: { status: 'draft' },
          after: { status: decision },
          result: null,
        };
      });
      return this.view(tx, relationshipId, segmentation, canExplain);
    });
  }
}
