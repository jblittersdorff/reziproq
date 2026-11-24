import { z } from 'zod';
import { daysBetween } from './my-day.js';
import { sentenceFactSchema } from './sentence.js';

// HE-01 (K1-c): Triage und Heute. Jedes Ergebnis (Hinweis, Entwurf, Lauf, Frist, Freigabe) wird
// genau ein Fokus-Thema der Person. Heute zeigt davon höchstens drei (E-K1-3); alles andere steht in
// der Ansicht Alles (K1-e). Die Werte gleichen focusLevels, focusKinds und focusStates in packages/db.

export const focusTopicLevels = ['focus', 'review', 'done'] as const;
export const focusTopicKinds = ['decision', 'approval', 'conversation', 'draft', 'info'] as const;
export const focusTopicStates = ['open', 'decided', 'snoozed', 'dismissed'] as const;
export type FocusTopicLevel = (typeof focusTopicLevels)[number];
export type FocusTopicKind = (typeof focusTopicKinds)[number];

/** Höchstens so viele Fokus-Themen zeigt Heute (E-K1-3): „Als Nächstes“ und zwei weitere */
export const maxVisibleFocus = 3;

export const focusTopicSchema = z.object({
  id: z.uuid(),
  level: z.enum(focusTopicLevels),
  kind: z.enum(focusTopicKinds),
  title: z.string().min(1),
  /** Geprüfter Satz (G-6): jede Zahl steht in `facts`, sonst die Vorlage ohne Zahl */
  sentence: z.string().min(1),
  facts: z.array(sentenceFactSchema),
  objectType: z.string(),
  objectId: z.uuid().nullable(),
  relationshipId: z.uuid().nullable(),
  /** Name des Gegenübers aus Sicht der Person; null ohne Beziehung */
  counterpart: z.string().nullable(),
  dueDate: z.iso.date().nullable(),
  /** Ort der Erledigung; die Fokus-Mappe kommt mit K1-e */
  href: z.string().nullable(),
  score: z.number().int().min(0),
});
export type FocusTopic = z.infer<typeof focusTopicSchema>;

export const todaySchema = z.object({
  today: z.iso.date(),
  /** Genau eine Karte „Als Nächstes“: das offene Fokus-Thema mit der höchsten Punktzahl */
  next: focusTopicSchema.nullable(),
  /** Die übrigen sichtbaren Fokus-Themen, mit `next` zusammen höchstens drei */
  more: z.array(focusTopicSchema).max(maxVisibleFocus - 1),
  /** Alle offenen Fokus-Themen; die Zahl an „Heute“ */
  openFocus: z.number().int().min(0),
  /** Kurz prüfen: offene Entwürfe und geschätzte Minuten */
  review: z.object({ count: z.number().int().min(0), minutes: z.number().int().min(0) }),
  /** Erledigt im Hintergrund, heute nach der Uhr des Mandanten */
  done: z.object({ count: z.number().int().min(0) }),
  /** NAV-10: Zeile „Im Hintergrund“ der Seitenleiste; der jüngste laufende Lauf der Person */
  background: z
    .object({ runId: z.uuid(), task: z.string(), counterpart: z.string().nullable() })
    .nullable(),
});
export type Today = z.infer<typeof todaySchema>;

export const snoozeResultSchema = z.object({ snoozedUntil: z.iso.datetime({ offset: true }) });

// Punktzahl = Wirkung × Dringlichkeit × Segmentgewicht (HE-01 Dienst 1, E-K0-17).

export const severityImpact = { low: 1, medium: 2, high: 3 } as const;
export type ImpactSeverity = keyof typeof severityImpact;

/** Wirkung in Euro: unter 100.000 € 1, unter 1 Mio. € 2, unter 10 Mio. € 3, darüber 4 */
export function euroImpact(cents: number): number {
  const euros = cents / 100;
  if (euros < 100_000) return 1;
  if (euros < 1_000_000) return 2;
  if (euros < 10_000_000) return 3;
  return 4;
}

/** Wirkung aus Euro (Spend der Beziehung) oder Schwere; mit beiden zählt die höhere, ohne beide 1 */
export function impactOf(input: {
  cents?: number | null | undefined;
  severity?: ImpactSeverity | null | undefined;
}): number {
  return Math.max(
    input.cents ? euroImpact(input.cents) : 1,
    input.severity ? severityImpact[input.severity] : 1,
  );
}

/** Dringlichkeit nach Tagen bis zur Frist: überfällig 4, heute 3, in sieben Tagen 2, sonst 1 */
export function urgencyOf(dueDate: string | null, today: string): number {
  if (!dueDate) return 1;
  const overdue = daysBetween(dueDate, today);
  if (overdue > 0) return 4;
  if (overdue === 0) return 3;
  return overdue >= -7 ? 2 : 1;
}

/** Punktzahl als ganze Zahl; das Gewicht hat zwei Nachkommastellen */
export function triageScore(impact: number, urgency: number, weight: number): number {
  return Math.round(impact * urgency * weight * 100);
}
