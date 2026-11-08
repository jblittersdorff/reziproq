import type { FocusReason } from '@reziproq/shared';

export interface FocusCandidate {
  relationshipId: string;
  spendCents: number;
  currency: string;
  /** Impact-Stufe des konsolidierten Soll-Typs; null ohne Konsolidierung */
  sollImpact: number | null;
}

/** Anteil am Gesamtspend derselben Währung in Prozent, eine Nachkommastelle. */
export function shares(candidates: FocusCandidate[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const { currency, spendCents } of candidates) {
    totals.set(currency, (totals.get(currency) ?? 0) + spendCents);
  }
  return new Map(
    candidates.map(({ relationshipId, currency, spendCents }) => {
      const total = totals.get(currency) ?? 0;
      return [relationshipId, total === 0 ? 0 : Math.round((spendCents / total) * 1000) / 10];
    }),
  );
}

/**
 * Vorschläge für den Fokus (SEG-02), nie automatisch gesetzt. Regel 1: die größten Lieferanten
 * einer Währung, bis zusammen `spendShare` Prozent erreicht sind. Regel 2: hoher Business Impact
 * im konsolidierten Soll-Typ. Wer schon Fokus ist, wird nicht vorgeschlagen.
 */
export function suggestFocus(
  candidates: FocusCandidate[],
  spendShare: number,
  focused: ReadonlySet<string>,
): Map<string, FocusReason[]> {
  const reasons = new Map<string, FocusReason[]>();
  const add = (id: string, reason: FocusReason) =>
    reasons.set(id, [...(reasons.get(id) ?? []), reason]);

  const byCurrency = new Map<string, FocusCandidate[]>();
  for (const candidate of candidates) {
    byCurrency.set(candidate.currency, [...(byCurrency.get(candidate.currency) ?? []), candidate]);
  }
  for (const group of byCurrency.values()) {
    const total = group.reduce((sum, entry) => sum + entry.spendCents, 0);
    let cumulative = 0;
    const sorted = [...group].sort((a, b) => b.spendCents - a.spendCents);
    for (const entry of sorted) {
      if (total === 0 || entry.spendCents === 0) break;
      // Wer die Schwelle noch nicht überschritten hat, gehört zu den größten.
      if (cumulative * 100 >= total * spendShare) break;
      cumulative += entry.spendCents;
      add(entry.relationshipId, 'spend_share');
    }
  }
  for (const candidate of candidates) {
    if (candidate.sollImpact === 3) add(candidate.relationshipId, 'target_type');
  }
  for (const id of focused) reasons.delete(id);
  return reasons;
}
