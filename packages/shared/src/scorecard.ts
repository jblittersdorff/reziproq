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

// JBP-09: Stand „auf Kurs“ je Kennzahl.
export const kpiTracks = ['on_track', 'close', 'off'] as const;
export type KpiTrack = (typeof kpiTracks)[number];
export const defaultKpiTolerance = 10;

/** Monat als erster Tag, z. B. „2027-03-01“; der Import nimmt auch „2027-03“ und „03.2027“. */
export function parseKpiMonth(text: string): string | null {
  const value = text.trim();
  const iso = /^(\d{4})-(\d{2})(?:-01)?$/.exec(value);
  const german = /^(\d{1,2})[./](\d{4})$/.exec(value);
  const [year, month] = iso ? [iso[1], iso[2]] : german ? [german[2], german[1]] : [];
  if (!year || !month) return null;
  const number = Number(month);
  if (number < 1 || number > 12) return null;
  return `${year}-${String(number).padStart(2, '0')}-01`;
}

/** Dezimalzahl aus „97,5“ oder „97.5“; Tausenderpunkte sind nicht erlaubt (eindeutig statt raten). */
export function parseKpiNumber(text: string): string | null {
  const value = text.trim().replace(',', '.');
  return /^-?\d{1,14}(\.\d{1,4})?$/.test(value) ? value : null;
}

const daysBetween = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

/**
 * Stand einer Kennzahl (JBP-09): Der letzte Wert wird mit der Linie von der Basis (zum Start) zum
 * Ziel (zum Termin) verglichen. Liegt er auf oder vor der Linie, ist sie auf Kurs; bis zur Toleranz
 * dahinter „knapp“, darüber „nicht auf Kurs“. Die Richtung entscheidet, was „dahinter“ heißt.
 * Ohne Basis gilt der erste Wert als Basis. Ohne Werte gibt es keinen Stand.
 */
export function kpiTrack(
  kpi: {
    baseline: string | null;
    target: string;
    direction: 'higher' | 'lower';
    startDate: string;
    targetDate: string;
  },
  values: { period: string; value: string }[],
  tolerancePercent: number = defaultKpiTolerance,
): KpiTrack | null {
  const sorted = [...values].sort((a, b) => a.period.localeCompare(b.period));
  const latest = sorted.at(-1);
  if (!latest) return null;
  const baseline = Number(kpi.baseline ?? sorted[0]?.value);
  const target = Number(kpi.target);
  const span = daysBetween(kpi.startDate, kpi.targetDate);
  const progress =
    span <= 0 ? 1 : Math.min(1, Math.max(0, daysBetween(kpi.startDate, latest.period) / span));
  const expected = baseline + (target - baseline) * progress;
  const actual = Number(latest.value);
  const behind = kpi.direction === 'higher' ? expected - actual : actual - expected;
  if (behind <= 0) return 'on_track';
  const scale = Math.abs(expected) > 0 ? Math.abs(expected) : Math.abs(target - baseline) || 1;
  // Auf vier Nachkommastellen runden, damit Grenzfälle wie genau 10 % nicht an Rundung scheitern.
  const percent = Math.round((behind / scale) * 100 * 10_000) / 10_000;
  return percent <= tolerancePercent ? 'close' : 'off';
}

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
  /** Beginn der Linie von der Basis zum Ziel (Anlage der Kennzahl) */
  startDate: z.iso.date(),
  /** Ist-Werte je Monat, älteste zuerst (JBP-09) */
  values: z.array(z.object({ period: z.iso.date(), value: z.string() })),
  track: z.enum(kpiTracks).nullable(),
  /** Die verantwortliche Seite erfasst Werte */
  canEnter: z.boolean(),
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
  /** Ab wann „knapp“ in „nicht auf Kurs“ übergeht, je Kunde (JBP-09) */
  tolerancePercent: z.number().int(),
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

// JBP-09: Ist-Werte erfassen und importieren.

export const kpiValueRowSchema = z.object({
  period: z.iso.date(),
  value: z.string(),
  source: z.enum(['manual', 'csv']),
  enteredByName: z.string(),
  enteredAt: z.string(),
});

export const kpiDetailSchema = z.object({
  kpi: kpiSchema,
  values: z.array(kpiValueRowSchema),
  tolerancePercent: z.number().int(),
});
export type KpiDetail = z.infer<typeof kpiDetailSchema>;

export const saveKpiValueSchema = z
  .object({
    /** Monat als „2027-03“ */
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    value: decimalSchema,
  })
  .strict();
export type SaveKpiValue = z.infer<typeof saveKpiValueSchema>;

export const kpiImportErrors = [
  'kennzahl_unbekannt',
  'kennzahl_andere_seite',
  'monat_ungueltig',
  'wert_ungueltig',
  'doppelt',
] as const;

export const kpiImportPreviewSchema = z.object({
  rows: z.array(
    z.object({
      row: z.number().int(),
      kpi: z.string(),
      month: z.string(),
      value: z.string(),
      errors: z.array(z.enum(kpiImportErrors)),
    }),
  ),
  valid: z.number().int(),
  invalid: z.number().int(),
});
export type KpiImportPreview = z.infer<typeof kpiImportPreviewSchema>;

export const scorecardSettingSchema = z
  .object({ tolerancePercent: z.number().int().min(0).max(50) })
  .strict();
export type ScorecardSetting = z.infer<typeof scorecardSettingSchema>;
