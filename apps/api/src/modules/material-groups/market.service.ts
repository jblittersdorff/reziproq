import {
  BadRequestException,
  ForbiddenException,
  HttpException,
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
  analysisViewKeys,
  lastFullYear,
  type MarketAnalysis,
  type MarketForceKey,
  marketAnalysisSchema,
  marketDraftOutputSchema,
  marketForceKeys,
  type SaveMarketForce,
  saveMarketForceSchema,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import { withoutNames } from '../ai-drafts/anonymize.js';
import { aiDraftAudit } from '../ai-drafts/audit.js';
import { DRAFT_MODEL, type DraftModel, draftModelName } from '../ai-drafts/draft-model.js';
import { gatewayContext } from '../ai-gateway/model-gateway.js';
import { actorOf } from '../audit/actor.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { StrategyService } from './strategy.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

const kind = 'market_analysis' as const;
const objectType = 'material_group_strategy';
const step = 5;

interface StoredPoint {
  text: string;
  sourceIds: string[];
}
interface Assessment {
  today: 'low' | 'high' | null;
  future: 'low' | 'high' | null;
  relevant: boolean | null;
  points: StoredPoint[];
}

const viewNames: Record<string, string> = {
  volume: 'Volumen',
  supply_chain: 'Lieferkette',
  cost: 'Kosten',
  technology: 'Technologie',
  revenue_finance: 'Umsatz und Finanzen',
  quality: 'Qualität',
  footprint: 'Footprint',
};

const system = [
  'Du entwirfst für einen Einkäufer die Marktanalyse einer Warengruppe mit sechs Marktkräften:',
  'supplier_power, customer_power, new_entrants, substitutes, external_factors, rivalry.',
  'Für jede Kraft: Einschätzung heute und in 3 bis 5 Jahren (low oder high), ob sie für die',
  'Strategie relevant ist, und zwei bis drei kurze Begründungspunkte auf Deutsch.',
  'Jeder Punkt nennt mindestens eine Quelle aus der Liste mit ihrem Kürzel (Q1, Q2 …).',
  'Stütze dich nur auf die Quellen, erfinde keine Zahlen, nenne keine Personen, ordne Kosten nie',
  'einem einzelnen Lieferanten zu. Dazu eine Zusammenschau in höchstens 80 Wörtern.',
  'Antworte nur mit JSON: {"forces":[{"force":"…","today":"low|high","future":"low|high",',
  '"relevant":true,"points":[{"text":"…","sources":["Q1"]}]}],"synthesis":"…"}',
].join(' ');

/** Den JSON-Teil aus der Antwort des Modells lesen; ohne gültiges JSON gibt es keinen Entwurf. */
export function parseMarketDraft(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = marketDraftOutputSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * WG-09: Marktanalyse in Schritt 5. Ein Entwurf entsteht nur auf Anforderung; Aussagen ohne Quelle
 * fallen weg. Bestätigte Kräfte ersetzt ein neuer Entwurf nie, er liegt daneben als Vorschlag.
 */
@Injectable()
export class MarketService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(StrategyService) private readonly strategies: StrategyService,
    @Inject(DRAFT_MODEL) private readonly model: DraftModel,
  ) {}

  private run<T>(
    auth: AuthContext,
    work: (tx: TenantTransaction, organization: AccountOrganization) => Promise<T>,
  ): Promise<T> {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, (tx) =>
      work(tx, organization),
    );
  }

  private async editable(tx: TenantTransaction, auth: AuthContext, strategyId: string) {
    const access = await this.strategies.accessIn(tx, auth, strategyId);
    if (!access.editableSteps.includes(step)) throw forbidden();
    return access;
  }

  get(auth: AuthContext, strategyId: string): Promise<MarketAnalysis> {
    return this.run(auth, async (tx) => {
      const access = await this.strategies.accessIn(tx, auth, strategyId);
      return this.view(tx, strategyId, access.editableSteps.includes(step));
    });
  }

  private async view(
    tx: TenantTransaction,
    strategyId: string,
    canEdit: boolean,
  ): Promise<MarketAnalysis> {
    const rows = await tx
      .select({
        force: schema.materialGroupMarketForce,
        confirmedByName: schema.appUser.name,
      })
      .from(schema.materialGroupMarketForce)
      .leftJoin(schema.appUser, eq(schema.appUser.id, schema.materialGroupMarketForce.confirmedBy))
      .where(eq(schema.materialGroupMarketForce.strategyId, strategyId));
    const sources = await tx
      .select()
      .from(schema.aiSource)
      .where(
        and(eq(schema.aiSource.targetType, objectType), eq(schema.aiSource.targetId, strategyId)),
      );
    const [latest] = await tx
      .select()
      .from(schema.aiDraft)
      .where(
        and(
          eq(schema.aiDraft.kind, kind),
          eq(schema.aiDraft.objectType, objectType),
          eq(schema.aiDraft.objectId, strategyId),
        ),
      )
      .orderBy(desc(schema.aiDraft.createdAt))
      .limit(1);
    const sourceOf = (id: string) => {
      const row = sources.find((entry) => entry.id === id);
      return row
        ? {
            id: row.id,
            kind: row.kind,
            title: row.title,
            url: row.url,
            publishedAt: row.publishedAt,
          }
        : null;
    };
    const assessment = (value: Assessment) => ({
      today: value.today,
      future: value.future,
      relevant: value.relevant,
      points: value.points.map((point) => ({
        text: point.text,
        sources: point.sourceIds.flatMap((id) => {
          const source = sourceOf(id);
          return source ? [source] : [];
        }),
      })),
    });
    const forces = marketForceKeys.flatMap((force) => {
      const entry = rows.find((row) => row.force.force === force);
      if (!entry) return [];
      const row = entry.force;
      return [
        {
          force,
          status: row.status,
          ...assessment({
            today: row.today,
            future: row.future,
            relevant: row.relevant,
            points: row.points as StoredPoint[],
          }),
          confirmedBy: entry.confirmedByName,
          confirmedAt: row.confirmedAt?.toISOString() ?? null,
          proposal: row.proposal ? assessment(row.proposal as Assessment) : null,
        },
      ];
    });
    const synthesis =
      latest && latest.status === 'draft'
        ? (JSON.parse(latest.content) as { synthesis?: string }).synthesis?.trim()
        : undefined;
    return marketAnalysisSchema.parse({
      canEdit,
      forces,
      confirmedCount: forces.filter((force) => force.status === 'confirmed').length,
      researchedAt: latest?.createdAt.toISOString() ?? null,
      sourceCount: sources.filter((source) => source.draftId === latest?.id).length,
      publicResearch: false,
      synthesisDraft: latest && synthesis ? { id: latest.id, text: synthesis } : null,
    });
  }

  /** Grundlage des Entwurfs: eigene Daten der Warengruppe, je als Quelle mit Kürzel. */
  private async ownSources(
    tx: TenantTransaction,
    orgId: string,
    strategyId: string,
    groupId: string,
  ) {
    const people = await tx
      .select({ name: schema.appUser.name })
      .from(schema.appUser)
      .where(eq(schema.appUser.organizationId, orgId));
    const names = people.map((person) => person.name);
    const notes = await tx
      .select()
      .from(schema.materialGroupNote)
      .where(
        and(
          eq(schema.materialGroupNote.strategyId, strategyId),
          inArray(schema.materialGroupNote.step, [3, 4]),
        ),
      );
    const items: { title: string; text: string }[] = [];
    for (const view of analysisViewKeys) {
      // Kartellrecht: die Kostensicht geht nicht an die KI.
      if (view === 'cost') continue;
      const note = notes.find((entry) => entry.view === view && entry.text.trim());
      if (note) {
        items.push({
          title: `${note.step === 3 ? 'Interne Analyse' : 'Lieferantenanalyse'} · ${viewNames[view]}`,
          text: withoutNames(note.text, names),
        });
      }
    }
    const year = lastFullYear();
    const spend = await tx
      .select({
        amount: schema.relationshipSpend.amountCents,
        currency: schema.relationshipSpend.currency,
        relationshipId: schema.relationshipSpend.relationshipId,
      })
      .from(schema.relationshipSpend)
      .where(
        and(
          eq(schema.relationshipSpend.materialGroupId, groupId),
          eq(schema.relationshipSpend.year, year),
          eq(schema.relationshipSpend.kind, 'actual'),
        ),
      );
    if (spend.length) {
      const total = spend.reduce((sum, row) => sum + row.amount, 0);
      const bySupplier = new Map<string, number>();
      for (const row of spend) {
        bySupplier.set(row.relationshipId, (bySupplier.get(row.relationshipId) ?? 0) + row.amount);
      }
      const shares = [...bySupplier.values()]
        .sort((a, b) => b - a)
        .slice(0, 5)
        .map((value) => `${Math.round((value / total) * 100)} %`);
      items.push({
        title: `Spend ${year} der Warengruppe`,
        text: `${bySupplier.size} Lieferanten; Anteile der größten: ${shares.join(', ')}.`,
      });
    }
    return items;
  }

  /** „Neu recherchieren“ und der erste Entwurf */
  draft(auth: AuthContext, strategyId: string): Promise<MarketAnalysis> {
    return this.run(auth, async (tx, organization) => {
      const { group, strategy } = await this.editable(tx, auth, strategyId);
      const items = await this.ownSources(tx, organization.id, strategyId, group.id);
      if (!items.length) {
        throw new HttpException(
          {
            statusCode: 409,
            code: 'no_sources',
            message: 'Ohne Analysen und Spend hat Reziproq keine Grundlage für einen Entwurf.',
          },
          409,
        );
      }
      const prompt = [
        `Marktkräfte: Warengruppe ${group.name}`,
        'Quellen:',
        ...items.map((item, index) => `Q${index + 1} ${item.title}: ${item.text}`),
      ].join('\n');
      const output = parseMarketDraft(
        await this.model.write({
          context: gatewayContext(auth, 'market_analysis'),
          system,
          prompt,
          maxOutputTokens: 1600,
        }),
      );
      if (!output) {
        throw new HttpException(
          { statusCode: 502, code: 'draft_failed', message: 'Der Entwurf ist nicht gelungen.' },
          502,
        );
      }

      const actor = await actorOf(tx, auth, organization.id);
      const draftId = await auditedChange(tx, actor, aiDraftAudit, async () => {
        const [row] = await tx
          .insert(schema.aiDraft)
          .values({
            orgId: organization.id,
            kind,
            objectType,
            objectId: strategyId,
            content: JSON.stringify(output),
            model: draftModelName(this.model, 'market_analysis'),
            createdBy: auth.userId,
          })
          .returning({ id: schema.aiDraft.id });
        if (!row) throw new Error('Entwurf nicht angelegt');
        return {
          relationshipId: null,
          objectId: row.id,
          action: 'created' as const,
          after: { status: 'draft' },
          result: row.id,
        };
      });
      const stored = await tx
        .insert(schema.aiSource)
        .values(
          items.map((item) => ({
            orgId: organization.id,
            draftId,
            targetType: objectType,
            targetId: strategyId,
            kind: 'own_data' as const,
            title: item.title,
          })),
        )
        .returning({ id: schema.aiSource.id });
      const idOf = (code: string) => {
        const index = Number(/^Q(\d+)$/.exec(code.trim())?.[1] ?? 0) - 1;
        return stored[index]?.id ?? null;
      };

      const existing = await tx
        .select()
        .from(schema.materialGroupMarketForce)
        .where(eq(schema.materialGroupMarketForce.strategyId, strategyId));
      for (const force of output.forces) {
        // Aussagen ohne gültige Quelle werden nicht ausgegeben (WG-23).
        const points: StoredPoint[] = force.points.flatMap((point) => {
          const sourceIds = [
            ...new Set(point.sources.map(idOf).filter((id): id is string => id !== null)),
          ];
          return sourceIds.length ? [{ text: point.text.trim(), sourceIds }] : [];
        });
        const assessment: Assessment = {
          today: force.today,
          future: force.future,
          relevant: force.relevant,
          points: points.slice(0, 3),
        };
        const row = existing.find((entry) => entry.force === force.force);
        if (row?.status === 'confirmed') {
          await tx
            .update(schema.materialGroupMarketForce)
            .set({ proposal: assessment, updatedAt: new Date() })
            .where(eq(schema.materialGroupMarketForce.id, row.id));
        } else {
          await tx
            .insert(schema.materialGroupMarketForce)
            .values({
              orgId: organization.id,
              strategyId,
              force: force.force,
              ...assessment,
              status: 'draft',
            })
            .onConflictDoUpdate({
              target: [
                schema.materialGroupMarketForce.strategyId,
                schema.materialGroupMarketForce.force,
              ],
              set: { ...assessment, status: 'draft', updatedAt: new Date() },
            });
        }
      }
      await this.strategies.touchedIn(tx, strategy);
      return this.view(tx, strategyId, true);
    });
  }

  private async row(tx: TenantTransaction, strategyId: string, force: string) {
    if (!(marketForceKeys as readonly string[]).includes(force)) throw notFound();
    const [row] = await tx
      .select()
      .from(schema.materialGroupMarketForce)
      .where(
        and(
          eq(schema.materialGroupMarketForce.strategyId, strategyId),
          eq(schema.materialGroupMarketForce.force, force as MarketForceKey),
        ),
      );
    return row ?? null;
  }

  /** Bestätigen: der Entwurf bleibt, wie er ist, und zählt ab jetzt. */
  confirm(auth: AuthContext, strategyId: string, force: string): Promise<MarketAnalysis> {
    return this.run(auth, async (tx) => {
      const { strategy } = await this.editable(tx, auth, strategyId);
      const row = await this.row(tx, strategyId, force);
      if (!row) throw notFound();
      if (row.today === null || row.future === null || row.relevant === null) {
        throw new BadRequestException({ code: 'incomplete', message: 'Ungültige Eingabe' });
      }
      await tx
        .update(schema.materialGroupMarketForce)
        .set({ status: 'confirmed', confirmedBy: auth.userId, confirmedAt: new Date() })
        .where(eq(schema.materialGroupMarketForce.id, row.id));
      await this.strategies.touchedIn(tx, strategy);
      return this.view(tx, strategyId, true);
    });
  }

  /** Anpassen oder von Hand ausfüllen: die Person bestätigt damit, was sie einträgt. */
  save(
    auth: AuthContext,
    strategyId: string,
    force: string,
    input: SaveMarketForce,
  ): Promise<MarketAnalysis> {
    const value = saveMarketForceSchema.parse(input);
    return this.run(auth, async (tx, organization) => {
      const { strategy } = await this.editable(tx, auth, strategyId);
      if (!(marketForceKeys as readonly string[]).includes(force)) throw notFound();
      const existing = await this.row(tx, strategyId, force);
      // Ein Punkt, der wörtlich aus dem Entwurf stammt, behält seine Quellen.
      const sourcesOf = (text: string) =>
        ((existing?.points ?? []) as StoredPoint[]).find((point) => point.text === text)
          ?.sourceIds ?? [];
      const values = {
        today: value.today,
        future: value.future,
        relevant: value.relevant,
        points: value.points.map((text) => ({ text, sourceIds: sourcesOf(text) })),
        status: 'confirmed' as const,
        confirmedBy: auth.userId,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      };
      await tx
        .insert(schema.materialGroupMarketForce)
        .values({ orgId: organization.id, strategyId, force: force as MarketForceKey, ...values })
        .onConflictDoUpdate({
          target: [
            schema.materialGroupMarketForce.strategyId,
            schema.materialGroupMarketForce.force,
          ],
          set: values,
        });
      await this.strategies.touchedIn(tx, strategy);
      return this.view(tx, strategyId, true);
    });
  }

  /** Den neuen Entwurf neben dem bestätigten Stand übernehmen oder verwerfen. */
  decideProposal(
    auth: AuthContext,
    strategyId: string,
    force: string,
    decision: 'adopt' | 'dismiss',
  ): Promise<MarketAnalysis> {
    return this.run(auth, async (tx) => {
      const { strategy } = await this.editable(tx, auth, strategyId);
      const row = await this.row(tx, strategyId, force);
      if (!row?.proposal) throw notFound();
      const proposal = row.proposal as Assessment;
      await tx
        .update(schema.materialGroupMarketForce)
        .set(
          decision === 'adopt'
            ? {
                ...proposal,
                proposal: null,
                status: 'confirmed',
                confirmedBy: auth.userId,
                confirmedAt: new Date(),
                updatedAt: new Date(),
              }
            : { proposal: null, updatedAt: new Date() },
        )
        .where(eq(schema.materialGroupMarketForce.id, row.id));
      await this.strategies.touchedIn(tx, strategy);
      return this.view(tx, strategyId, true);
    });
  }

  /** Den Vorschlag für die Zusammenschau als Beobachtung von Schritt 5 übernehmen oder verwerfen. */
  decideSynthesis(
    auth: AuthContext,
    strategyId: string,
    draftId: string,
    decision: 'accepted' | 'discarded',
  ): Promise<MarketAnalysis> {
    return this.run(auth, async (tx, organization) => {
      await this.editable(tx, auth, strategyId);
      const [draft] = await tx
        .select()
        .from(schema.aiDraft)
        .where(
          and(
            eq(schema.aiDraft.id, draftId),
            eq(schema.aiDraft.kind, kind),
            eq(schema.aiDraft.objectId, strategyId),
            eq(schema.aiDraft.status, 'draft'),
          ),
        );
      if (!draft) throw notFound();
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, aiDraftAudit, async () => {
        await tx
          .update(schema.aiDraft)
          .set({ status: decision, decidedBy: auth.userId, decidedAt: new Date() })
          .where(eq(schema.aiDraft.id, draft.id));
        return {
          relationshipId: null,
          objectId: draft.id,
          action: 'updated' as const,
          before: { status: 'draft' },
          after: { status: decision },
          result: null,
        };
      });
      if (decision === 'accepted') {
        const text = (JSON.parse(draft.content) as { synthesis?: string }).synthesis?.trim() ?? '';
        if (text) {
          await tx
            .insert(schema.materialGroupNote)
            .values({
              orgId: organization.id,
              strategyId,
              step,
              view: '',
              text,
              updatedBy: auth.userId,
            })
            .onConflictDoUpdate({
              target: [
                schema.materialGroupNote.strategyId,
                schema.materialGroupNote.step,
                schema.materialGroupNote.view,
              ],
              set: { text, notApplicable: false, updatedBy: auth.userId, updatedAt: new Date() },
            });
        }
      }
      return this.view(tx, strategyId, true);
    });
  }
}
