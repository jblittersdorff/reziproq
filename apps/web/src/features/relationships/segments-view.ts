import {
  displayNameOf,
  type Money,
  type RelationshipSegments,
  type SegmentField,
  type SegmentSupplier,
} from '@reziproq/shared';

// BZ-01 (K2-b.5): Regeln der Linse Segmente ohne Oberfläche (Vorlage K2-Segmente). Die Zahlen
// kommen aus GET /api/beziehungen/segmente; die Sätze bildet die Seite daraus (G-6).

/** Ein Feld zeigt höchstens drei Namen, solange sie zusammen in rund 44 Zeichen passen (Vorlage) */
export const fieldNameLimit = { count: 3, characters: 44 } as const;

/**
 * Namen in einem Feld der Matrix: strittige zuerst, damit der gelbe Rand zu sehen ist, dann in der
 * Folge der API (aktive Beziehungen, dann nach Spend). Der erste Name steht immer da, weitere nur,
 * solange alle zusammen in die Grenze passen; die übrigen zählt „und N weitere“.
 */
export function fieldNames(suppliers: SegmentSupplier[]): {
  names: { supplier: SegmentSupplier; label: string }[];
  rest: number;
} {
  const ordered = [
    ...suppliers.filter((supplier) => supplier.disputed),
    ...suppliers.filter((supplier) => !supplier.disputed),
  ];
  const names: { supplier: SegmentSupplier; label: string }[] = [];
  let used = 0;
  for (const supplier of ordered) {
    const label = displayNameOf(supplier.name).name;
    if (names.length >= fieldNameLimit.count) break;
    if (names.length > 0 && used + label.length > fieldNameLimit.characters) break;
    names.push({ supplier, label });
    used += label.length;
  }
  return { names, rest: suppliers.length - names.length };
}

export type ShareFraction = 'quarter' | 'third' | 'half' | 'twoThirds' | 'threeQuarters';

const fractions: { key: ShareFraction; value: number }[] = [
  { key: 'quarter', value: 25 },
  { key: 'third', value: 100 / 3 },
  { key: 'half', value: 50 },
  { key: 'twoThirds', value: 200 / 3 },
  { key: 'threeQuarters', value: 75 },
];

/**
 * Anteil in Worten wie in der Vorlage („fast die Hälfte des bewerteten Spend“): bis 4 Punkte unter
 * einem Viertel, Drittel, der Hälfte, zwei Dritteln oder drei Vierteln „fast“, bis 4 darüber „gut“,
 * näher als 1 Punkt der Bruch selbst. Sonst null; dann nennt die Seite den Anteil in Prozent.
 */
export function shareInWords(
  share: number,
): { fraction: ShareFraction; approx: 'almost' | 'exact' | 'over' } | null {
  let best: { key: ShareFraction; diff: number } | null = null;
  for (const fraction of fractions) {
    const diff = share - fraction.value;
    if (Math.abs(diff) <= 4 && (!best || Math.abs(diff) < Math.abs(best.diff))) {
      best = { key: fraction.key, diff };
    }
  }
  if (!best) return null;
  const approx = Math.abs(best.diff) < 1 ? 'exact' : best.diff < 0 ? 'almost' : 'over';
  return { fraction: best.key, approx };
}

const amountIn = (spend: Money[], currency: string | undefined) =>
  spend.find((money) => money.currency === currency)?.amountCents ?? 0;

/**
 * Spend nach Segment (Vorlage): die Felder mit Spend in der Hauptwährung, der größte zuerst; der
 * Balken steht im Verhältnis zum größten (Designsprache, Diagramme: Rangfolge der Größe nach).
 */
export function spendBars(data: RelationshipSegments): {
  key: string;
  name: string;
  spend: Money;
  share: number;
}[] {
  const currency = data.ratedSpend[0]?.currency;
  if (!currency) return [];
  const bars = data.fields
    .map((field) => ({
      key: field.key,
      name: field.name,
      spend: { amountCents: amountIn(field.spend, currency), currency },
    }))
    .filter((bar) => bar.spend.amountCents > 0)
    .sort(
      (a, b) => b.spend.amountCents - a.spend.amountCents || a.name.localeCompare(b.name, 'de'),
    );
  const largest = bars[0]?.spend.amountCents ?? 0;
  return bars.map((bar) => ({ ...bar, share: largest > 0 ? bar.spend.amountCents / largest : 0 }));
}

/** Stufe einer Achse in Worten: bei 2 × 2 gering und hoch, bei 3 × 3 dazu mittel */
export function levelOf(level: number, size: 2 | 3): 'low' | 'mid' | 'high' {
  if (level <= 1) return 'low';
  return level >= size ? 'high' : 'mid';
}

/** Ist der größte Lieferant ohne Bewertung zugleich der größte des Portfolios? (Vorlage: „darunter der größte“) */
export function unratedIsLargest(data: RelationshipSegments): boolean {
  const first = data.unrated.suppliers[0]?.spend;
  if (!first) return false;
  return data.fields.every((field) =>
    field.suppliers.every(
      (supplier) =>
        !supplier.spend ||
        supplier.spend.currency !== first.currency ||
        supplier.spend.amountCents <= first.amountCents,
    ),
  );
}

/** Die Liste mit Filter Segment, über das ganze Portfolio wie die Matrix (E-K2-10) */
export function segmentListHref(segment: string): string {
  return `/beziehungen?segment=${encodeURIComponent(segment)}&portfolio=1`;
}

/** Felder in Lesefolge der Matrix: die API liefert Zeilen nach Impact absteigend, Spalten aufsteigend */
export function fieldsInReadingOrder(fields: SegmentField[]): SegmentField[] {
  return [...fields].sort(
    (a, b) => b.impactLevel - a.impactLevel || a.qualityLevel - b.qualityLevel,
  );
}
