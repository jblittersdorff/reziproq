import { z } from 'zod';
import { personSchema } from './commitments.js';
import { meetingSides } from './meetings.js';

// JBP-07: Scorecard mit höchstens zehn Kennzahlen und den Unterschriften beider Seiten.

export const maxScorecardKpis = 10;
export const kpiDirections = ['higher', 'lower'] as const;
export const kpiBenefits = ['buyer', 'supplier', 'both'] as const;

/** Dezimalzahl als Text, z. B. „95“ oder „-3.5“; nie Gleitkomma in der Datenbank. */
export const decimalSchema = z
  .string()
  .trim()
  .regex(/^-?\d{1,14}(\.\d{1,4})?$/, 'keine_zahl');

export const kpiSchema = z.object({
  id: z.uuid(),
  own: z.boolean(),
  ownerSide: z.enum(meetingSides),
  initiative: z.object({ id: z.uuid(), title: z.string() }).nullable(),
  name: z.string(),
  unit: z.string(),
  direction: z.enum(kpiDirections),
  baseline: z.string().nullable(),
  target: z.string(),
  targetDate: z.iso.date(),
  ownerUserId: z.string().nullable(),
  ownerName: z.string(),
  benefitFor: z.enum(kpiBenefits),
});
export type Kpi = z.infer<typeof kpiSchema>;

export const scorecardViewSchema = z.object({
  hasPlan: z.boolean(),
  ownSide: z.enum(meetingSides),
  status: z.enum(['draft', 'signed']),
  version: z.number().int(),
  kpis: z.array(kpiSchema),
  /** Unterschriften unter die laufende Version */
  signatures: z.array(
    z.object({ side: z.enum(meetingSides), userName: z.string(), signedAt: z.string() }),
  ),
  /** Frist aus dem Zyklus (ZYK-02); nur der Käufer kennt sie */
  deadline: z.iso.date().nullable(),
  canEdit: z.boolean(),
  canSign: z.boolean(),
  canNewVersion: z.boolean(),
  people: z.array(personSchema),
  initiatives: z.array(z.object({ id: z.uuid(), title: z.string() })),
});
export type ScorecardView = z.infer<typeof scorecardViewSchema>;

export const saveKpiSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    unit: z.string().trim().min(1).max(30),
    direction: z.enum(kpiDirections),
    baseline: decimalSchema.nullable(),
    target: decimalSchema,
    targetDate: z.iso.date(),
    ownerUserId: z.string().min(1),
    benefitFor: z.enum(kpiBenefits),
    initiativeId: z.uuid().nullable(),
  })
  .strict();
export type SaveKpi = z.infer<typeof saveKpiSchema>;
