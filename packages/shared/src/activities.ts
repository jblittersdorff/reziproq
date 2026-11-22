import { z } from 'zod';

// NAV-10: Aktivitäten eines Lieferanten (früher Notizraum). Eine Sicht über Termine, Notizen,
// Hinweise (FS-01) und Entwürfe von Reziproq; Mails, Transkripte und Dateien kommen mit den
// Anbindungen. Nur die Käuferseite sieht sie, private Notizen nur ihre Autorin.

export const noteVisibilities = ['team', 'private'] as const;
export const noteKinds = ['note', 'call'] as const;
export const activityKinds = ['meeting', 'note', 'call', 'hint', 'agent'] as const;
export type ActivityKind = (typeof activityKinds)[number];

/** Filter der Aktivitäten; „Alles“ ist der leere Filter. */
export const activityFilters = ['termine', 'notizen', 'reziproq'] as const;
export type ActivityFilter = (typeof activityFilters)[number];

export const activityItemSchema = z.object({
  id: z.string(),
  kind: z.enum(activityKinds),
  occurredAt: z.string(),
  // Person mit Namen oder Reziproq als Akteur
  actor: z.discriminatedUnion('type', [
    z.object({ type: z.literal('person'), name: z.string() }),
    z.object({ type: z.literal('reziproq') }),
  ]),
  // Text von Notiz oder Termin; bei Hinweisen und Entwürfen leer, dann gilt code
  title: z.string(),
  // Regel des Hinweises (FS-01) oder Art des Entwurfs; die Oberfläche übersetzt ihn
  code: z.string().nullable(),
  meta: z.string().nullable(),
  // Verweis auf das Objekt, z. B. den Termin oder die Bewertungsrunde
  href: z.string().nullable(),
  visibility: z.enum(['team', 'private']),
  pinned: z.boolean(),
  // Die angemeldete Person hat den Eintrag geschrieben und darf ihn ändern
  mine: z.boolean(),
});

export const activityFeedSchema = z.object({
  canWrite: z.boolean(),
  items: z.array(activityItemSchema),
});

export const noteRequestSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  visibility: z.enum(noteVisibilities).default('team'),
  kind: z.enum(noteKinds).default('note'),
});

export const notePatchSchema = z.object({
  text: z.string().trim().min(1).max(5000).optional(),
  pinned: z.boolean().optional(),
});

export type ActivityItem = z.infer<typeof activityItemSchema>;
export type ActivityFeed = z.infer<typeof activityFeedSchema>;
export type NoteRequest = z.input<typeof noteRequestSchema>;
export type NotePatch = z.infer<typeof notePatchSchema>;
