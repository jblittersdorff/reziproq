import { z } from 'zod';

// PNL-01: Hebel-Vorlagen der GuV-Wirkung. Jede Vorlage ist eine versionierte Rechenregel mit den
// Eingaben der Baseline (eingefroren, PNL-03) und der Monatswerte (PNL-05). Gerechnet wird in SQL
// (app_lever_amount, Migration 0051); hier stehen nur Beschreibung, Eingaben und erlaubte
// Wirkungsarten. Ändert sich eine Regel, kommt eine neue Version dazu: Die alte bleibt in
// leverVersions und in SQL, damit Initiativen mit ihrer Version weiterrechnen.

export const levers = [
  'price',
  'cost_avoidance',
  'quality',
  'logistics',
  'working_capital',
  'innovation',
  'risk',
] as const;
export type Lever = (typeof levers)[number];

/** EBIT-Wirkung nie mit Kostenvermeidung, Cash oder strategischem Wert addieren. */
export const effectTypes = ['ebit', 'cost_avoidance', 'cash', 'strategic'] as const;
export type EffectType = (typeof effectTypes)[number];

export const maturityLevels = [1, 2, 3, 4, 5] as const;
export type MaturityLevel = (typeof maturityLevels)[number];

export const initiativeSources = ['jbp', 'action', 'supplier_idea'] as const;
export type InitiativeSource = (typeof initiativeSources)[number];

/** money: ganze Cent; quantity: Dezimalzahl; rate: Anteil zwischen 0 und 1. */
export type LeverInputKind = 'money' | 'quantity' | 'rate';
export interface LeverInput {
  key: string;
  kind: LeverInputKind;
}

export interface LeverTemplate {
  version: number;
  /** Eingaben der Baseline, z. B. Preis alt */
  baseline: LeverInput[];
  /** Eingaben je Monat, z. B. Preis neu und Menge */
  month: LeverInput[];
  /** Erlaubte Wirkungsarten; die erste ist der Standard */
  effectTypes: EffectType[];
}

const money = (key: string): LeverInput => ({ key, kind: 'money' });
const quantity = (key: string): LeverInput => ({ key, kind: 'quantity' });
const rate = (key: string): LeverInput => ({ key, kind: 'rate' });

/** Aktuelle Vorlage je Hebel. */
export const leverTemplates: Record<Lever, LeverTemplate> = {
  // (Preis alt − Preis neu) × Menge
  price: {
    version: 1,
    baseline: [money('price_old')],
    month: [money('price_new'), quantity('quantity')],
    effectTypes: ['ebit'],
  },
  // (angefragter Preis − vereinbarter Preis) × Menge
  cost_avoidance: {
    version: 1,
    baseline: [money('price_requested')],
    month: [money('price_agreed'), quantity('quantity')],
    effectTypes: ['cost_avoidance'],
  },
  // (Fehlerteile vorher − nachher) × Kosten je Fehlerteil
  quality: {
    version: 1,
    baseline: [quantity('defects_before'), money('cost_per_defect')],
    month: [quantity('defects_after')],
    effectTypes: ['ebit', 'cost_avoidance'],
  },
  // (Kosten je Einheit vorher − nachher) × Menge
  logistics: {
    version: 1,
    baseline: [money('unit_cost_before')],
    month: [money('unit_cost_after'), quantity('quantity')],
    effectTypes: ['ebit', 'cost_avoidance'],
  },
  // Bestandsreduktion in Euro
  working_capital: {
    version: 1,
    baseline: [money('inventory_before')],
    month: [money('inventory_after')],
    effectTypes: ['cash'],
  },
  // Zusatzumsatz × Deckungsbeitragsquote
  innovation: {
    version: 1,
    baseline: [rate('margin_rate')],
    month: [money('additional_revenue')],
    effectTypes: ['ebit', 'strategic'],
  },
  // vermiedener Schaden × Eintrittswahrscheinlichkeit
  risk: {
    version: 1,
    baseline: [rate('probability')],
    month: [money('avoided_damage')],
    effectTypes: ['strategic'],
  },
};

/** Alle Versionen je Hebel, die SQL rechnen kann; neue Versionen kommen hinten dazu. */
export const leverVersions: Record<Lever, number[]> = {
  price: [1],
  cost_avoidance: [1],
  quality: [1],
  logistics: [1],
  working_capital: [1],
  innovation: [1],
  risk: [1],
};

export function allowedEffect(lever: Lever, effect: EffectType) {
  return leverTemplates[lever].effectTypes.includes(effect);
}

/** Eingabewerte als Text: Cent als ganze Zahl, Mengen und Anteile als Dezimalzahl. */
export const leverValueSchema = z.string().regex(/^-?\d{1,14}(\.\d{1,6})?$/);

/** Prüft Eingaben gegen eine Liste der Vorlage; liefert die fehlenden oder ungültigen Schlüssel. */
export function invalidLeverInputs(inputs: Record<string, string>, fields: LeverInput[]) {
  return fields
    .filter((field) => {
      const value = inputs[field.key];
      if (value === undefined || !leverValueSchema.safeParse(value).success) return true;
      if (field.kind === 'money') return !/^-?\d+$/.test(value);
      if (field.kind === 'rate') return Number(value) < 0 || Number(value) > 1;
      return false;
    })
    .map((field) => field.key);
}
