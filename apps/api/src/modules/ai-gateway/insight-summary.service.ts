import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, currentTime, eq, isNull, schema, sql, type TenantTransaction } from '@reziproq/db';
import type { InsightStatement } from '@reziproq/shared';
import { generateText } from 'ai';
import type { AuthContext } from '../auth/auth.guard.js';
import { estimateTokens, ModelGateway } from './model-gateway.js';

/** Eine Zahl oder ein Name der Seite, so wie die Person ihn sehen darf */
export interface InsightFact {
  key: string;
  label: string;
  /** Anzeige, z. B. „412.000 €“ oder „Rheintal“; nur diese Zahlen und Namen darf der Text nennen */
  display: string;
  source: string;
  href?: string;
}

/** Ein Satz der Übersicht mit Kandidat aus dem Code (NAV-10) */
export interface SentenceCandidate {
  kind: 'good' | 'stuck' | 'todo';
  /** Satz aus der Vorlage im Code; gilt, wenn der Text von Reziproq die Prüfung nicht besteht */
  fallback: string;
  href: string;
}

export interface InsightRequest {
  pageKey: string;
  scopeType: 'org' | 'relationship' | 'category';
  scopeId: string | null;
  period: string;
  facts: InsightFact[];
  /** Vorlage für Satz und Erklärung, die der lokale Testanbieter zurückgibt */
  fallback: { headline: string; body: string };
  sentences?: SentenceCandidate[];
  /** Namen, die in der Organisation vorkommen; nennt der Text einen davon ohne Fakt, gilt er nicht */
  knownNames?: string[];
}

export interface InsightResult {
  statement: InsightStatement | null;
  sentences: { kind: SentenceCandidate['kind']; text: string; href: string }[];
}

const digitsIn = (text: string) =>
  (text.match(/\d[\d.,]*/g) ?? []).map((value) => value.replace(/[.,]/g, '')).filter(Boolean);
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * AW-01, NAV-10: Aussage von Reziproq aus den Fakten der Seite. Neu nur bei geänderten Fakten,
 * höchstens einmal je Stunde und Seite; je Person gespeichert (F3). Jede Zahl und jeder bekannte
 * Name im Text muss in den Fakten stehen, sonst wird die Aussage unterdrückt.
 */
@Injectable()
export class InsightSummaryService {
  private readonly logger = new Logger('Aussagen');
  /** Nur für Tests: feste Antwort des Testanbieters */
  testModelText: ((fallback: string) => string) | undefined;

  constructor(@Inject(ModelGateway) private readonly gateway: ModelGateway) {}

  /** Prüft einen Text gegen die Fakten: Zahlen und bekannte Namen nur aus den Fakten */
  static valid(text: string, facts: InsightFact[], knownNames: string[] = []) {
    const allowed = new Set(facts.flatMap((fact) => digitsIn(`${fact.display} ${fact.label}`)));
    if (!digitsIn(text).every((value) => allowed.has(value))) return false;
    const factText = facts.map((fact) => `${fact.display} ${fact.label}`).join(' ');
    return knownNames.every((name) => !text.includes(name) || factText.includes(name));
  }

  private sources(facts: InsightFact[]) {
    const seen = new Map<string, { key: string; label: string; href?: string }>();
    for (const fact of facts) {
      if (!seen.has(fact.source)) {
        seen.set(fact.source, {
          key: fact.source,
          label: fact.source,
          ...(fact.href ? { href: fact.href } : {}),
        });
      }
    }
    return [...seen.values()];
  }

  async summarize(
    tx: TenantTransaction,
    auth: AuthContext,
    request: InsightRequest,
  ): Promise<InsightResult> {
    const organization = auth.organization;
    const candidates = request.sentences ?? [];
    const fallbackSentences = candidates.map(({ kind, fallback, href }) => ({
      kind,
      text: fallback,
      href,
    }));
    if (!organization) return { statement: null, sentences: fallbackSentences };
    const hash = createHash('sha256')
      .update(JSON.stringify({ facts: request.facts, candidates }))
      .digest('hex');
    const table = schema.insightSummary;
    const where = and(
      eq(table.orgId, organization.id),
      eq(table.userId, auth.userId),
      eq(table.pageKey, request.pageKey),
      eq(table.scopeType, request.scopeType),
      request.scopeId ? eq(table.scopeId, request.scopeId) : isNull(table.scopeId),
      eq(table.period, request.period),
    );
    const [existing] = await tx.select().from(table).where(where);
    const recent =
      existing &&
      existing.generatedAt.getTime() > currentTime().getTime() - 60 * 60 * 1000 &&
      !this.testModelText;
    if (existing?.factsHash === hash) return this.view(existing, request, candidates);
    if (existing && recent) {
      // Fakten geändert, aber noch keine Stunde vorbei: keine veraltete Aussage zeigen, nur den Beleg.
      return { statement: null, sentences: fallbackSentences };
    }

    let parsed: { headline?: string; body?: string; sentences?: Record<string, string> } = {};
    try {
      const system =
        'Schreibe aus den Fakten einen Satz mit höchstens zwölf Wörtern (headline), zwei bis drei Sätze Erklärung (body) und je Kandidat einen Satz (sentences). Nenne nur Zahlen und Namen aus den Fakten. Antworte mit genau einem JSON-Objekt.';
      const prompt = JSON.stringify({
        facts: request.facts.map(({ label, display }) => ({ label, display })),
        candidates: candidates.map(({ kind, fallback }) => ({ kind, fallback })),
      });
      const fallbackJson = JSON.stringify({
        headline: request.fallback.headline,
        body: request.fallback.body,
        sentences: Object.fromEntries(candidates.map((entry) => [entry.kind, entry.fallback])),
      });
      const raw = await this.gateway.call(
        { orgId: organization.id, userId: auth.userId, feature: 'insight_summary' },
        async (model) => {
          if (!model) {
            const value = this.testModelText ? this.testModelText(fallbackJson) : fallbackJson;
            return {
              value,
              usage: {
                inputTokens: estimateTokens(system + prompt),
                outputTokens: estimateTokens(value),
              },
            };
          }
          const result = await generateText({ model, system, prompt, maxOutputTokens: 400 });
          return {
            value: result.text,
            usage: {
              inputTokens: result.usage.inputTokens ?? 0,
              outputTokens: result.usage.outputTokens ?? 0,
            },
          };
        },
      );
      parsed = JSON.parse(raw);
    } catch (error) {
      // Ohne Modell (Budget, Region, Fehler) bleibt nur der Beleg; die Sätze kommen aus dem Code.
      this.logger.warn(error instanceof Error ? error.message : 'Aussage nicht erzeugt');
      if (existing) return this.view(existing, request, candidates);
      return { statement: null, sentences: fallbackSentences };
    }

    const headline = typeof parsed.headline === 'string' ? parsed.headline.trim() : '';
    const body = typeof parsed.body === 'string' ? parsed.body.trim() : '';
    const valid = (text: string) =>
      InsightSummaryService.valid(text, request.facts, request.knownNames);
    const shown =
      headline.length > 0 &&
      body.length > 0 &&
      words(headline) <= 12 &&
      valid(headline) &&
      valid(body);
    const sentences = Object.fromEntries(
      candidates.flatMap((entry) => {
        const text = parsed.sentences?.[entry.kind];
        return typeof text === 'string' && text.trim() && valid(text)
          ? [[entry.kind, text.trim()]]
          : [];
      }),
    );
    const values = {
      facts: request.facts,
      factsHash: hash,
      headline: shown ? headline : null,
      body: shown ? body : null,
      sentences,
      status: shown ? ('shown' as const) : ('suppressed' as const),
      suppressedReason: shown ? null : 'zahl_oder_name_ohne_fakt',
      generatedAt: currentTime(),
    };
    const [row] = await tx
      .insert(table)
      .values({
        orgId: organization.id,
        userId: auth.userId,
        pageKey: request.pageKey,
        scopeType: request.scopeType,
        scopeId: request.scopeId,
        period: request.period,
        ...values,
      })
      .onConflictDoUpdate({
        target: [
          table.orgId,
          table.userId,
          table.pageKey,
          table.scopeType,
          table.scopeId,
          table.period,
        ],
        set: values,
      })
      .returning();
    if (!row) return { statement: null, sentences: fallbackSentences };
    return this.view(row, request, candidates);
  }

  private view(
    row: typeof schema.insightSummary.$inferSelect,
    request: InsightRequest,
    candidates: SentenceCandidate[],
  ): InsightResult {
    return {
      statement:
        row.status === 'shown' && row.headline && row.body
          ? {
              id: row.id,
              headline: row.headline,
              body: row.body,
              sources: this.sources(request.facts),
            }
          : null,
      sentences: candidates.map((entry) => ({
        kind: entry.kind,
        text: row.sentences[entry.kind] ?? entry.fallback,
        href: entry.href,
      })),
    };
  }

  /** „Stimmt nicht“: die Person meldet ihre Aussage; die Meldung fließt in die Testfälle. */
  async report(tx: TenantTransaction, auth: AuthContext, id: string) {
    const organization = auth.organization;
    if (!organization) return false;
    const rows = await tx
      .update(schema.insightSummary)
      .set({ reportedAt: sql`app_now()` })
      .where(
        and(
          eq(schema.insightSummary.id, id),
          eq(schema.insightSummary.orgId, organization.id),
          eq(schema.insightSummary.userId, auth.userId),
        ),
      )
      .returning({ id: schema.insightSummary.id });
    return rows.length > 0;
  }
}
