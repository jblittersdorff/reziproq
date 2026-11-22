import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  auditedChange,
  desc,
  eq,
  inArray,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  limitWords,
  maxPlanSummaryWords,
  type PlanSummaryDraft,
  planSummaryDraftSchema,
  type SupplierPlanResponse,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { withoutNames } from '../ai-drafts/anonymize.js';
import { aiDraftAudit } from '../ai-drafts/audit.js';
import { DRAFT_MODEL, type DraftModel, draftModelName } from '../ai-drafts/draft-model.js';
import { gatewayContext } from '../ai-gateway/model-gateway.js';
import { actorOf } from '../audit/actor.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { ownRelationship } from '../suppliers/team.service.js';
import { SupplierPlansService } from './supplier-plans.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

const kind = 'plan_summary' as const;
const objectType = 'supplier_plan';

const dimensionNames: Record<string, string> = {
  trust: 'Vertrauen',
  collaboration: 'Zusammenarbeit',
  integration: 'Integration',
  transparency: 'Transparenz',
  strategy: 'Strategische Ausrichtung',
};

const system = [
  'Du schreibst für einen Einkäufer den Entwurf der Strategie-Zusammenfassung im Lieferantenplan',
  `eines Lieferanten. Höchstens ${maxPlanSummaryWords} Wörter, Deutsch, Fließtext ohne Aufzählung.`,
  'Sage, wohin sich die Beziehung entwickeln soll, warum und woran man den Fortschritt erkennt.',
  'Stütze dich nur auf die gegebenen Angaben, erfinde keine Zahlen und nenne keine Personen.',
].join(' ');

type Plan = NonNullable<SupplierPlanResponse['plan']>;
type DraftRow = typeof schema.aiDraft.$inferSelect;

const toDraft = (row: DraftRow) => ({
  id: row.id,
  status: row.status,
  content: row.content,
  model: row.model,
  createdAt: row.createdAt.toISOString(),
  decidedAt: row.decidedAt?.toISOString() ?? null,
});

/** Betrag in Cent als „15 Mio. EUR“, eine Nachkommastelle */
export const euro = (cents: number, currency: string) =>
  `${(Math.round(cents / 10_000_000) / 10).toLocaleString('de-DE')} Mio. ${currency}`;

/** Die Anfrage an die KI: Ziele, Themen, Soll-Typ, Feedback, Spend und Profil, ohne Namen */
export function planSummaryPrompt(
  input: {
    supplier: string;
    plan: Pick<Plan, 'targetType' | 'objectives' | 'topics'>;
    gaps: { dimension: string; buyer: number; supplier: number }[];
    spend: { year: number; cents: number; currency: string }[];
    profile: { employees: number | null; businessSegments: string | null } | null;
    financials: {
      year: number;
      metric: string;
      value: number;
      unit: string;
      currency: string | null;
    }[];
  },
  names: string[],
) {
  const clean = (text: string) => withoutNames(text, names);
  const lines = [`Lieferant: ${clean(input.supplier)}`];
  lines.push(`Soll-Typ: ${input.plan.targetType ?? 'noch nicht festgelegt'}`);
  lines.push('Ziele:');
  for (const objective of input.plan.objectives) {
    lines.push(
      `- ${objective.categoryName}, bis ${objective.targetYear}: ${clean(objective.text)}`,
    );
  }
  if (input.plan.objectives.length === 0) lines.push('- keine');
  lines.push('Themen:');
  for (const topic of input.plan.topics) {
    lines.push(`- ${clean(topic.title)}: ${clean(topic.reason)}`);
  }
  if (input.plan.topics.length === 0) lines.push('- keine');
  lines.push('Größte Feedback-Lücken (Ist Käufer gegen Ist Lieferant, Skala 1 bis 5):');
  for (const gap of input.gaps) {
    lines.push(
      `- ${dimensionNames[gap.dimension] ?? gap.dimension}: ${gap.buyer} gegen ${gap.supplier}`,
    );
  }
  if (input.gaps.length === 0) lines.push('- kein aufgedecktes Feedback');
  lines.push('Spend je Jahr:');
  for (const entry of input.spend) {
    lines.push(`- ${entry.year}: ${euro(entry.cents, entry.currency)}`);
  }
  if (input.spend.length === 0) lines.push('- kein Spend erfasst');
  if (input.profile?.employees) lines.push(`Mitarbeitende: ${input.profile.employees}`);
  if (input.profile?.businessSegments) {
    lines.push(`Geschäftsfelder: ${clean(input.profile.businessSegments)}`);
  }
  for (const entry of input.financials) {
    const value =
      entry.unit === 'basis_points'
        ? `${entry.value / 100} %`
        : euro(entry.value, entry.currency ?? 'EUR');
    lines.push(`Finanzen ${entry.year}, ${entry.metric}: ${value}`);
  }
  return lines.join('\n');
}

/**
 * SPL-10: KI-Entwurf der Strategie-Zusammenfassung. Erzeugen, Übernehmen und Verwerfen dürfen SRO
 * und Admin, solange der Plan ein Entwurf ist. Übernehmen setzt den Text nur ins Feld; Teil des
 * Plans wird er erst mit dem normalen Speichern (PATCH summary).
 */
@Injectable()
export class PlanSummaryDraftService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(SupplierPlansService) private readonly plans: SupplierPlansService,
    @Inject(DRAFT_MODEL) private readonly model: DraftModel,
  ) {}

  private session(auth: AuthContext) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return { organization, session: { userId: auth.userId, organizationId: organization.id } };
  }

  private async canDraft(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    relationshipId: string,
    planId: string,
  ) {
    const [plan] = await tx
      .select({ status: schema.supplierPlan.status })
      .from(schema.supplierPlan)
      .where(
        and(
          eq(schema.supplierPlan.id, planId),
          eq(schema.supplierPlan.relationshipId, relationshipId),
        ),
      );
    if (!plan) throw notFound();
    const { canManage } = await this.plans.relationshipPermissions(tx, auth, orgId, relationshipId);
    return canManage && plan.status === 'draft';
  }

  private ofPlan(orgId: string, relationshipId: string, planId: string) {
    return and(
      eq(schema.aiDraft.orgId, orgId),
      eq(schema.aiDraft.relationshipId, relationshipId),
      eq(schema.aiDraft.kind, kind),
      eq(schema.aiDraft.objectId, planId),
    );
  }

  private async view(
    tx: TenantTransaction,
    orgId: string,
    relationshipId: string,
    planId: string,
    canDraft: boolean,
  ): Promise<PlanSummaryDraft> {
    const [draft] = canDraft
      ? await tx
          .select()
          .from(schema.aiDraft)
          .where(
            and(this.ofPlan(orgId, relationshipId, planId), eq(schema.aiDraft.status, 'draft')),
          )
          .orderBy(desc(schema.aiDraft.createdAt))
          .limit(1)
      : [];
    return planSummaryDraftSchema.parse({ canDraft, draft: draft ? toDraft(draft) : null });
  }

  get(auth: AuthContext, relationshipId: string, planId: string) {
    const { organization, session } = this.session(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        await ownRelationship(tx, organization, relationshipId);
        const canDraft = await this.canDraft(tx, auth, organization.id, relationshipId, planId);
        return this.view(tx, organization.id, relationshipId, planId, canDraft);
      },
      { readOnly: true },
    );
  }

  /** Daten aus Profil, Finanzen, Spend und dem letzten aufgedeckten Feedback */
  private async context(tx: TenantTransaction, relationshipId: string) {
    const [supplier] = await tx
      .select({
        name: sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`,
      })
      .from(schema.relationship)
      .innerJoin(schema.organization, eq(schema.organization.id, schema.relationship.supplierOrgId))
      .leftJoin(
        schema.relationshipSide,
        and(
          eq(schema.relationshipSide.relationshipId, schema.relationship.id),
          eq(schema.relationshipSide.orgId, schema.relationship.buyerOrgId),
        ),
      )
      .where(eq(schema.relationship.id, relationshipId));
    const spendRows = await tx
      .select({
        year: schema.relationshipSpend.year,
        cents: sql<number>`sum(${schema.relationshipSpend.amountCents})::bigint`.mapWith(Number),
        currency: schema.relationshipSpend.currency,
      })
      .from(schema.relationshipSpend)
      .where(
        and(
          eq(schema.relationshipSpend.relationshipId, relationshipId),
          eq(schema.relationshipSpend.kind, 'actual'),
        ),
      )
      .groupBy(schema.relationshipSpend.year, schema.relationshipSpend.currency)
      .orderBy(desc(schema.relationshipSpend.year))
      .limit(3);
    const [profile] = await tx
      .select({
        employees: schema.supplierProfile.employees,
        businessSegments: schema.supplierProfile.businessSegments,
      })
      .from(schema.supplierProfile)
      .where(eq(schema.supplierProfile.relationshipId, relationshipId));
    const financials = await tx
      .select({
        year: schema.supplierFinancial.year,
        metric: schema.supplierFinancial.metric,
        value: schema.supplierFinancial.value,
        unit: schema.supplierFinancial.unit,
        currency: schema.supplierFinancial.currency,
      })
      .from(schema.supplierFinancial)
      .where(
        and(
          eq(schema.supplierFinancial.relationshipId, relationshipId),
          inArray(schema.supplierFinancial.metric, ['revenue', 'ebit_margin']),
        ),
      )
      .orderBy(desc(schema.supplierFinancial.year), asc(schema.supplierFinancial.metric))
      .limit(2);
    const [wave] = await tx
      .select({ id: schema.surveyWave.id })
      .from(schema.surveyWave)
      .where(
        and(
          eq(schema.surveyWave.relationshipId, relationshipId),
          sql`${schema.surveyWave.revealedAt} is not null`,
        ),
      )
      .orderBy(desc(schema.surveyWave.revealedAt))
      .limit(1);
    const results = wave
      ? await tx
          .select({
            side: schema.surveyResult.side,
            dimension: schema.surveyResult.dimension,
            ist: schema.surveyResult.istMean,
          })
          .from(schema.surveyResult)
          .where(
            and(
              eq(schema.surveyResult.waveId, wave.id),
              sql`${schema.surveyResult.function} is null`,
              sql`${schema.surveyResult.questionKey} is null`,
            ),
          )
      : [];
    const gaps = [...new Set(results.map((row) => row.dimension))]
      .flatMap((dimension) => {
        const of = (side: 'buyer' | 'supplier') =>
          results.find((row) => row.dimension === dimension && row.side === side)?.ist;
        const buyer = of('buyer');
        const supplierIst = of('supplier');
        return buyer == null || supplierIst == null
          ? []
          : [{ dimension, buyer: Number(buyer), supplier: Number(supplierIst) }];
      })
      .sort((a, b) => Math.abs(b.buyer - b.supplier) - Math.abs(a.buyer - a.supplier))
      .slice(0, 3);
    const people = await tx.select({ name: schema.appUser.name }).from(schema.appUser);
    return {
      supplier: supplier?.name ?? '',
      gaps,
      spend: spendRows,
      profile: profile ?? null,
      financials,
      names: people.map((person) => person.name),
    };
  }

  /** „Entwurf vorschlagen“: höchstens 120 Wörter */
  async propose(auth: AuthContext, relationshipId: string, planId: string) {
    const { organization, session } = this.session(auth);
    const { plan } = await this.plans.get(auth, relationshipId);
    if (!plan || plan.id !== planId) throw notFound();
    const prompt = await this.tenant.run(
      session,
      async (tx) => {
        if (!(await this.canDraft(tx, auth, organization.id, relationshipId, planId))) {
          throw forbidden();
        }
        const context = await this.context(tx, relationshipId);
        // Namen der Verantwortlichen bleiben draußen: Die Ziele gehen ohne owner an die KI.
        return planSummaryPrompt({ ...context, plan }, context.names);
      },
      { readOnly: true },
    );
    const written = await this.model.write({
      context: gatewayContext(auth, 'plan_summary'),
      system,
      prompt,
      maxOutputTokens: 400,
    });
    const content = limitWords(written, maxPlanSummaryWords);
    return this.tenant.run(session, async (tx) => {
      // Ein neuer Entwurf ersetzt den offenen.
      await tx
        .delete(schema.aiDraft)
        .where(
          and(
            this.ofPlan(organization.id, relationshipId, planId),
            eq(schema.aiDraft.status, 'draft'),
          ),
        );
      await tx.insert(schema.aiDraft).values({
        orgId: organization.id,
        relationshipId,
        kind,
        objectType,
        objectId: planId,
        content,
        model: draftModelName(this.model, 'plan_summary'),
        createdBy: auth.userId,
      });
      return this.view(tx, organization.id, relationshipId, planId, true);
    });
  }

  /** Übernehmen setzt den Text ins Feld, verwerfen lässt ihn verschwinden; der Plan bleibt gleich. */
  decide(
    auth: AuthContext,
    relationshipId: string,
    planId: string,
    draftId: string,
    decision: 'accepted' | 'discarded',
  ) {
    const { organization, session } = this.session(auth);
    return this.tenant.run(session, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      if (!(await this.canDraft(tx, auth, organization.id, relationshipId, planId))) {
        throw forbidden();
      }
      const [row] = await tx
        .select()
        .from(schema.aiDraft)
        .where(
          and(this.ofPlan(organization.id, relationshipId, planId), eq(schema.aiDraft.id, draftId)),
        );
      if (!row) throw notFound();
      if (row.status !== 'draft') {
        throw new ConflictException({ statusCode: 409, code: 'schon_entschieden' });
      }
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, aiDraftAudit, async () => {
        await tx
          .update(schema.aiDraft)
          .set({ status: decision, decidedBy: auth.userId, decidedAt: new Date() })
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
      return this.view(tx, organization.id, relationshipId, planId, true);
    });
  }
}
