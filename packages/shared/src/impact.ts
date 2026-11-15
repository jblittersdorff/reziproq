import { z } from 'zod';
import { effectTypes, initiativeSources, levers, leverValueSchema } from './levers.js';

// PNL-01, PNL-03: Wirkung einer Initiative auf der Käuferseite, GuV-Zeilen, Baseline, Reifegrad.

export const pnlLineSchema = z.object({
  key: z.string(),
  name: z.string(),
  position: z.number().int(),
  active: z.boolean(),
});
export type PnlLine = z.infer<typeof pnlLineSchema>;

export const pnlLinesSchema = z.object({ lines: z.array(pnlLineSchema), canManage: z.boolean() });
export type PnlLines = z.infer<typeof pnlLinesSchema>;

export const savePnlLineSchema = z
  .object({
    /** Nur beim Anlegen; danach bleibt der Schlüssel, weil Initiativen auf ihn zeigen */
    key: z
      .string()
      .regex(/^[a-z][a-z0-9_]{1,40}$/)
      .optional(),
    name: z.string().trim().min(1).max(120),
    position: z.number().int().min(0).max(999),
    active: z.boolean(),
  })
  .strict();
export type SavePnlLine = z.infer<typeof savePnlLineSchema>;

export const maturityStepSchema = z.object({
  fromLevel: z.number().int(),
  toLevel: z.number().int(),
  evidence: z.string(),
  evidenceLink: z.string().nullable(),
  decidedByName: z.string(),
  decidedAt: z.string(),
});
export type MaturityStep = z.infer<typeof maturityStepSchema>;

/** Reifegrad für beide Seiten: Stufe und die Stufen mit Nachweis (geteilt). */
export const maturitySchema = z.object({
  level: z.number().int().min(1).max(5),
  steps: z.array(maturityStepSchema),
});
export type Maturity = z.infer<typeof maturitySchema>;

export const impactSetupSchema = z.object({
  lever: z.enum(levers),
  leverTemplateVersion: z.number().int(),
  pnlLine: z.object({ key: z.string(), name: z.string() }),
  effectType: z.enum(effectTypes),
  effectiveFrom: z.iso.date().nullable(),
});

// PNL-07: Teilungsregel, Wirkungsarten getrennt, keine Doppelzählung.

export const initiativeShareSchema = z.object({
  id: z.uuid(),
  buyerSharePct: z.number().int(),
  supplierSharePct: z.number().int(),
  ruleText: z.string().nullable(),
  proposedByName: z.string(),
  proposedAt: z.string(),
  /** Bestätigt durch den Lieferanten; erst dann ist die Teilung vereinbart */
  supplierConfirmedByName: z.string().nullable(),
  agreedAt: z.string().nullable(),
});
export type InitiativeShare = z.infer<typeof initiativeShareSchema>;

/** Summe genau einer Wirkungsart; es gibt keine Summe über Arten hinweg. */
export const effectTotalSchema = z.object({
  effectType: z.enum(effectTypes),
  plan: z.number().int(),
  actual: z.number().int(),
});
export type EffectTotal = z.infer<typeof effectTotalSchema>;

export const savingsReferenceSchema = z.object({
  system: z.string().trim().min(1).max(80),
  reference: z.string().trim().min(1).max(200),
});
export type SavingsReference = z.infer<typeof savingsReferenceSchema>;
export const saveSavingsReferenceSchema = savingsReferenceSchema.strict();

export const saveShareSchema = z
  .object({
    buyerSharePct: z.number().int().min(0).max(100),
    supplierSharePct: z.number().int().min(0).max(100),
    ruleText: z.string().trim().max(1000).nullable(),
  })
  .strict()
  .refine((input) => input.buyerSharePct + input.supplierSharePct === 100, {
    message: 'share_sum',
    path: ['supplierSharePct'],
  });
export type SaveShare = z.infer<typeof saveShareSchema>;

export const impactListSchema = z.object({
  canEdit: z.boolean(),
  /** SRO oder Admin: Teilung vorschlagen und Savings-Verweis setzen */
  canLead: z.boolean(),
  initiatives: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      source: z.enum(initiativeSources),
      maturity: z.number().int(),
      impact: impactSetupSchema.nullable(),
      share: initiativeShareSchema.nullable(),
      /** Bereits im Savings-Tracking: zählt in keiner Summe */
      savingsReference: savingsReferenceSchema.nullable(),
    }),
  ),
  /** Je Wirkungsart eine Summe, ohne Initiativen mit Savings-Verweis */
  totals: z.array(effectTotalSchema),
});
export type ImpactList = z.infer<typeof impactListSchema>;

export const baselineSchema = z.object({
  version: z.number().int(),
  leverTemplateVersion: z.number().int(),
  inputs: z.record(z.string(), z.string()),
  frozenAt: z.string(),
  frozenByName: z.string(),
  changeReason: z.string().nullable(),
});
export type Baseline = z.infer<typeof baselineSchema>;

/** Was die nächste Stufe als Nachweis braucht und ob er da ist (PNL-03). */
export const nextMaturitySchema = z.object({
  toLevel: z.number().int(),
  /** R2: Baseline; R3: Plan freigegeben oder Beschluss; R4: Umsetzung; R5: nur Freigabe (PNL-06) */
  requirement: z.enum(['baseline', 'decision', 'implementation', 'validation']),
  /** R2: Baseline eingefroren; R3: Plan freigegeben */
  ready: z.boolean(),
  /** R3: Beschlüsse aus Terminen der Beziehung als Nachweis */
  decisions: z.array(z.object({ id: z.uuid(), text: z.string(), meeting: z.string() })),
});

export const impactDetailSchema = z.object({
  /** PNL-05: Monate mit Eingaben und Betrag, älteste zuerst, und die Summen je Art */
  months: z.array(z.lazy(() => impactMonthSchema)),
  totals: z.object({ plan: z.number().int(), actual: z.number().int() }),
  /** PNL-06: Freigaben dieser Initiative, neueste zuerst */
  validations: z.array(z.lazy(() => validationSchema)),
  canRequestValidation: z.boolean(),
  initiative: z.object({
    id: z.uuid(),
    title: z.string(),
    source: z.enum(initiativeSources),
    startsOn: z.iso.date(),
  }),
  impact: impactSetupSchema.nullable(),
  baselines: z.array(baselineSchema),
  maturity: maturitySchema,
  next: nextMaturitySchema.nullable(),
  canEdit: z.boolean(),
});
export type ImpactDetail = z.infer<typeof impactDetailSchema>;

export const setupImpactSchema = z
  .object({
    lever: z.enum(levers),
    pnlLineKey: z.string().min(1).max(41),
    effectType: z.enum(effectTypes),
    effectiveFrom: z.iso.date().nullable(),
  })
  .strict();
export type SetupImpact = z.infer<typeof setupImpactSchema>;

export const freezeBaselineSchema = z
  .object({
    inputs: z.record(z.string(), leverValueSchema),
    changeReason: z.string().trim().max(2000).nullable(),
  })
  .strict();
export type FreezeBaseline = z.infer<typeof freezeBaselineSchema>;

export const raiseMaturitySchema = z
  .object({
    toLevel: z.number().int().min(2).max(5),
    /** R3: Beschluss aus einem Termin statt freigegebenem Plan */
    decisionId: z.uuid().nullable(),
    /** R4: Datum der Umsetzung und kurzer Nachweis */
    implementedOn: z.iso.date().nullable(),
    evidence: z.string().trim().max(2000).nullable(),
    evidenceLink: z.url().max(500).nullable(),
  })
  .strict();
export type RaiseMaturity = z.infer<typeof raiseMaturitySchema>;

/** Standard-GuV-Zeilen (PNL-01); sie entstehen beim ersten Lesen je Organisation. */
export const defaultPnlLines = [
  { key: 'revenue', name: 'Umsatzerlöse' },
  { key: 'material', name: 'Materialaufwand' },
  { key: 'quality', name: 'Qualitätskosten' },
  { key: 'logistics', name: 'Logistikkosten' },
  { key: 'other_opex', name: 'Sonstige betriebliche Aufwendungen' },
  { key: 'inventory', name: 'Vorräte' },
] as const;

// PNL-05: Monatswerte Plan und Ist mit berechnetem Betrag.

export const monthKinds = ['plan', 'actual'] as const;
export type MonthKind = (typeof monthKinds)[number];

export const impactMonthEntrySchema = z.object({
  inputs: z.record(z.string(), z.string()),
  /** Berechnet in SQL; null ohne Baseline */
  amountCents: z.number().int().nullable(),
  enteredByName: z.string(),
  source: z.enum(['manual', 'csv']),
});

export const impactMonthSchema = z.object({
  month: z.iso.date(),
  plan: impactMonthEntrySchema.nullable(),
  actual: impactMonthEntrySchema.nullable(),
  /** In einem von Controlling freigegebenen Zeitraum (PNL-06) */
  locked: z.boolean(),
});
export type ImpactMonth = z.infer<typeof impactMonthSchema>;

export const saveImpactMonthSchema = z
  .object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    kind: z.enum(monthKinds),
    inputs: z.record(z.string(), leverValueSchema),
  })
  .strict();
export type SaveImpactMonth = z.infer<typeof saveImpactMonthSchema>;

export const impactImportErrors = [
  'monat_ungueltig',
  'art_ungueltig',
  'eingabe_ungueltig',
  'monat_gesperrt',
  'doppelt',
] as const;

export const impactImportPreviewSchema = z.object({
  rows: z.array(
    z.object({
      row: z.number().int(),
      month: z.string(),
      kind: z.string(),
      inputs: z.record(z.string(), z.string()),
      errors: z.array(z.enum(impactImportErrors)),
      /** Fehlende oder ungültige Eingaben der Vorlage */
      fields: z.array(z.string()),
    }),
  ),
  valid: z.number().int(),
  invalid: z.number().int(),
});
export type ImpactImportPreview = z.infer<typeof impactImportPreviewSchema>;

// PNL-06: Freigabe durch Controlling.

export const validationStatusList = ['requested', 'approved', 'rejected'] as const;

export const validationSchema = z.object({
  id: z.uuid(),
  relationshipId: z.uuid(),
  supplier: z.string(),
  initiativeId: z.uuid(),
  initiative: z.string(),
  periodFrom: z.iso.date(),
  periodTo: z.iso.date(),
  status: z.enum(validationStatusList),
  requestedByName: z.string(),
  requestedAt: z.string(),
  decidedByName: z.string().nullable(),
  decidedAt: z.string().nullable(),
  comment: z.string().nullable(),
});
export type Validation = z.infer<typeof validationSchema>;

export const validationListSchema = z.object({
  validations: z.array(validationSchema),
  canDecide: z.boolean(),
});
export type ValidationList = z.infer<typeof validationListSchema>;

export const validationDetailSchema = z.object({
  validation: validationSchema,
  impact: impactSetupSchema,
  baseline: baselineSchema.nullable(),
  months: z.array(impactMonthSchema),
  totals: z.object({ plan: z.number().int(), actual: z.number().int() }),
  maturity: maturitySchema,
  canDecide: z.boolean(),
});
export type ValidationDetail = z.infer<typeof validationDetailSchema>;

export const requestValidationSchema = z
  .object({
    periodFrom: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    periodTo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  })
  .strict()
  .refine((value) => value.periodTo >= value.periodFrom, {
    path: ['periodTo'],
    message: 'ende_vor_beginn',
  });
export type RequestValidation = z.infer<typeof requestValidationSchema>;

export const decideValidationSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    comment: z.string().trim().max(2000).nullable(),
  })
  .strict()
  .refine((value) => value.decision === 'approved' || (value.comment ?? '').length > 0, {
    path: ['comment'],
    message: 'begruendung_fehlt',
  });
export type DecideValidation = z.infer<typeof decideValidationSchema>;

// PNL-07: Wirkung beim Lieferanten unter /kunden/<beziehung>/wirkung.

export const supplierBenefitSchema = z.object({
  id: z.uuid(),
  month: z.iso.date(),
  amountCents: z.number().int(),
  currency: z.string(),
  note: z.string().nullable(),
});
export type SupplierBenefit = z.infer<typeof supplierBenefitSchema>;

export const customerImpactSchema = z.object({
  initiatives: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      share: initiativeShareSchema.nullable(),
      /** Vereinbarte Wirkung, erst sichtbar nach der Vereinbarung */
      value: effectTotalSchema.nullable(),
      /** Nur für den Lieferanten sichtbar */
      benefits: z.array(supplierBenefitSchema),
    }),
  ),
  totals: z.array(effectTotalSchema),
  /** Eigener Nutzen je Währung, nie mit der vereinbarten Wirkung addiert */
  benefitTotals: z.array(z.object({ currency: z.string(), amountCents: z.number().int() })),
  canConfirm: z.boolean(),
  canEditBenefit: z.boolean(),
});
export type CustomerImpact = z.infer<typeof customerImpactSchema>;

export const saveBenefitSchema = z
  .object({
    month: z.iso.date().refine((date) => date.endsWith('-01'), { message: 'invalid_month' }),
    amountCents: z.number().int(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    note: z.string().trim().max(500).nullable(),
  })
  .strict();
export type SaveBenefit = z.infer<typeof saveBenefitSchema>;

// PNL-10: P&L-Brücke und Wirkung im Portfolio. Zwei Sichten: Jahreswirkung (zwölf Monate ab
// Wirkungsbeginn) und Wirkung im Geschäftsjahr (Beginn je Kunde einstellbar, Standard Januar).

export const impactViews = ['jahreswirkung', 'geschaeftsjahr'] as const;
export type ImpactView = (typeof impactViews)[number];

export const fiscalYearSettingSchema = z
  .object({ startMonth: z.number().int().min(1).max(12) })
  .strict();
export type FiscalYearSetting = z.infer<typeof fiscalYearSettingSchema>;

/** Erster Monat (inklusive) und Monat nach dem Ende (exklusive) eines Geschäftsjahrs, YYYY-MM-01. */
export function fiscalYearRange(startYear: number, startMonth: number): [string, string] {
  const month = (year: number, m: number) => `${year}-${String(m).padStart(2, '0')}-01`;
  return [month(startYear, startMonth), month(startYear + 1, startMonth)];
}

/** Geschäftsjahr eines Datums: das Startjahr des Geschäftsjahrs, in dem es liegt. */
export function fiscalYearOf(date: string, startMonth: number): number {
  const [year = 0, month = 1] = date.split('-').map(Number);
  return month >= startMonth ? year : year - 1;
}

/** Zwölf Monate ab dem Wirkungsbeginn (Monat des Datums), YYYY-MM-01. */
export function annualRange(effectiveFrom: string): [string, string] {
  const [year = 0, month = 1] = effectiveFrom.split('-').map(Number);
  return fiscalYearRange(year, month);
}

export interface MonthValue {
  month: string;
  kind: 'plan' | 'actual';
  valueCents: number;
}

/**
 * Wirkung in einem Zeitraum: je Monat das Ist, wo es eines gibt, sonst der Plan. Monate sind
 * YYYY-MM-01; das Ende ist exklusiv.
 */
export function amountInRange(values: MonthValue[], from: string, to: string): number {
  const months = new Map<string, { plan?: number; actual?: number }>();
  for (const value of values) {
    if (value.month < from || value.month >= to) continue;
    const entry = months.get(value.month) ?? {};
    entry[value.kind] = (entry[value.kind] ?? 0) + value.valueCents;
    months.set(value.month, entry);
  }
  let total = 0;
  for (const entry of months.values()) total += entry.actual ?? entry.plan ?? 0;
  return total;
}

const viewSchema = {
  view: z.enum(impactViews),
  /** Startjahr des gewählten Geschäftsjahrs */
  fiscalYear: z.number().int(),
  fiscalYearStartMonth: z.number().int(),
  /** Geschäftsjahre mit Werten, zum Auswählen */
  fiscalYears: z.array(z.number().int()),
};

export const bridgeSchema = z.object({
  ...viewSchema,
  /** Nur EBIT; je Initiative ein Balken in der Farbe ihres Reifegrads */
  steps: z.array(
    z.object({
      initiativeId: z.uuid(),
      title: z.string(),
      maturity: z.number().int(),
      amountCents: z.number().int(),
    }),
  ),
  ebitTotal: z.number().int(),
  /** Andere Wirkungsarten je eigene Kachel, nie im Wasserfall */
  others: z.array(z.object({ effectType: z.enum(effectTypes), amountCents: z.number().int() })),
  /** Bereits im Savings-Tracking: in keiner Summe (nur beim Käufer) */
  excluded: z.array(z.object({ initiativeId: z.uuid(), title: z.string() })),
});
export type Bridge = z.infer<typeof bridgeSchema>;

export const portfolioImpactSchema = z.object({
  ...viewSchema,
  focusSuppliers: z.number().int(),
  /** Je Wirkungsart die Wirkung nach Reifegrad R1 bis R5 */
  pipeline: z.array(
    z.object({
      effectType: z.enum(effectTypes),
      levels: z.array(z.object({ level: z.number().int(), amountCents: z.number().int() })),
    }),
  ),
  /** EBIT-Wirkung je Business Unit und Geschäftsjahr; Lieferanten mit mehreren BUs zählen in jeder */
  businessUnits: z.object({
    years: z.array(z.number().int()),
    rows: z.array(
      z.object({
        id: z.uuid().nullable(),
        name: z.string().nullable(),
        amounts: z.array(z.number().int()),
      }),
    ),
  }),
  /** Nach realisierter EBIT-Wirkung (Ist in von Controlling freigegebenen Zeiträumen) */
  top: z.array(
    z.object({ relationshipId: z.uuid(), name: z.string(), realizedCents: z.number().int() }),
  ),
});
export type PortfolioImpact = z.infer<typeof portfolioImpactSchema>;
