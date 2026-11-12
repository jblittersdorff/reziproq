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

export const impactListSchema = z.object({
  canEdit: z.boolean(),
  initiatives: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      source: z.enum(initiativeSources),
      maturity: z.number().int(),
      impact: impactSetupSchema.nullable(),
    }),
  ),
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
