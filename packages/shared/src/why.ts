import { z } from 'zod';
import { focusTopicSchema } from './today.js';

// HE-01 Warum (K1-e.4): Herleitung zu einem Hinweis, einem Lauf von Reziproq oder einem Fokus-Thema.
// Jede Zahl kommt aus Daten (G-6): Rechenweg aus den Fakten des Satzes, Kosten und Schritte aus dem
// Lauf. Die Wert-Engine (Rechenweg in Euro, Schätzung für das Gegenüber) kommt mit K4-a.

export const whySourceSchema = z.object({
  title: z.string().min(1),
  href: z.string().nullable(),
});

export const whyRunSchema = z.object({
  id: z.uuid(),
  task: z.string(),
  taskName: z.string(),
  status: z.string(),
  trigger: z.enum(['manual', 'schedule', 'event']),
  at: z.iso.datetime({ offset: true }),
  steps: z.number().int().min(0),
  /** Kosten in Mikrocent (1 € = 100.000.000) */
  costMicrocents: z.number().int().min(0),
  /** Werkzeuge der Aufgabe: was Reziproq dabei durfte */
  tools: z.array(z.string()),
  counterpart: z.string().nullable(),
  relationshipId: z.uuid().nullable(),
  undone: z.boolean(),
});

export const whyViewSchema = z.discriminatedUnion('kind', [
  /** Warum zum Hinweis: die Seite liest den Hinweis selbst (Beleg, Begründung, Knöpfe) */
  z.object({ kind: z.literal('hint'), hintId: z.uuid() }),
  z.object({
    kind: z.literal('run'),
    run: whyRunSchema,
    steps: z.array(
      z.object({ seq: z.number().int(), title: z.string(), kind: z.string(), status: z.string() }),
    ),
    /** Was Reziproq formuliert hat: Aussagen der Entwürfe des Laufs mit ihren Quellen */
    statements: z.array(z.object({ text: z.string(), sources: z.array(z.string()) })),
    sources: z.array(whySourceSchema),
  }),
  z.object({
    kind: z.literal('topic'),
    topic: focusTopicSchema,
    /** Platz unter den offenen Fokus-Themen; null, wenn erledigt oder zurückgestellt */
    rank: z.number().int().positive().nullable(),
    sources: z.array(whySourceSchema),
  }),
]);
export type WhyView = z.infer<typeof whyViewSchema>;

/**
 * Fokus-Mappe (HE-01, K1-e.4): ein Fokus-Thema als Entscheidung in fünf Teilen. Optionen mit Wert
 * für beide Seiten kommen mit der Wert-Engine (K4-a); bis dahin keine Zahl ohne Beleg.
 */
export const focusMapSchema = z.object({
  topic: focusTopicSchema,
  state: z.enum(['open', 'decided', 'snoozed', 'dismissed']),
  /** Wann Reziproq das Thema erkannt hat */
  since: z.iso.datetime({ offset: true }),
  rank: z.number().int().positive().nullable(),
  /** Hinweis hinter dem Thema, wenn es einer ist */
  hintId: z.uuid().nullable(),
  /** Höchstens eine Empfehlung, nur mit Grundlage (z. B. der Vorschlag eines Hinweises) */
  recommendation: z.string().nullable(),
  sources: z.array(whySourceSchema),
});
export type FocusMap = z.infer<typeof focusMapSchema>;
