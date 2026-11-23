// WEB-01: Preisrechner der Seite „Preise“. Alle Beträge als Ganzzahl in Cent.
// Wert = bestätigtes EBIT + 8 % des freigesetzten Kapitals (Zinsvorteil, nicht das Kapital selbst).
// Erfolgsanteil gestaffelt: 10 % bis 1 Mio. €, 5 % bis 5 Mio. €, 2 % darüber.

export const feePerRelationshipMonthCents = 199_00;
export const capitalRatePercent = 8;

const tiers: { upToCents: number; percent: number }[] = [
  { upToCents: 1_000_000_00, percent: 10 },
  { upToCents: 5_000_000_00, percent: 5 },
  { upToCents: Number.POSITIVE_INFINITY, percent: 2 },
];

/** Erfolgsanteil in Cent für einen gezählten Wert in Cent */
export function successShareCents(valueCents: number): number {
  let share = 0;
  let lower = 0;
  for (const tier of tiers) {
    if (valueCents <= lower) break;
    const slice = Math.min(valueCents, tier.upToCents) - lower;
    share += (slice * tier.percent) / 100;
    lower = tier.upToCents;
  }
  return Math.round(share);
}

export interface PricingInput {
  relationships: number;
  ebitCents: number;
  capitalCents: number;
}

export interface PricingResult {
  valueCents: number;
  feesCents: number;
  shareCents: number;
  payCents: number;
  keepCents: number;
  /** Anteil der Zahlung am Wert in Prozent, null ohne Wert */
  payPercent: number | null;
  /** Euro Wert je gezahltem Euro, null ohne Zahlung */
  returnPerEuro: number | null;
}

/** Ein Jahr: alle Beziehungen in jedem Monat aktiv */
export function priceYear(input: PricingInput): PricingResult {
  const valueCents = input.ebitCents + Math.round((input.capitalCents * capitalRatePercent) / 100);
  const feesCents = input.relationships * feePerRelationshipMonthCents * 12;
  const shareCents = successShareCents(valueCents);
  const payCents = feesCents + shareCents;
  return {
    valueCents,
    feesCents,
    shareCents,
    payCents,
    keepCents: valueCents - payCents,
    payPercent: valueCents > 0 ? (payCents / valueCents) * 100 : null,
    returnPerEuro: payCents > 0 ? valueCents / payCents : null,
  };
}

const intl = (locale: 'en' | 'de') => (locale === 'de' ? 'de-DE' : 'en-GB');

/** Betrag in ganzen Euro, z. B. €1,234,567 oder 1.234.567 € */
export function formatEuro(cents: number, locale: 'en' | 'de'): string {
  return new Intl.NumberFormat(intl(locale), {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100));
}

/** Betrag kurz, z. B. €10M oder 10 Mio. € */
export function formatEuroShort(cents: number, locale: 'en' | 'de'): string {
  // en-GB schreibt „€10m“; die Website schreibt Millionen wie die Vorlage mit großem M
  return new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-US', {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.round(cents / 100));
}

/** Prozent mit einer Stelle, z. B. 9.1% oder 9,1 % */
export function formatPercent(value: number, locale: 'en' | 'de'): string {
  const number = new Intl.NumberFormat(intl(locale), { maximumFractionDigits: 1 }).format(value);
  return locale === 'de' ? `${number} %` : `${number}%`;
}

export function formatRatio(value: number, locale: 'en' | 'de'): string {
  return new Intl.NumberFormat(intl(locale), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}
