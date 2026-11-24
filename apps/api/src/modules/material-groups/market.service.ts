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
  asc,
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
  analysisViewKeys,
  lastFullYear,
  type MarketAnalysis,
  type MarketForceKey,
  type MarketRun,
  marketAnalysisSchema,
  marketDraftOutputSchema,
  marketForceKeys,
  marketImplicationsOutputSchema,
  marketRunSchema,
  type SaveMarketForce,
  saveMarketForceSchema,
} from '@reziproq/shared';
import { z } from 'zod';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import { env } from '../../config/env.js';
import { withoutNames } from '../ai-drafts/anonymize.js';
import { aiDraftAudit } from '../ai-drafts/audit.js';
import { DRAFT_MODEL, type DraftModel, draftModelName } from '../ai-drafts/draft-model.js';
import { readAiSettings } from '../ai-gateway/ai-settings.js';
import { gatewayContext } from '../ai-gateway/model-gateway.js';
import { actorOf } from '../audit/actor.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { datedSources, fakeMarketFindings, queryAllowed } from '../opportunities/market.js';
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

/** KI-08: Systemagent Marktanalyse; Version erhöhen, wenn sich Ablauf oder Werkzeuge ändern. */
export const marketAgent = {
  key: 'market_analysis',
  version: 1,
  name: 'Marktanalyse',
  description:
    'Sammelt eigene und öffentliche Daten zu einer Warengruppe, schätzt die sechs Marktkräfte ein und leitet Implikationen ab.',
  tools: ['analysen', 'spend', 'lieferanten', 'leitfragen', 'web_search', 'fetch_source'],
  budgetCents: 200,
  maxSteps: 60,
} as const;

/** Die sieben Schritte des Laufs (KI-08) mit der Art des Protokollschritts */
const runSteps = [
  { key: 'plan', kind: 'plan' },
  { key: 'own_data', kind: 'read' },
  { key: 'public_sources', kind: 'search' },
  { key: 'forces', kind: 'model' },
  { key: 'check', kind: 'check' },
  { key: 'implications', kind: 'model' },
  { key: 'drafts', kind: 'draft' },
] as const;

const implicationsSystem = [
  'Leite aus den Marktkräften einer Warengruppe höchstens vier Chancen (opportunity) und Risiken',
  '(threat) ab, je ein Satz auf Deutsch mit Quelle (Q1, Q2 …) und, wenn passend, dem Namen eines',
  'Hebels aus dem Katalog. Keine Zahlen, die nicht in den Quellen stehen, keine Personen.',
  'Antworte nur mit JSON: {"items":[{"type":"opportunity|threat","text":"…","sources":["Q1"],"lever":"…"}]}',
].join(' ');

/** Was die Schritte ins Protokoll schreiben */
const runDetailSchema = {
  plan: z.object({ research: z.boolean() }),
  own: z.object({ sources: z.array(z.string()) }),
  search: z.object({
    blocked: z.number().int(),
    kept: marketRunSchema.shape.publicSources,
    discarded: marketRunSchema.shape.discardedSources,
  }),
  check: z.object({ discarded: marketRunSchema.shape.discardedPoints }),
  created: marketRunSchema.shape.created,
};

/** Wortstämme ab fünf Buchstaben, für den Abgleich einer Aussage mit ihrem Quellauszug */
const stems = (text: string) =>
  new Set((text.toLowerCase().match(/[a-zäöüß]{5,}/g) ?? []).map((word) => word.slice(0, 6)));

/**
 * KI-08, Schritt „Prüfen“: Eine Aussage gilt als gestützt, wenn sie mit mindestens einer ihrer
 * Quellen einen inhaltlichen Wortstamm teilt. Sonst fällt sie weg und steht im Protokoll.
 */
export function supports(statement: string, sources: string[]) {
  const own = stems(statement);
  return sources.some((source) => [...stems(source)].some((stem) => own.has(stem)));
}

export function parseImplications(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = marketImplicationsOutputSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

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
    const run = await this.lastRun(tx, strategyId);
    return marketAnalysisSchema.parse({
      canEdit,
      forces,
      confirmedCount: forces.filter((force) => force.status === 'confirmed').length,
      researchedAt: latest?.createdAt.toISOString() ?? null,
      sourceCount: sources.filter((source) => source.draftId === latest?.id).length,
      publicResearch: run?.publicResearch ?? false,
      synthesisDraft: latest && synthesis ? { id: latest.id, text: synthesis } : null,
      run,
    });
  }

  /**
   * KI-08: Protokoll des letzten Laufs. Es enthält nie Daten der Kostensicht (die gehen nicht an
   * die KI), nur Titel der eigenen Quellen, öffentliche Quellen, gesendete Anfragen und Verworfenes.
   */
  private async lastRun(tx: TenantTransaction, strategyId: string): Promise<MarketRun | null> {
    const [row] = await tx
      .select({ run: schema.agentRun, starter: schema.appUser.name })
      .from(schema.agentRun)
      .leftJoin(schema.appUser, eq(schema.appUser.id, schema.agentRun.startedBy))
      .where(
        and(
          eq(schema.agentRun.contextType, 'category_strategy'),
          eq(schema.agentRun.contextId, strategyId),
        ),
      )
      .orderBy(desc(schema.agentRun.createdAt))
      .limit(1);
    if (!row) return null;
    const steps = await tx
      .select()
      .from(schema.agentStep)
      .where(eq(schema.agentStep.runId, row.run.id))
      .orderBy(asc(schema.agentStep.seq));
    const outbound = await tx
      .select()
      .from(schema.agentOutboundQuery)
      .where(eq(schema.agentOutboundQuery.runId, row.run.id))
      .orderBy(asc(schema.agentOutboundQuery.sentAt));
    const detail = (seq: number) =>
      (steps.find((entry) => entry.seq === seq)?.detail ?? {}) as Record<string, unknown>;
    const plan = runDetailSchema.plan.safeParse(detail(1));
    const ownData = runDetailSchema.own.safeParse(detail(2));
    const search = runDetailSchema.search.safeParse(detail(3));
    const check = runDetailSchema.check.safeParse(detail(5));
    const created = runDetailSchema.created.safeParse(detail(7));
    return marketRunSchema.parse({
      id: row.run.id,
      status: row.run.status,
      createdAt: row.run.createdAt.toISOString(),
      startedBy: row.starter,
      publicResearch: plan.success ? plan.data.research : false,
      steps: steps.flatMap((entry) => {
        const key = runSteps[entry.seq - 1]?.key;
        return key ? [{ key, status: entry.status }] : [];
      }),
      ownSources: ownData.success ? ownData.data.sources : [],
      publicSources: search.success ? search.data.kept : [],
      discardedSources: search.success ? search.data.discarded : [],
      outbound: outbound.map((entry) => ({ text: entry.text, sentAt: entry.sentAt.toISOString() })),
      blockedQueries: search.success ? search.data.blocked : 0,
      discardedPoints: check.success ? check.data.discarded : [],
      created: created.success
        ? created.data
        : { forces: 0, opportunities: 0, threats: 0, levers: 0 },
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
    // Zahlen aus eigenen Daten, die nie in eine Suchanfrage dürfen (KI-08)
    const numbers: string[] = [];
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
      for (const amount of [total, ...spend.map((row) => row.amount)]) {
        numbers.push(String(amount), String(Math.round(amount / 100)));
      }
    }
    return { items, numbers };
  }

  /**
   * KI-08: „Recherche starten“ und „Neu recherchieren“ als Lauf des Systemagenten Marktanalyse mit
   * sieben Schritten: Plan, eigene Daten, öffentliche Quellen, Kräfte, Prüfen, Implikationen,
   * Entwürfe. Der Lauf handelt im Namen der Person, die startet; alles bleibt org_private.
   */
  async draft(auth: AuthContext, strategyId: string): Promise<MarketAnalysis> {
    return this.run(auth, async (tx, organization) => {
      const orgId = organization.id;
      const { group, strategy } = await this.editable(tx, auth, strategyId);
      const own = await this.ownSources(tx, orgId, strategyId, group.id);
      if (!own.items.length) {
        throw new HttpException(
          {
            statusCode: 409,
            code: 'no_sources',
            message: 'Ohne Analysen und Spend hat Reziproq keine Grundlage für einen Entwurf.',
          },
          409,
        );
      }
      const settings = await readAiSettings(tx, orgId);
      const research = settings.publicResearch && env.NODE_ENV !== 'production';
      const asOf = currentTime().toISOString().slice(0, 10);
      const runId = await this.startRun(tx, orgId, auth.userId, strategyId);
      const steps = await this.insertSteps(tx, orgId, runId);
      const finish = (seq: number, detail: Record<string, unknown>) =>
        tx
          .update(schema.agentStep)
          .set({ status: 'done', finishedAt: currentTime(), detail })
          .where(and(eq(schema.agentStep.runId, runId), eq(schema.agentStep.seq, seq)));

      // 1 Plan: Suchfragen nur mit Warengruppe und Technologie, nie mit eigenen Zahlen
      const queries = research
        ? [
            `${group.name} Marktentwicklung`,
            `${group.name} Kapazität Anbieter`,
            `${group.name} Rohstoffpreise`,
            `${group.name} Technologie`,
          ]
        : [];
      await finish(1, { queries: queries.length, research });
      // 2 Eigene Daten (ohne Kostensicht)
      await finish(2, { sources: own.items.map((item) => item.title) });
      // 3 Öffentliche Quellen: Filter vor dem Senden, jede Anfrage ins Protokoll
      const allowed = queries.filter((query) => queryAllowed(query, own.numbers));
      for (const text of allowed) {
        await tx.insert(schema.agentOutboundQuery).values({
          orgId,
          runId,
          stepId: steps[3] as string,
          text,
          provider: 'fake',
        });
      }
      const found =
        allowed.length > 0
          ? [
              ...new Map(
                fakeMarketFindings(asOf, group.name)
                  .flatMap((finding) => finding.sources)
                  .map((source) => [source.url, source]),
              ).values(),
            ]
          : [];
      const kept = datedSources(found, asOf).slice(0, 6);
      const discardedSources = found
        .filter((source) => !kept.includes(source as (typeof kept)[number]))
        .map((source) => ({
          title: source.title,
          reason: source.publishedOn === null ? ('undated' as const) : ('too_old' as const),
        }));
      await finish(3, {
        blocked: queries.length - allowed.length,
        kept: kept.map(({ title, url, publisher, publishedOn }) => ({
          title,
          url,
          publisher,
          publishedOn,
        })),
        discarded: discardedSources,
      });

      // 4 Kräfte bewerten
      const sourceList = [
        ...own.items.map((item) => ({ ...item, public: null })),
        ...kept.map((source) => ({
          title: source.title,
          text: source.excerpt,
          public: source,
        })),
      ];
      const prompt = [
        `Marktkräfte: Warengruppe ${group.name}`,
        'Quellen:',
        ...sourceList.map((item, index) =>
          item.public
            ? `Q${index + 1} [öffentlich] ${item.title} (${item.public.publisher}, ${item.public.publishedOn}): ${item.text}`
            : `Q${index + 1} ${item.title}: ${item.text}`,
        ),
      ].join('\n');
      const output = parseMarketDraft(
        await this.model.write({
          context: { ...gatewayContext(auth, 'market_analysis'), runId },
          system,
          prompt,
          maxOutputTokens: 1600,
        }),
      );
      if (!output) {
        await this.failRun(tx, runId);
        throw new HttpException(
          { statusCode: 502, code: 'draft_failed', message: 'Der Entwurf ist nicht gelungen.' },
          502,
        );
      }
      await finish(4, { forces: output.forces.length });

      // Entwurf und Quellen anlegen
      const actor = await actorOf(tx, auth, orgId);
      const synthesis = research
        ? output.synthesis
        : [output.synthesis, 'Ohne öffentliche Recherche, nur mit euren eigenen Daten.']
            .filter(Boolean)
            .join(' ');
      const draftId = await auditedChange(tx, actor, aiDraftAudit, async () => {
        const [row] = await tx
          .insert(schema.aiDraft)
          .values({
            orgId,
            kind,
            objectType,
            objectId: strategyId,
            runId,
            content: JSON.stringify({ ...output, synthesis }),
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
          sourceList.map((item) => ({
            orgId,
            draftId,
            targetType: objectType,
            targetId: strategyId,
            kind: item.public ? ('public' as const) : ('own_data' as const),
            title: item.title,
            url: item.public?.url ?? null,
            publishedAt: item.public?.publishedOn ?? null,
            excerpt: item.public ? item.text : null,
          })),
        )
        .returning({ id: schema.aiSource.id });
      const indexOf = (code: string) => Number(/^Q(\d+)$/.exec(code.trim())?.[1] ?? 0) - 1;

      // 5 Prüfen: ohne gültige Quelle oder nicht gestützt fällt die Aussage weg
      const discardedPoints: { text: string; reason: 'no_source' | 'not_supported' }[] = [];
      const checked = output.forces.map((force) => {
        const points: StoredPoint[] = force.points.flatMap((point) => {
          const indexes = [...new Set(point.sources.map(indexOf).filter((index) => stored[index]))];
          if (!indexes.length) {
            discardedPoints.push({ text: point.text, reason: 'no_source' });
            return [];
          }
          const texts = indexes.map((index) => {
            const source = sourceList[index];
            return `${source?.title ?? ''} ${source?.text ?? ''}`;
          });
          if (!supports(point.text, texts)) {
            discardedPoints.push({ text: point.text, reason: 'not_supported' });
            return [];
          }
          return [
            {
              text: point.text.trim(),
              sourceIds: indexes.map((index) => stored[index]?.id as string),
            },
          ];
        });
        return { force, points: points.slice(0, 3) };
      });
      await finish(5, { discarded: discardedPoints });

      const existing = await tx
        .select()
        .from(schema.materialGroupMarketForce)
        .where(eq(schema.materialGroupMarketForce.strategyId, strategyId));
      for (const { force, points } of checked) {
        const assessment: Assessment = {
          today: force.today,
          future: force.future,
          relevant: force.relevant,
          points,
        };
        const row = existing.find((entry) => entry.force === force.force);
        if (row?.status === 'confirmed') {
          // Neu recherchieren ersetzt bestätigte Kräfte nie, der Entwurf liegt daneben (WG-09).
          await tx
            .update(schema.materialGroupMarketForce)
            .set({ proposal: assessment, updatedAt: currentTime() })
            .where(eq(schema.materialGroupMarketForce.id, row.id));
        } else {
          await tx
            .insert(schema.materialGroupMarketForce)
            .values({ orgId, strategyId, force: force.force, ...assessment, status: 'draft' })
            .onConflictDoUpdate({
              target: [
                schema.materialGroupMarketForce.strategyId,
                schema.materialGroupMarketForce.force,
              ],
              set: { ...assessment, status: 'draft', updatedAt: currentTime() },
            });
        }
      }

      // 6 Implikationen: Chancen, Risiken und Hebelvorschläge aus den geprüften Kräften
      const implications = parseImplications(
        await this.model.write({
          context: { ...gatewayContext(auth, 'market_analysis'), runId },
          system: implicationsSystem,
          prompt: [
            `Implikationen: Warengruppe ${group.name}`,
            ...checked.map(
              ({ force, points }) =>
                `${force.force} heute ${force.today}, künftig ${force.future}: ${points.map((point) => point.text).join(' ')}`,
            ),
            'Quellen:',
            ...sourceList.map((item, index) => `Q${index + 1} ${item.title}`),
          ].join('\n'),
          maxOutputTokens: 800,
        }),
      );
      const items = (implications?.items ?? []).filter((item) =>
        item.sources.some((code) => stored[indexOf(code)]),
      );
      await finish(6, { items: items.length });

      // 7 Entwürfe: Chancen und Risiken als Entwurf (WG-10), Hebel als Vorschlag. Frühere Entwürfe
      // der Marktanalyse ersetzt ein neuer Lauf; Bestätigtes bleibt.
      await tx
        .delete(schema.materialGroupSwotItem)
        .where(
          and(
            eq(schema.materialGroupSwotItem.strategyId, strategyId),
            eq(schema.materialGroupSwotItem.status, 'draft'),
            eq(schema.materialGroupSwotItem.originStep, step),
          ),
        );
      const [internal] = await tx
        .select({ id: schema.materialGroupSwotItem.id })
        .from(schema.materialGroupSwotItem)
        .where(
          and(
            eq(schema.materialGroupSwotItem.strategyId, strategyId),
            eq(schema.materialGroupSwotItem.status, 'confirmed'),
            inArray(schema.materialGroupSwotItem.type, ['strength', 'weakness']),
          ),
        )
        .orderBy(asc(schema.materialGroupSwotItem.code))
        .limit(1);
      const levers = await tx
        .select({ id: schema.strategyLever.id, name: schema.strategyLever.name })
        .from(schema.strategyLever)
        .where(eq(schema.strategyLever.active, true));
      const created = { forces: checked.length, opportunities: 0, threats: 0, levers: 0 };
      for (const item of items) {
        const prefix = item.type === 'opportunity' ? 'O' : 'T';
        const [last] = await tx
          .select({
            n: sql<number>`coalesce(max(substring(${schema.materialGroupSwotItem.code} from 2)::int), 0)::int`,
          })
          .from(schema.materialGroupSwotItem)
          .where(
            and(
              eq(schema.materialGroupSwotItem.strategyId, strategyId),
              eq(schema.materialGroupSwotItem.type, item.type),
            ),
          );
        const [row] = await tx
          .insert(schema.materialGroupSwotItem)
          .values({
            orgId,
            strategyId,
            type: item.type,
            code: `${prefix}${(last?.n ?? 0) + 1}`,
            text: research ? item.text : `${item.text} (nur eigene Daten)`,
            originStep: step,
            status: 'draft',
          })
          .returning({ id: schema.materialGroupSwotItem.id });
        if (item.type === 'opportunity') created.opportunities += 1;
        else created.threats += 1;
        const lever = levers.find(
          (entry) => entry.name.toLowerCase() === (item.lever ?? '').trim().toLowerCase(),
        );
        // Ein Hebel braucht eine Paarung mit einem bestätigten internen Eintrag (WG-10).
        if (row && lever && internal) {
          await tx.insert(schema.materialGroupLeverChoice).values({
            orgId,
            strategyId,
            internalItemId: internal.id,
            externalItemId: row.id,
            leverId: lever.id,
            reason: item.text,
            status: 'proposed',
          });
          created.levers += 1;
        }
      }
      await finish(7, created);
      await tx
        .update(schema.agentRun)
        .set({ status: 'done', finishedAt: currentTime(), stepsUsed: 7 })
        .where(eq(schema.agentRun.id, runId));
      await this.strategies.touchedIn(tx, strategy);
      return this.view(tx, strategyId, true);
    });
  }

  /** KI-08: Systemagent anlegen (einmal je Organisation) und den Lauf im Kontext der Strategie */
  private async startRun(tx: TenantTransaction, orgId: string, userId: string, strategyId: string) {
    await tx
      .insert(schema.agent)
      .values({
        orgId,
        key: marketAgent.key,
        name: marketAgent.name,
        description: marketAgent.description,
        kind: 'system',
        status: 'active',
      })
      .onConflictDoNothing({ target: [schema.agent.orgId, schema.agent.key] });
    const [instance] = await tx
      .select({ id: schema.agent.id })
      .from(schema.agent)
      .where(and(eq(schema.agent.orgId, orgId), eq(schema.agent.key, marketAgent.key)));
    if (!instance) throw notFound();
    await tx
      .insert(schema.agentVersion)
      .values({
        orgId,
        agentId: instance.id,
        version: marketAgent.version,
        instructions: system,
        tools: [...marketAgent.tools],
        trigger: 'manual',
        outputTarget: 'material_group_market_force',
        reviewerRule: 'team',
        modelClass: 'standard',
        budgetCents: marketAgent.budgetCents,
        maxSteps: marketAgent.maxSteps,
      })
      .onConflictDoNothing({
        target: [
          schema.agentVersion.orgId,
          schema.agentVersion.agentId,
          schema.agentVersion.version,
        ],
      });
    const [version] = await tx
      .select({ id: schema.agentVersion.id })
      .from(schema.agentVersion)
      .where(
        and(
          eq(schema.agentVersion.orgId, orgId),
          eq(schema.agentVersion.agentId, instance.id),
          eq(schema.agentVersion.version, marketAgent.version),
        ),
      );
    if (!version) throw notFound();
    const [run] = await tx
      .insert(schema.agentRun)
      .values({
        orgId,
        agentVersionId: version.id,
        actingUserId: userId,
        startedBy: userId,
        trigger: 'manual',
        contextType: 'category_strategy',
        contextId: strategyId,
        status: 'running',
        startedAt: currentTime(),
      })
      .returning({ id: schema.agentRun.id });
    if (!run) throw notFound();
    return run.id;
  }

  private async insertSteps(tx: TenantTransaction, orgId: string, runId: string) {
    const ids: Record<number, string> = {};
    for (const [index, entry] of runSteps.entries()) {
      const [row] = await tx
        .insert(schema.agentStep)
        .values({ orgId, runId, seq: index + 1, kind: entry.kind, title: entry.key })
        .returning({ id: schema.agentStep.id });
      if (row) ids[index + 1] = row.id;
    }
    return ids;
  }

  private async failRun(tx: TenantTransaction, runId: string) {
    await tx
      .update(schema.agentRun)
      .set({ status: 'failed', finishedAt: currentTime() })
      .where(eq(schema.agentRun.id, runId));
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
        .set({ status: 'confirmed', confirmedBy: auth.userId, confirmedAt: currentTime() })
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
        confirmedAt: currentTime(),
        updatedAt: currentTime(),
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
                confirmedAt: currentTime(),
                updatedAt: currentTime(),
              }
            : { proposal: null, updatedAt: currentTime() },
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
          .set({ status: decision, decidedBy: auth.userId, decidedAt: currentTime() })
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
              set: { text, notApplicable: false, updatedBy: auth.userId, updatedAt: currentTime() },
            });
        }
      }
      return this.view(tx, strategyId, true);
    });
  }
}
