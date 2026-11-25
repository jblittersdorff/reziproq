import { z } from 'zod';
import { daysBetween, endOfWeek, waitingItemSchema } from './my-day.js';
import { sentenceFactSchema } from './sentence.js';
import { type DueItem, dueItemSchema } from './start.js';

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

/**
 * Art eines Fokus-Themas für Chip, Unterzeile und Filter „Art“ der Ansicht Alles (K1-e, Inventar
 * T1-I03: Wert, Freigabe, Unterschrift, Bewertung, Feedback). Zusage und Aufgabe nach NAV-10
 * (Maßnahme heißt Zusage, intern Aufgabe).
 */
export const focusArts = [
  'wert',
  'freigabe',
  'unterschrift',
  'bewertung',
  'feedback',
  'zusage',
  'aufgabe',
  'gespraech',
  'hinweis',
  'entscheidung',
] as const;
export type FocusArt = (typeof focusArts)[number];

const dueArts: Record<DueItem['kind'], FocusArt> = {
  rating: 'bewertung',
  cycle: 'bewertung',
  overall_segment_check: 'bewertung',
  contribution: 'aufgabe',
  action: 'aufgabe',
  approval: 'freigabe',
  review: 'freigabe',
  member_review: 'freigabe',
  agent_approval: 'freigabe',
  category_approval: 'freigabe',
  commitment: 'zusage',
  milestone: 'zusage',
  signature: 'unterschrift',
  validation: 'wert',
  mention: 'gespraech',
  feedback: 'feedback',
  strategy: 'aufgabe',
  view_assignment: 'aufgabe',
  category_review: 'aufgabe',
  category_conflict: 'entscheidung',
  ai_budget: 'aufgabe',
  connection_renew: 'aufgabe',
  hint_rule_review: 'hinweis',
  hint: 'hinweis',
};

/** Art aus der Frist des Moduls; ohne Frist aus der Art des Fokus-Themas */
export function artOf(topic: {
  kind: FocusTopicKind;
  objectType: string;
  item: DueItem | null;
}): FocusArt {
  if (topic.item) return dueArts[topic.item.kind];
  if (topic.objectType === 'hint') return 'hinweis';
  if (topic.kind === 'approval') return 'freigabe';
  if (topic.kind === 'conversation') return 'gespraech';
  // Zusage der eigenen Seite aus dem Protokoll (E-K0-27)
  if (topic.objectType === 'meeting') return 'zusage';
  return 'entscheidung';
}

/** Filter „Frist“ der Ansicht Alles (Inventar T1-I02: Überfällig, Heute, Diese Woche, Später) */
export const dueBuckets = ['ueberfaellig', 'heute', 'woche', 'spaeter', 'ohne'] as const;
export type DueBucket = (typeof dueBuckets)[number];

export function dueBucketOf(dueDate: string | null, today: string): DueBucket {
  if (!dueDate) return 'ohne';
  if (dueDate < today) return 'ueberfaellig';
  if (dueDate === today) return 'heute';
  return dueDate <= endOfWeek(today) ? 'woche' : 'spaeter';
}

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
  /** K1-e: Frist oder Freigabe des Moduls, für Titel und Knopf je Art; null bei Hinweis und Entwurf */
  item: dueItemSchema.nullable(),
  art: z.enum(focusArts),
  /** Schwere eines Hinweises (Filter „Schwere“) */
  severity: z.enum(['low', 'medium', 'high']).nullable(),
  /** Hauptwarengruppe der Beziehung (Filter „Warengruppe“) */
  materialGroup: z.string().nullable(),
});
export type FocusTopic = z.infer<typeof focusTopicSchema>;

/** Kurz prüfen auf Heute: ein offener Entwurf von Reziproq je Zeile */
export const todayDraftSchema = z.object({
  /** Fokus-Thema (Stufe review) */
  id: z.uuid(),
  title: z.string().min(1),
  counterpart: z.string().nullable(),
  relationshipId: z.uuid().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  href: z.string().nullable(),
});
export type TodayDraft = z.infer<typeof todayDraftSchema>;

/**
 * „Diese Woche“ (E-K1-4): höchstens drei datierte Einträge nach heute bis Sonntag. Eigene Fristen
 * mit Datumskreis in Tinte, Einträge, bei denen das Gegenüber am Zug ist, in Petrol.
 */
export const weekEntrySchema = z.discriminatedUnion('turn', [
  z.object({ turn: z.literal('own'), date: z.iso.date(), topic: focusTopicSchema }),
  z.object({ turn: z.literal('counterpart'), date: z.iso.date(), waiting: waitingItemSchema }),
]);
export type WeekEntry = z.infer<typeof weekEntrySchema>;

/** Höchstens so viele Einträge zeigt „Diese Woche“ (E-K1-4) */
export const maxWeekEntries = 3;
/** Höchstens so viele Zeilen zeigt „Wartet auf andere“ auf Heute; alle stehen in Alles */
export const maxWaitingRows = 2;

/** Woher die Themen in „Das Wichtigste“ kommen; die Quellen-Chips der Karte */
export const summarySources = [
  'hinweise',
  'zusagen',
  'termine',
  'freigaben',
  'bewertungen',
  'feedback',
  'kommentare',
  'warengruppen',
  'entwuerfe',
  'erledigt',
] as const;
export type SummarySource = (typeof summarySources)[number];

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

/**
 * Seite Heute, Ansicht Fokus (K1-e, Vorlage Main): dazu „Das Wichtigste“, die Zeilen von Kurz
 * prüfen, Erledigt seit gestern 18:00, „Diese Woche“, „Wartet auf andere“ und die Zahlen für „Alles
 * anzeigen“. Die Seitenleiste liest weiter nur `todaySchema`.
 */
export const todayPageSchema = todaySchema.extend({
  /** „Zusammengefasst von Reziproq“: ein belegter Satz (G-6) mit Quellen-Chips */
  summary: z.object({
    sentence: z.string().min(1),
    facts: z.array(sentenceFactSchema),
    sources: z.array(z.enum(summarySources)),
  }),
  drafts: z.array(todayDraftSchema),
  /** Erledigt im Hintergrund seit gestern 18:00, je Aufgabe von Reziproq gezählt */
  done: z.object({
    since: z.iso.datetime({ offset: true }),
    count: z.number().int().min(0),
    tasks: z.array(z.object({ task: z.string(), count: z.number().int().positive() })),
  }),
  week: z.array(weekEntrySchema).max(maxWeekEntries),
  waiting: z.array(waitingItemSchema).max(maxWaitingRows),
  waitingTotal: z.number().int().min(0),
  /** Für „Alles anzeigen“: für dich, bei anderen, weitere Hinweise, offene Zusagen und Aufgaben */
  counts: z.object({
    forYou: z.number().int().min(0),
    others: z.number().int().min(0),
    hints: z.number().int().min(0),
    commitments: z.number().int().min(0),
  }),
});
export type TodayPage = z.infer<typeof todayPageSchema>;

/** Ansicht Alles, Gruppe „Für dich“: jedes offene Fokus-Thema mit Platz in der Triage */
export const allTopicSchema = focusTopicSchema.extend({
  /** Platz nach Punktzahl, 1 ist „Als Nächstes“ */
  rank: z.number().int().positive(),
  /** Mit „Morgen erinnern“ bis zum nächsten Morgen zurückgestellt */
  snoozed: z.boolean(),
});
export type AllTopic = z.infer<typeof allTopicSchema>;

/** Ansicht Alles, Gruppe „Bei anderen“ */
export const allWaitingSchema = waitingItemSchema.extend({
  relationshipId: z.uuid(),
  materialGroup: z.string().nullable(),
  /** Dasselbe Objekt steht als Fokus-Thema der Person in „Für dich“ */
  inFocus: z.boolean(),
});
export type AllWaiting = z.infer<typeof allWaitingSchema>;

/** Ansicht Alles, Gruppe „Hinweise“: offene Hinweise, über die andere entscheiden */
export const allHintSchema = z.object({
  id: z.uuid(),
  title: z.string().nullable(),
  ruleKey: z.string(),
  supplier: z.string().nullable(),
  relationshipId: z.uuid().nullable(),
  severity: z.enum(['low', 'medium', 'high']),
  materialGroup: z.string().nullable(),
  openSince: z.iso.datetime({ offset: true }),
  suggestedAction: z.string().nullable(),
  href: z.string().min(1),
});
export type AllHint = z.infer<typeof allHintSchema>;

/** Ansicht Alles, Gruppe „Zuordnen“: nicht zugeordneter Eingang (E-K0-26) */
export const allAssignSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['meeting', 'mail']),
  subject: z.string(),
  startsAt: z.iso.datetime({ offset: true }),
  suggestionKind: z.enum(['supplier', 'several', 'event', 'none']),
  suggestions: z.array(z.object({ relationshipId: z.uuid(), name: z.string() })),
  href: z.string().min(1),
  /** Steht als Entwurf in Kurz prüfen (K1-e.2) */
  inReview: z.boolean(),
});
export type AllAssign = z.infer<typeof allAssignSchema>;

export const todayAllSchema = z.object({
  today: z.iso.date(),
  forYou: z.array(allTopicSchema),
  /** Entwürfe in Kurz prüfen: Zeilen wie auf Heute, dazu die Minuten */
  drafts: z.object({
    rows: z.array(todayDraftSchema),
    minutes: z.number().int().min(0),
  }),
  others: z.array(allWaitingSchema),
  hints: z.array(allHintSchema),
  assign: z.array(allAssignSchema),
  /** Zusagen und Aufgaben beider Seiten in den Beziehungen der Person, je Beziehung in der Akte */
  commitments: z.object({
    open: z.number().int().min(0),
    relationships: z.number().int().min(0),
    next: z
      .object({ title: z.string(), counterpart: z.string(), dueDate: z.iso.date() })
      .nullable(),
  }),
  /** Erledigt im Hintergrund seit gestern 18:00 */
  doneCount: z.number().int().min(0),
  /** Auswahl für die Filter Beziehung und Warengruppe, aus den Zeilen */
  relationships: z.array(z.object({ id: z.uuid(), name: z.string() })),
  materialGroups: z.array(z.string()),
});
export type TodayAll = z.infer<typeof todayAllSchema>;

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
