import type { OpportunityInput } from '@reziproq/shared';

export interface MarketSource {
  title: string;
  url: string;
  publisher: string;
  /** ohne Datum wird die Quelle verworfen */
  publishedOn: string | null;
  excerpt: string;
}

export interface MarketFinding {
  kind: 'raw_material' | 'market_capacity' | 'supplier_public' | 'tariff_regulation' | 'technology';
  title: string;
  summary: string;
  direction: 'relief' | 'burden' | 'neutral';
  sources: MarketSource[];
  /** Werte, die eine Vorlage als public_source übernimmt */
  values?: Record<string, string>;
}

const monthsBefore = (asOf: string, months: number) => {
  const date = new Date(`${asOf}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
};

/** Quellen dürfen höchstens 24 Monate alt sein und brauchen ein Datum (KI-11, Marktumfeld). */
export function datedSources(sources: MarketSource[], asOf: string) {
  const from = monthsBefore(asOf, 24);
  return sources.filter(
    (source): source is MarketSource & { publishedOn: string } =>
      source.publishedOn !== null && source.publishedOn >= from && source.publishedOn <= asOf,
  );
}

/**
 * Feste Testquellen des lokalen Anbieters, datiert relativ zum Stichtag: ein Rohstoffindex mit zwei
 * unabhängigen Quellen, eine Zolländerung, eine Technologie, eine Angabe des Lieferanten, dazu eine
 * veraltete und eine undatierte Quelle, die nie zum Signal werden.
 */
export function fakeMarketFindings(asOf: string, materialGroup: string): MarketFinding[] {
  const recent = monthsBefore(asOf, 1);
  return [
    {
      kind: 'raw_material',
      title: 'Kupferindex gesunken',
      summary: `Der Kupferindex liegt unter dem Stand bei Preisfestlegung; betrifft ${materialGroup}.`,
      direction: 'relief',
      sources: [
        {
          title: 'Kupferindex Monatsstand',
          url: 'https://index-one.example.test/kupfer',
          publisher: 'Index One',
          publishedOn: recent,
          excerpt: 'Index 88, Basis 100 zum Jahresbeginn 2025.',
        },
        {
          title: 'Metallpreise im Überblick',
          url: 'https://index-two.example.test/metalle',
          publisher: 'Index Two',
          publishedOn: recent,
          excerpt: 'Kupfer 88 Punkte gegenüber 100 zum Jahresbeginn 2025.',
        },
      ],
      values: { base_index: '100', current_index: '88' },
    },
    {
      kind: 'tariff_regulation',
      title: 'Zollsatz für Vorprodukte steigt',
      summary: 'Für Vorprodukte aus Drittstaaten steigt der Zollsatz.',
      direction: 'burden',
      sources: [
        {
          title: 'Amtsblatt: Änderung der Zollsätze',
          url: 'https://amtsblatt.example.test/zoll',
          publisher: 'Amtsblatt',
          publishedOn: recent,
          excerpt: 'Der Satz steigt von 2 auf 6 Prozent.',
        },
      ],
      values: { tariff_before: '0.02', tariff_after: '0.06' },
    },
    {
      kind: 'technology',
      title: 'Neues Fertigungsverfahren im Markt',
      summary: 'Ein neues Verfahren senkt Ausschuss in der Fertigung.',
      direction: 'relief',
      sources: [
        {
          title: 'Fachpresse: Verfahren im Test',
          url: 'https://fachpresse.example.test/verfahren',
          publisher: 'Fachpresse',
          publishedOn: recent,
          excerpt: 'Erste Hersteller testen das Verfahren.',
        },
      ],
    },
    {
      kind: 'supplier_public',
      title: 'Lieferant eröffnet neues Werk',
      summary: 'Der Lieferant berichtet von einem neuen Werk.',
      direction: 'neutral',
      sources: [
        {
          title: 'Geschäftsbericht',
          url: 'https://lieferant.example.test/bericht',
          publisher: 'Lieferant',
          publishedOn: recent,
          excerpt: 'Ein neues Werk geht in Betrieb.',
        },
      ],
    },
    {
      kind: 'market_capacity',
      title: 'Alte Marktstudie',
      summary: 'Veraltete Angabe zur Kapazität im Markt.',
      direction: 'burden',
      sources: [
        {
          title: 'Marktstudie',
          url: 'https://studie.example.test/alt',
          publisher: 'Studie',
          publishedOn: monthsBefore(asOf, 30),
          excerpt: 'Kapazität knapp.',
        },
      ],
    },
    {
      kind: 'market_capacity',
      title: 'Undatierte Meldung',
      summary: 'Meldung ohne Datum.',
      direction: 'burden',
      sources: [
        {
          title: 'Meldung',
          url: 'https://meldung.example.test/ohne-datum',
          publisher: 'Meldung',
          publishedOn: null,
          excerpt: 'Kapazität knapp.',
        },
      ],
    },
  ];
}

/** Ziffernfolgen einer Zeichenkette, Tausender- und Dezimaltrenner entfernt */
const numbersIn = (text: string) =>
  (text.match(/\d[\d.,]*/g) ?? []).map((value) => value.replace(/[.,]/g, '')).filter(Boolean);

/**
 * Filter vor dem Senden (KI-11): Eine Suchanfrage darf keine Zahl aus dem Spend oder aus Angaben
 * des Lieferanten enthalten. Verglichen wird ohne Trennzeichen, damit „1.250.000“ und „1250000“
 * gleich gelten.
 */
export function queryAllowed(query: string, forbidden: Iterable<string>) {
  const blocked = new Set([...forbidden].map((value) => value.replace(/[.,]/g, '')));
  return !numbersIn(query).some((value) => blocked.has(value));
}

/** Zahlen aus Eingaben, die nie nach außen dürfen (eigene Daten und Angaben des Lieferanten) */
export function privateNumbers(inputs: OpportunityInput[]) {
  return inputs
    .filter((input) => input.source.kind === 'own_data' || input.source.kind === 'supplier_input')
    .flatMap((input) => {
      const cents = [input.low, input.high];
      const euros = cents
        .filter((value) => /^\d+$/.test(value))
        .map((value) => String(Math.round(Number(value) / 100)));
      return [...cents, ...euros];
    });
}

/**
 * Eine Modellausgabe ist nur gültig, wenn jede Zahl darin in den Eingaben oder Ergebnissen
 * vorkommt (KI-11). Sonst wird sie verworfen.
 */
export function reasonAllowed(text: string, allowed: Iterable<string>) {
  const known = new Set([...allowed].map((value) => value.replace(/[.,]/g, '')));
  return numbersIn(text).every((value) => known.has(value));
}
