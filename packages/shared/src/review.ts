import { z } from 'zod';

// HE-01 Kurz prüfen (K1-e.2): ein Entwurf von Reziproq nach dem anderen, mit Kontext, Text und
// Quellen; Übernehmen, Anpassen, Verwerfen mit Grund, Später. Nie in Kurz prüfen: Zusagen im Namen
// des Käufers, Freigaben, Wertbestätigungen und alles, was an das Gegenüber geht (die kommen als
// Fokus-Thema).

/**
 * Was „Anpassen“ heißt: den Text ändern und dann übernehmen, nur den Titel ändern (Ergebnis aus
 * einem Termin) oder am Ort des Entwurfs weiterarbeiten (Teile mit Aufbau, z. B. ein Briefing).
 */
export const reviewAdjustKinds = ['text', 'title', 'place'] as const;
export type ReviewAdjust = (typeof reviewAdjustKinds)[number];

/** Herkunft eines Eintrags in Kurz prüfen: ein Entwurf (ai_draft) oder ein Eingang zum Zuordnen */
export const reviewSources = ['ai_draft', 'inbound'] as const;

export const reviewItemSchema = z.object({
  /** Fokus-Thema der Stufe review */
  id: z.uuid(),
  source: z.enum(reviewSources),
  /** Art des Entwurfs (z. B. plan_summary, brief_goals) oder „inbound“ */
  kind: z.string().min(1),
  objectType: z.string(),
  /** Name des Objekts, z. B. Titel des Termins */
  subject: z.string().nullable(),
  counterpart: z.string().nullable(),
  relationshipId: z.uuid().nullable(),
  title: z.string().min(1),
  /** Aussagen des Entwurfs, je eine Zeile */
  lines: z.array(z.string()),
  /** Titel der Quellen, ohne Doppel */
  sources: z.array(z.string()),
  createdAt: z.iso.datetime({ offset: true }),
  reviewSeconds: z.number().int().min(0),
  adjust: z.enum(reviewAdjustKinds),
  /** Text zum Anpassen (Inhalt oder Titel); null, wenn am Ort angepasst wird */
  text: z.string().nullable(),
  /** Ort des Entwurfs, z. B. der Termin */
  href: z.string().nullable(),
  /** Übernehmen geht nur am Ort, etwa wenn ein Termin mehrere Lieferanten vorschlägt */
  canAccept: z.boolean(),
  /** Eingang zum Zuordnen (IN-03): Termin, Vorschlag und Begründung; sonst null */
  inbound: z
    .object({
      /** Termin oder weitergeleitete Mail (IN-04); eine Mail gehört zu genau einem Lieferanten */
      kind: z.enum(['meeting', 'mail']),
      /** Absender einer Mail */
      from: z.string().nullable(),
      startsAt: z.iso.datetime({ offset: true }),
      suggestionKind: z.enum(['supplier', 'several', 'event', 'none']),
      suggestions: z.array(z.object({ relationshipId: z.uuid(), name: z.string() })),
      suggestedType: z.string(),
      reason: z.string().nullable(),
      /** Zur Wahl beim Zuordnen: erst die Vorschläge, dann alle übrigen Beziehungen der Person */
      options: z.array(z.object({ relationshipId: z.uuid(), name: z.string() })),
    })
    .nullable(),
});
export type ReviewItem = z.infer<typeof reviewItemSchema>;

export const reviewStackSchema = z.object({
  items: z.array(reviewItemSchema),
  minutes: z.number().int().min(0),
});
export type ReviewStack = z.infer<typeof reviewStackSchema>;

/** Übernehmen (optional mit angepasstem Text), Verwerfen mit Grund oder Später */
export const reviewDecisionSchema = z.discriminatedUnion('decision', [
  z
    .object({
      decision: z.literal('uebernehmen'),
      text: z.string().trim().min(1).max(4000).optional(),
      /** Zuordnen (Eingang): gewählte Beziehungen statt des Vorschlags */
      relationshipIds: z.array(z.uuid()).min(1).max(5).optional(),
      /** Zuordnen (Eingang): als Ereignis ohne Lieferant speichern */
      asEvent: z.literal(true).optional(),
    })
    .strict(),
  z
    .object({ decision: z.literal('verwerfen'), reason: z.string().trim().min(3).max(1000) })
    .strict(),
  z.object({ decision: z.literal('spaeter') }).strict(),
]);
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;

export const reviewResultSchema = z.object({
  state: z.enum(['accepted', 'discarded', 'snoozed']),
});
export type ReviewResult = z.infer<typeof reviewResultSchema>;
