import { z } from 'zod';
import type { OrgModuleKey, OrgModules } from './modules.js';
import { type DueItem, dueItemSchema, type dueKinds } from './start.js';

// NAV-10 1.1, UX-20 Phase 2: „Als Nächstes“ (next_action) und die Terminschiene (timeline_item).
// Beide sind Funktionen im Code mit gemeinsamem Schema, keine Datenbank-Sicht (F-UX-04).

type DueKind = (typeof dueKinds)[number];

/**
 * Zeitbedarf je Art in Minuten, fest im Code (F-UX-05). Ohne Wert zeigt die Kurzzeile keine
 * Angabe.
 */
export const dueMinutes: Partial<Record<DueKind, number>> = {
  rating: 10,
  cycle: 10,
  contribution: 10,
  action: 5,
  approval: 5,
  commitment: 5,
  milestone: 5,
  review: 10,
  signature: 2,
  validation: 2,
  mention: 2,
  feedback: 5,
  strategy: 15,
  ai_budget: 2,
  hint_rule_review: 5,
  connection_renew: 2,
  member_review: 2,
  agent_approval: 5,
  view_assignment: 10,
  category_review: 20,
  category_approval: 5,
  category_conflict: 10,
  overall_segment_check: 5,
  hint: 5,
};

const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const relationshipPattern = new RegExp(`^/(?:lieferanten|kunden)/(${uuidPattern})(?:[/?#]|$)`);
const categoryPattern = new RegExp(`^/warengruppen/(${uuidPattern})(?:[/?#]|$)`);

/** Beziehung, zu der eine Aufgabe gehört, aus ihrem Ziel; null bei Aufgaben ohne Lieferant */
export function relationshipOfHref(href: string): string | null {
  return relationshipPattern.exec(href)?.[1] ?? null;
}

/** Warengruppe, zu der eine Aufgabe gehört, aus ihrem Ziel */
export function categoryOfHref(href: string): string | null {
  return categoryPattern.exec(href)?.[1] ?? null;
}

/** Ganze Tage zwischen zwei Daten (JJJJ-MM-TT), positiv, wenn `date` vor `today` liegt */
export function daysBetween(date: string, today: string): number {
  return Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000,
  );
}

/**
 * Reihenfolge nach NAV-10: überfällig vor fällig heute vor später; innerhalb dessen die Wirkung
 * (Spend der Beziehung oder Warengruppe) absteigend, dann die Frist. `weight` liefert die Wirkung
 * je Aufgabe, ohne Wert 0.
 */
export function compareDue(
  today: string,
  weight: (item: DueItem) => number = () => 0,
): (a: DueItem, b: DueItem) => number {
  const tier = (item: DueItem) => (item.dueDate < today ? 0 : item.dueDate === today ? 1 : 2);
  return (a, b) =>
    tier(a) - tier(b) ||
    weight(b) - weight(a) ||
    a.dueDate.localeCompare(b.dueDate) ||
    a.id.localeCompare(b.id);
}

export const nextActionScopes = ['global', 'relationship', 'category', 'page'] as const;

/** Genau ein nächster Schritt je Ort; ohne Kandidat null, und die Seite zeigt keine Karte. */
export const nextActionSchema = z.object({
  scope: z.enum(nextActionScopes),
  item: dueItemSchema,
  /** Tage seit der Frist; 0 heute, negativ in der Zukunft */
  overdueDays: z.number().int(),
  minutes: z.number().int().positive().nullable(),
});
export type NextAction = z.infer<typeof nextActionSchema>;

/** Wählt den nächsten Schritt aus den Aufgaben der Person (NAV-10 „next_action“). */
export function pickNextAction(
  items: DueItem[],
  today: string,
  options: {
    scope?: NextAction['scope'];
    weight?: (item: DueItem) => number;
    /** nur Aufgaben dieses Orts, z. B. einer Beziehung */
    filter?: (item: DueItem) => boolean;
  } = {},
): NextAction | null {
  const candidates = options.filter ? items.filter(options.filter) : items;
  const [first] = [...candidates].sort(compareDue(today, options.weight));
  if (!first) return null;
  return {
    scope: options.scope ?? 'global',
    item: first,
    overdueDays: daysBetween(first.dueDate, today),
    minutes: dueMinutes[first.kind] ?? null,
  };
}

/** Letzter Tag der Woche (Sonntag) zu einem Datum, für „Diese Woche“ */
export function endOfWeek(today: string): string {
  const date = new Date(`${today}T00:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7; // Montag 0 … Sonntag 6
  date.setUTCDate(date.getUTCDate() + (6 - weekday));
  return date.toISOString().slice(0, 10);
}

// Terminschiene: Termine, Fristen, Freigaben, Zusagen und (nur mit Modul) Risikodaten.
export const timelineKinds = ['meeting', 'deadline', 'approval', 'commitment', 'risk'] as const;
export type TimelineKind = (typeof timelineKinds)[number];

export const timelineSources = [
  'meeting',
  'commitment',
  'round',
  'category_approval',
  'category_review',
  // Nur mit aktivem Modul (UX-20); in Release 1.1 aus und ohne Quelle.
  'claim',
  'risk',
  'contract',
] as const;
export type TimelineSource = (typeof timelineSources)[number];

/** Modul, an dem eine Quelle hängt; ohne Eintrag gehört sie zum Kern */
export const timelineSourceModule: Partial<Record<TimelineSource, OrgModuleKey>> = {
  claim: 'claims',
  risk: 'risk',
  contract: 'contract',
};

export const timelineItemSchema = z.object({
  id: z.string().min(1),
  date: z.iso.date(),
  kind: z.enum(timelineKinds),
  source: z.enum(timelineSources),
  /** Name des Objekts, z. B. Titel des Termins oder Name der Warengruppe */
  title: z.string(),
  /** Lieferant oder Warengruppe */
  counterpart: z.string().nullable(),
  /** Ort des Termins, verantwortliche Person usw. */
  detail: z.string().nullable(),
  /** Beginn bei Terminen */
  startsAt: z.iso.datetime({ offset: true }).nullable(),
  /** Stand, z. B. abgegebene Bewertungen einer Runde */
  progress: z.object({ done: z.number().int(), total: z.number().int() }).nullable(),
  href: z.string().min(1),
  relationshipId: z.uuid().nullable(),
  categoryId: z.uuid().nullable(),
});
export type TimelineItem = z.infer<typeof timelineItemSchema>;

export const timelineSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  items: z.array(timelineItemSchema),
});
export type Timeline = z.infer<typeof timelineSchema>;

/** Entfernt Einträge, deren Modul aus ist: keine Claims, keine Risiken, keine Vertragsfristen. */
export function withModules<T extends { source: TimelineSource; kind: TimelineKind }>(
  items: T[],
  modules: OrgModules,
): T[] {
  return items.filter((item) => {
    const module = timelineSourceModule[item.source];
    if (module && !modules[module]) return false;
    return item.kind !== 'risk' || modules.risk;
  });
}

/** Sortiert nach Datum (bei Terminen nach Beginn) und kürzt auf höchstens `limit` Einträge. */
export function sortTimeline<T extends { date: string; startsAt: string | null; id: string }>(
  items: T[],
  limit?: number,
): T[] {
  const sorted = [...items].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startsAt ?? '').localeCompare(b.startsAt ?? '') ||
      a.id.localeCompare(b.id),
  );
  return limit === undefined ? sorted : sorted.slice(0, limit);
}

// Mein Tag (NAV-10 1.1, Vorlage Main.dc.html)

/** Ein Entwurf von Reziproq zur Bestätigung, je Objekt zusammengefasst */
export const preparedDraftSchema = z.object({
  id: z.string().min(1),
  /** Art des ersten Entwurfs; Briefings fassen alle brief_* zusammen */
  kind: z.string(),
  objectType: z.string(),
  /** Titel des Objekts, falls bekannt (z. B. Titel des Termins) */
  subject: z.string().nullable(),
  counterpart: z.string().nullable(),
  count: z.number().int().positive(),
  createdAt: z.iso.datetime({ offset: true }),
  href: z.string().min(1),
});
export type PreparedDraft = z.infer<typeof preparedDraftSchema>;

/** Zusage, Beitrag oder Maßnahme einer anderen Person, auf die die eigene Seite wartet */
export const waitingItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['commitment', 'action', 'contribution']),
  title: z.string(),
  owner: z.string(),
  counterpart: z.string(),
  dueDate: z.iso.date(),
  href: z.string().min(1),
});
export type WaitingItem = z.infer<typeof waitingItemSchema>;

export const myDaySchema = z.object({
  today: z.iso.date(),
  next: nextActionSchema.nullable(),
  /** übrige Aufgaben mit Frist heute oder überfällig, ohne „Als Nächstes“ */
  todayItems: z.array(dueItemSchema),
  /** Aufgaben nach heute bis Sonntag */
  week: z.array(dueItemSchema),
  /** alle offenen Aufgaben der Person */
  total: z.number().int(),
  /** Aufgaben, die die Person heute erledigt hat (Quellen mit Erledigt-Zeitpunkt) */
  doneToday: z.number().int(),
  prepared: z.array(preparedDraftSchema).max(5),
  preparedTotal: z.number().int(),
  waiting: z.array(waitingItemSchema),
  waitingTotal: z.number().int(),
  /** Termine und Fristen der nächsten 14 Tage */
  timeline: z.array(timelineItemSchema),
  hints: z.object({ open: z.number().int(), high: z.number().int() }).nullable(),
});
export type MyDay = z.infer<typeof myDaySchema>;

/** Lieferanten, die die Person brauchen (F-UX-06), mit Grund; Grundlage für Liste und Übersicht */
export const needsYouSchema = z.object({
  items: z.array(
    z.object({
      relationshipId: z.uuid(),
      reason: z.enum(['due', 'hint', 'conflict', 'commitment']),
      title: z.string(),
    }),
  ),
});
export type NeedsYou = z.infer<typeof needsYouSchema>;
