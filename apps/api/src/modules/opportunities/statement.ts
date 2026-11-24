import type { TenantTransaction } from '@reziproq/db';
import { currentTime } from '@reziproq/db';
import type { InsightStatement } from '@reziproq/shared';
import type { InsightFact, InsightSummaryService } from '../ai-gateway/insight-summary.service.js';
import type { AuthContext } from '../auth/auth.guard.js';

const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const money = (cents: number) => euro.format(Math.round(cents / 100));

/**
 * AW-01: Aussage der Wertpotenzial-Seiten aus Zahl neu, EBIT-Spanne neu (nur hoch und mittel),
 * Cash getrennt und Zahl im JBP. Ohne Potenziale keine Aussage.
 */
export async function valueStatement(
  summaries: InsightSummaryService,
  tx: TenantTransaction,
  auth: AuthContext,
  input: {
    pageKey: 'supplier_value' | 'value_all';
    scopeId: string | null;
    newCount: number;
    adoptedCount: number;
    ebitNew: { low: number; high: number } | null;
    cashNew: { low: number; high: number } | null;
  },
): Promise<InsightStatement | null> {
  if (input.newCount === 0 && input.adoptedCount === 0) return null;
  const source = 'Wertpotenzial-Finder';
  const range = (value: { low: number; high: number }) =>
    value.low === value.high ? money(value.low) : `${money(value.low)} bis ${money(value.high)}`;
  const facts: InsightFact[] = [
    { key: 'new', label: 'Neue Potenziale', display: String(input.newCount), source },
    { key: 'adopted', label: 'Im JBP', display: String(input.adoptedCount), source },
  ];
  if (input.ebitNew)
    facts.push({ key: 'ebit', label: 'EBIT neu', display: range(input.ebitNew), source });
  if (input.cashNew)
    facts.push({ key: 'cash', label: 'Cash neu', display: range(input.cashNew), source });
  const headline = input.ebitNew
    ? `${input.newCount} neue Potenziale bringen ${range(input.ebitNew)} EBIT im Jahr.`
    : `${input.newCount} neue Potenziale, ${input.adoptedCount} im JBP.`;
  const body = [
    `${input.adoptedCount} Potenziale sind schon im JBP.`,
    ...(input.cashNew ? [`Dazu kommen ${range(input.cashNew)} Cash, getrennt vom EBIT.`] : []),
    'Die Summen enthalten nur Potenziale mit Sicherheit hoch und mittel.',
  ].join(' ');
  const result = await summaries.summarize(tx, auth, {
    pageKey: input.pageKey,
    scopeType: input.scopeId ? 'relationship' : 'org',
    scopeId: input.scopeId,
    period: currentTime().toISOString().slice(0, 7),
    facts,
    fallback: { headline, body },
  });
  return result.statement;
}
