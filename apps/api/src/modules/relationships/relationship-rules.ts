import {
  attentionWeights,
  keptBetterPoints,
  type Money,
  type RelationshipHint,
  type RelationshipReason,
  type RelationshipRow,
  type RelationshipStatus,
  type RelationshipsSummary,
  type RelationshipsSummaryRow,
  type SegmentField,
  type SegmentSupplier,
  type SideQuote,
} from '@reziproq/shared';

// BZ-01 (K2-b.3): Regeln der Seite Lieferanten ohne Datenbank. Reihenfolge nach Aufmerksamkeit,
// wichtigster Grund der grauen Zeile, „Das Wichtigste“ und die Felder der Linse Segmente.

/** Was die Datenbank je Beziehung liefert */
export interface RowInput {
  relationshipId: string;
  name: string;
  status: RelationshipStatus;
  country: string | null;
  materialGroup: string | null;
  spend: Money | null;
  isMine: boolean;
  isFocus: boolean;
  segment: { key: string; name: string } | null;
  disputed: boolean;
  quota: { own: SideQuote; counterpart: SideQuote } | null;
  openCommitments: number;
  /** Offene Zusagen mit Frist vor heute; title ist die am längsten überfällige */
  overdue: { count: number; title: string } | null;
  /** Stärkster sichtbarer Hinweis */
  hint: RelationshipHint | null;
}

/** Der stärkste Grund und seine Punkte; bei Gleichstand gilt die Reihenfolge der Prüfung. */
export function reasonOf(input: RowInput): {
  reason: RelationshipReason | null;
  attention: number;
} {
  const candidates: { reason: RelationshipReason; points: number }[] = [];
  if (input.overdue) {
    candidates.push({
      reason: { kind: 'overdue', count: input.overdue.count, title: input.overdue.title },
      points: attentionWeights.overdue,
    });
  }
  // Strittig vor einem gleich starken Hinweis: Die „Ungeklärte Abweichung“ (FS-01) meint dasselbe
  if (input.disputed) {
    candidates.push({ reason: { kind: 'disputed' }, points: attentionWeights.disputed });
  }
  if (input.hint) {
    candidates.push({
      reason: { kind: 'hint', hint: input.hint },
      points: attentionWeights.hint[input.hint.severity],
    });
  }
  if (!input.segment && !input.disputed) {
    candidates.push({ reason: { kind: 'unrated' }, points: attentionWeights.unrated });
  }
  let best: { reason: RelationshipReason; points: number } | undefined;
  for (const candidate of candidates) {
    if (!best || candidate.points > best.points) best = candidate;
  }
  return { reason: best?.reason ?? null, attention: best?.points ?? 0 };
}

const cents = (spend: Money | null) => spend?.amountCents ?? -1;

/** Stärkster Hinweis je Beziehung: erst nach Punkten der Schwere, dann nach score */
export function strongestHints(
  hints: (RelationshipHint & { relationshipId: string | null; score: number })[],
): Map<string, RelationshipHint> {
  const best = new Map<string, RelationshipHint & { score: number }>();
  for (const entry of hints) {
    if (!entry.relationshipId) continue;
    const current = best.get(entry.relationshipId);
    const points = attentionWeights.hint[entry.severity];
    if (
      !current ||
      points > attentionWeights.hint[current.severity] ||
      (points === attentionWeights.hint[current.severity] && entry.score > current.score)
    ) {
      best.set(entry.relationshipId, entry);
    }
  }
  return new Map(
    [...best].map(([relationshipId, hint]) => [
      relationshipId,
      {
        id: hint.id,
        ruleKey: hint.ruleKey,
        severity: hint.severity,
        status: hint.status,
        title: hint.title,
        metric: hint.metric,
        value: hint.value,
      },
    ]),
  );
}

/** Zeilen der Liste: nach Aufmerksamkeit, dann nach Spend, dann nach Name */
export function rankRows(inputs: RowInput[]): RelationshipRow[] {
  return inputs
    // overdue und hint bleiben am Objekt; das Schema der Antwort lässt sie weg
    .map((input) => ({ ...input, ...reasonOf(input) }))
    .sort(
      (a, b) =>
        b.attention - a.attention ||
        cents(b.spend) - cents(a.spend) ||
        a.name.localeCompare(b.name, 'de'),
    );
}

/** Abstand der Quoten zugunsten eurer Seite in Punkten; null ohne fällige Zusagen auf einer Seite */
function gapOf(input: RowInput): number | null {
  const own = input.quota?.own.percent ?? null;
  const counterpart = input.quota?.counterpart.percent ?? null;
  return own === null || counterpart === null ? null : own - counterpart;
}

/**
 * „Das Wichtigste“ (Vorlage Lieferanten): wie viele Beziehungen ihr deutlich besser haltet als der
 * Lieferant, der größte Lieferant ohne Segment und bis zu drei Zeilen: Hakt (niedrigste Quote des
 * Lieferanten unter denen, die ihr deutlich besser haltet), Fehlt (größter ohne Segment), Info (der
 * größte übrige Abstand, mit überfälliger Zusage).
 */
export function summaryOf(inputs: RowInput[]): RelationshipsSummary {
  const better = inputs.filter((input) => (gapOf(input) ?? -Infinity) >= keptBetterPoints);
  const unrated = inputs
    .filter((input) => !input.segment)
    .sort((a, b) => cents(b.spend) - cents(a.spend) || a.name.localeCompare(b.name, 'de'))[0];
  const largest = [...inputs].sort((a, b) => cents(b.spend) - cents(a.spend))[0];

  const rows: RelationshipsSummaryRow[] = [];
  const low = [...better].sort(
    (a, b) =>
      (a.quota?.counterpart.percent ?? 100) - (b.quota?.counterpart.percent ?? 100) ||
      cents(b.spend) - cents(a.spend),
  )[0];
  if (low?.quota) {
    rows.push({
      kind: 'counterpart_low',
      relationshipId: low.relationshipId,
      name: low.name,
      kept: low.quota.counterpart.kept,
      due: low.quota.counterpart.due,
      hint: low.hint,
    });
  }
  if (unrated) {
    rows.push({
      kind: 'unrated',
      relationshipId: unrated.relationshipId,
      name: unrated.name,
      spend: unrated.spend,
    });
  }
  const gap = better
    .filter((input) => input.relationshipId !== low?.relationshipId)
    .sort((a, b) => (gapOf(b) ?? 0) - (gapOf(a) ?? 0) || cents(b.spend) - cents(a.spend))[0];
  if (gap?.quota && gap.quota.own.percent !== null && gap.quota.counterpart.percent !== null) {
    rows.push({
      kind: 'quota_gap',
      relationshipId: gap.relationshipId,
      name: gap.name,
      own: gap.quota.own.percent,
      counterpart: gap.quota.counterpart.percent,
      overdue: gap.overdue,
    });
  }
  return {
    keptBetter: better.length,
    unrated: unrated
      ? {
          relationshipId: unrated.relationshipId,
          name: unrated.name,
          spend: unrated.spend,
          largest: largest?.relationshipId === unrated.relationshipId,
        }
      : null,
    rows,
  };
}

/** Summe je Währung, größte zuerst */
export function totalsOf(spends: (Money | null)[]): Money[] {
  const totals = new Map<string, number>();
  for (const spend of spends) {
    if (spend) totals.set(spend.currency, (totals.get(spend.currency) ?? 0) + spend.amountCents);
  }
  return [...totals]
    .map(([currency, amountCents]) => ({ amountCents, currency }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

export interface PortfolioEntry extends SegmentSupplier {
  /** Feld im aktiven Modell; null ohne Bewertung */
  segmentKey: string | null;
}

const bySupplierOrder = (a: SegmentSupplier, b: SegmentSupplier) =>
  (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) ||
  cents(b.spend) - cents(a.spend) ||
  a.name.localeCompare(b.name, 'de');

/**
 * Felder der Matrix (Vorlage K2-Segmente): je Typ des aktiven Modells Zahl, Spend und Lieferanten,
 * aktive Beziehungen zuerst, dann nach Spend. Zeilen nach Impact absteigend, Spalten aufsteigend.
 * Ohne Bewertung steht, wer kein Segment im aktiven Modell hat, der größte zuerst.
 */
export function segmentFields(
  types: { impactLevel: number; qualityLevel: number; name: string }[],
  entries: PortfolioEntry[],
) {
  const keys = new Set(types.map((type) => `${type.impactLevel}-${type.qualityLevel}`));
  const fields: SegmentField[] = [...types]
    .sort((a, b) => b.impactLevel - a.impactLevel || a.qualityLevel - b.qualityLevel)
    .map((type) => {
      const key = `${type.impactLevel}-${type.qualityLevel}`;
      const suppliers = entries
        .filter((entry) => entry.segmentKey === key)
        .sort(bySupplierOrder);
      return {
        key,
        impactLevel: type.impactLevel,
        qualityLevel: type.qualityLevel,
        name: type.name,
        count: suppliers.length,
        spend: totalsOf(suppliers.map((supplier) => supplier.spend)),
        suppliers,
      };
    });
  const unrated = entries
    .filter((entry) => entry.segmentKey === null || !keys.has(entry.segmentKey))
    .sort((a, b) => cents(b.spend) - cents(a.spend) || a.name.localeCompare(b.name, 'de'));
  return { fields, unrated };
}

/** Anteil in Prozent, nur bei genau einer gemeinsamen Währung */
export function shareOf(part: Money[], whole: Money[]): number | null {
  const [a] = part;
  const [b] = whole;
  if (part.length !== 1 || whole.length !== 1 || !a || !b || a.currency !== b.currency) return null;
  return b.amountCents === 0 ? null : Math.round((a.amountCents / b.amountCents) * 100);
}
