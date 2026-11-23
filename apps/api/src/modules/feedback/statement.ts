import type { TenantTransaction } from '@reziproq/db';
import type { InsightStatement, SurveyDimension, SurveyResults } from '@reziproq/shared';
import type { InsightFact, InsightSummaryService } from '../ai-gateway/insight-summary.service.js';
import type { AuthContext } from '../auth/auth.guard.js';

const dimensionNames: Record<SurveyDimension, string> = {
  trust: 'Vertrauen',
  collaboration: 'Zusammenarbeit',
  integration: 'Integration',
  transparency: 'Transparenz',
  strategy: 'Strategische Ausrichtung',
};
const number = (value: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    value,
  );

/**
 * AW-01 Ergebnisse · Feedback: Aussage zur aufgedeckten Welle aus der größten Lücke zwischen beiden
 * Seiten und der Zahl der Antworten. Nennt nie, wer geantwortet hat. Ohne Lücke keine Aussage.
 */
export async function feedbackStatement(
  summaries: InsightSummaryService,
  tx: TenantTransaction,
  auth: AuthContext,
  input: { relationshipId: string; waveId: string; supplier: string; results: SurveyResults },
): Promise<InsightStatement | null> {
  const [top] = input.results.topGaps;
  if (!top || top.delta === null || top.buyer.ist === null || top.supplier.ist === null)
    return null;
  const source = 'Feedback-Welle, beide Seiten aufgedeckt';
  const name = dimensionNames[top.dimension];
  const gap = number(Math.abs(top.delta));
  const higher = top.delta > 0 ? 'ihr' : input.supplier;
  const facts: InsightFact[] = [
    { key: 'supplier', label: 'Lieferant', display: input.supplier, source: 'Lieferant' },
    { key: 'dimension', label: 'Größte Lücke', display: name, source },
    { key: 'gap', label: 'Abstand', display: gap, source },
    { key: 'buyer', label: 'Eure Seite', display: number(top.buyer.ist), source },
    { key: 'supplierValue', label: 'Lieferant', display: number(top.supplier.ist), source },
    {
      key: 'responses',
      label: 'Antworten',
      display: `${input.results.responses.buyer} und ${input.results.responses.supplier}`,
      source,
    },
  ];
  const result = await summaries.summarize(tx, auth, {
    pageKey: 'supplier_feedback',
    scopeType: 'relationship',
    scopeId: input.relationshipId,
    period: input.waveId,
    facts,
    fallback: {
      headline: `Bei ${name} liegen beide Seiten ${gap} Punkte auseinander.`,
      body: [
        `${higher === 'ihr' ? 'Ihr seht' : `${input.supplier} sieht`} ${name} besser: ${number(top.buyer.ist)} gegen ${number(top.supplier.ist)}.`,
        `Geantwortet haben ${input.results.responses.buyer} und ${input.results.responses.supplier} Personen.`,
      ].join(' '),
    },
    knownNames: [input.supplier],
  });
  return result.statement;
}
