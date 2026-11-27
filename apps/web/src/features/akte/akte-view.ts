import type { AkteCommitment, AkteShared } from '@reziproq/shared';
import { z } from 'zod';

// AK-01 (K2-c.2): Regeln der Akte ohne Oberfläche. Die Sicht steht in der Adresse
// (`?sicht=privat`, `?sicht=geteilt`); ohne Angabe Gemeinsam (T2-04).

export const akteSearchSchema = z.object({
  sicht: z.enum(['privat', 'geteilt']).optional().catch(undefined),
});
export type AkteSearch = z.infer<typeof akteSearchSchema>;
export type AkteViewKey = 'gemeinsam' | 'privat' | 'geteilt';

export const viewOf = (search: AkteSearch): AkteViewKey => search.sicht ?? 'gemeinsam';

/** Wer hält mehr Zusagen (Das Wichtigste); none, solange eine Seite nichts Fälliges hat */
export function comparison(quota: AkteShared['quota']): 'more' | 'less' | 'equal' | 'none' {
  const own = quota.own.percent;
  const counterpart = quota.counterpart.percent;
  if (own === null || counterpart === null) return 'none';
  return own > counterpart ? 'more' : own < counterpart ? 'less' : 'equal';
}

/** Überfällige Zusagen einer Seite, in der Folge der Liste (nach Frist) */
export const overdueOf = (commitments: AkteCommitment[], side: AkteCommitment['side']) =>
  commitments.filter((entry) => entry.side === side && entry.state === 'overdue');

/** Zahl aus der Datenbank („94.0000“) im Format der Sprache, höchstens zwei Nachkommastellen */
export function numberText(value: string, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(value));
}

/** Wert mit Einheit, z. B. „94 %“, „28 ppm“, „14 Tage“ */
export const measureText = (value: string, unit: string, locale: string) =>
  `${numberText(value, locale)} ${unit}`;

/** Monat eines Werts („2026-10-01“ → „Oktober“) */
export function monthOf(period: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
    new Date(`${period}T00:00:00Z`),
  );
}

/** Liegt ein Tag höchstens `days` Tage nach heute? Dann steht der Wochentag dabei („bis Fr 27.11.“) */
export function isNear(date: string, today: string, days = 14): boolean {
  const diff = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return diff >= 0 && diff <= days;
}
