import type { OpportunityConfidence, OpportunityInput } from '@reziproq/shared';

type Reason =
  | 'fresh_internal'
  | 'template_assumption'
  | 'independent_public_sources'
  | 'extrapolation'
  | 'insufficient_coverage'
  | 'single_public_source'
  | 'stale_data'
  | 'user_assumption';
type Decision = { level: OpportunityConfidence; reason: Reason };
type Source = OpportunityInput['source'];
export type OpportunityCoverage = {
  extrapolated: boolean;
  observedParts?: number;
  totalParts?: number;
};

function yearsBefore(asOf: string, years: number) {
  const date = new Date(`${asOf}T00:00:00Z`);
  const year = date.getUTCFullYear() - years;
  const month = date.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)))
    .toISOString()
    .slice(0, 10);
}

export function currentMarketCitations(
  source: Extract<Source, { kind: 'public_source' }>,
  asOf: string,
) {
  const from = yearsBefore(asOf, 2);
  return source.citations.filter(
    (citation) => citation.publishedOn >= from && citation.publishedOn <= asOf,
  );
}

function grade(source: Source, from: string, asOf: string): Decision {
  switch (source.kind) {
    case 'own_data':
    case 'supplier_input':
      return source.reference.observedOn >= from && source.reference.observedOn <= asOf
        ? { level: 'high', reason: 'fresh_internal' }
        : { level: 'low', reason: 'stale_data' };
    case 'user_assumption':
      return { level: 'low', reason: 'user_assumption' };
    case 'template_assumption':
      return { level: 'medium', reason: 'template_assumption' };
    case 'public_source': {
      const citations = currentMarketCitations(source, asOf);
      if (!citations.length) return { level: 'low', reason: 'stale_data' };
      const publishers = new Set(
        citations.map((citation) => citation.publisher.normalize('NFKC').toLowerCase()),
      );
      const hosts = new Set(
        citations.map((citation) => new URL(citation.url).hostname.replace(/^www\./, '')),
      );
      return publishers.size >= 2 && hosts.size >= 2
        ? { level: 'medium', reason: 'independent_public_sources' }
        : { level: 'low', reason: 'single_public_source' };
    }
  }
}

/** KI-11: Eine schwächere Eingabe oder eine schwächere Regel bestimmt die Stufe. */
export function opportunityConfidence(
  inputs: readonly [OpportunityInput, ...OpportunityInput[]],
  asOf: string,
  coverage: OpportunityCoverage = {
    extrapolated: false,
  },
): Decision {
  if (coverage.extrapolated) return { level: 'low', reason: 'extrapolation' };
  if (
    coverage.observedParts !== undefined &&
    coverage.totalParts !== undefined &&
    coverage.observedParts * 2 < coverage.totalParts
  )
    return { level: 'low', reason: 'insufficient_coverage' };
  const from = yearsBefore(asOf, 1);
  const decisions = inputs.map((input) => grade(input.source, from, asOf));
  return (
    decisions.find((decision) => decision.level === 'low') ??
    decisions.find((decision) => decision.level === 'medium') ?? {
      level: 'high',
      reason: 'fresh_internal',
    }
  );
}
