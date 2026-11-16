import { z } from 'zod';

// QBR-01a: Termine mit Agenda, Teilnehmenden, Protokoll und Beschlüssen. Jede Seite ändert nur ihre
// eigenen Zeilen (PLT-04): den Termin selbst pflegt, wer ihn angelegt hat; Agendapunkte und
// Beschlüsse ergänzt jede Seite für sich. Interne Notizen sieht nur die eigene Organisation.

export const meetingTypes = [
  'quarterly_review',
  'strategy_dialogue',
  'jbp',
  'format',
  'other',
] as const;
export const meetingStatuses = ['planned', 'held', 'closed'] as const;
export const meetingSides = ['buyer', 'supplier'] as const;
export type MeetingType = (typeof meetingTypes)[number];
export type MeetingSide = (typeof meetingSides)[number];

const title = z.string().trim().min(1).max(200);

/** Agenda-Vorlage je Art, in der Sprache der Person, die den Termin anlegt. */
export const agendaTemplates: Record<MeetingType, { de: string[]; en: string[] }> = {
  quarterly_review: {
    de: [
      'Rückblick auf das Quartal',
      'Kennzahlen und Scorecard',
      'Offene Maßnahmen',
      'Ausblick und nächste Schritte',
    ],
    en: [
      'Review of the quarter',
      'Key figures and scorecard',
      'Open actions',
      'Outlook and next steps',
    ],
  },
  strategy_dialogue: {
    de: [
      'Strategische Prioritäten beider Seiten',
      'Stand der Partnerschaft',
      'Gemeinsame Ziele',
      'Vereinbarungen',
    ],
    en: [
      'Strategic priorities of both sides',
      'State of the partnership',
      'Joint goals',
      'Agreements',
    ],
  },
  // JBP-01: Reihenfolge wie jbpSections; Feedback und Spielregeln erscheinen live, nicht hier.
  jbp: {
    de: [
      'Geschäftsupdate Käufer',
      'Geschäftsupdate Lieferant',
      'Themen beider Seiten',
      'Initiativen und Roadmap',
      'Zusagen',
      'Scorecard',
    ],
    en: [
      'Business update buyer',
      'Business update supplier',
      'Topics of both sides',
      'Initiatives and roadmap',
      'Commitments',
      'Scorecard',
    ],
  },
  format: {
    de: ['Begrüßung und Ziel', 'Themen', 'Vereinbarungen und nächste Schritte'],
    en: ['Welcome and goal', 'Topics', 'Agreements and next steps'],
  },
  other: {
    de: ['Begrüßung und Ziel', 'Themen', 'Vereinbarungen und nächste Schritte'],
    en: ['Welcome and goal', 'Topics', 'Agreements and next steps'],
  },
};

export const meetingSummarySchema = z.object({
  id: z.uuid(),
  type: z.enum(meetingTypes),
  title: z.string(),
  startsAt: z.iso.datetime({ offset: true }),
  location: z.string().nullable(),
  status: z.enum(meetingStatuses),
  ownerSide: z.enum(meetingSides),
});

export const meetingListSchema = z.object({
  upcoming: z.array(meetingSummarySchema),
  past: z.array(meetingSummarySchema),
  canCreate: z.boolean(),
  /** Formate der Spielregeln, die diese Seite sieht (PLB-03, SEG-10) */
  formats: z.array(z.object({ id: z.uuid(), title: z.object({ de: z.string(), en: z.string() }) })),
});

const ownedRow = { id: z.uuid(), side: z.enum(meetingSides), own: z.boolean() };

/**
 * Live-Abschnitt eines Termins (QBR-01b): Stand aus seinem Ort, z. B. offene Maßnahmen (QBR-03).
 * Jede Quelle meldet sich mit ihrem Schlüssel; die Oberfläche kennt den Titel dazu.
 */
export const liveSectionSchema = z.object({
  key: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      /** Statusschlüssel der Quelle, z. B. open; die Oberfläche übersetzt ihn */
      status: z.string().nullable(),
      dueDate: z.iso.date().nullable().default(null),
      /** Zusatz, z. B. der letzte Ist-Wert einer Kennzahl mit Einheit (QBR-06) */
      detail: z.string().nullable().optional(),
    }),
  ),
});

/** Live-Abschnitte; nach dem Abschließen der eingefrorene Stand mit Zeitpunkt. */
export const meetingLiveSchema = z.object({
  sections: z.array(liveSectionSchema),
  frozenAt: z.iso.datetime({ offset: true }).nullable(),
});

export const meetingDetailSchema = z.object({
  meeting: meetingSummarySchema.extend({
    protocol: z.string().nullable(),
    createdByName: z.string(),
  }),
  participants: z.array(z.object({ ...ownedRow, name: z.string() })),
  agenda: z.array(z.object({ ...ownedRow, title: z.string(), position: z.number().int() })),
  decisions: z.array(z.object({ ...ownedRow, text: z.string(), position: z.number().int() })),
  /** Interne Notiz der eigenen Organisation; die andere Seite sieht sie nie */
  note: z.string().nullable(),
  /** Termin pflegen: eigene Seite hat ihn angelegt, und er ist nicht abgeschlossen */
  canEditMeeting: z.boolean(),
  /** Agendapunkte und Beschlüsse ergänzen, Notizen schreiben */
  canContribute: z.boolean(),
  live: meetingLiveSchema,
  /** Abschließen: die Seite, die den Termin angelegt hat, solange er offen ist (QBR-01b) */
  canClose: z.boolean(),
});

/** Nächster Termin für Start und den Kopf (QBR-01b, Termin-Quelle). */
export const nextMeetingSchema = z.object({
  id: z.uuid(),
  relationshipId: z.uuid(),
  /** Die andere Seite: Lieferant beim Käufer, Kunde beim Lieferanten */
  counterpart: z.string(),
  title: z.string(),
  startsAt: z.iso.datetime({ offset: true }),
  location: z.string().nullable(),
});

export const createMeetingSchema = z
  .object({
    type: z.enum(meetingTypes),
    ruleSetItemId: z.uuid().nullable(),
    title,
    startsAt: z.iso.datetime({ offset: true }),
    location: z.string().trim().max(300).nullable(),
    participants: z.array(z.string().trim().min(1).max(120)).max(30),
    locale: z.enum(['de', 'en']).default('de'),
  })
  .strict()
  .refine((value) => (value.type === 'format') === (value.ruleSetItemId !== null), {
    message: 'format_needs_item',
    path: ['ruleSetItemId'],
  });

export const updateMeetingSchema = z
  .object({
    title,
    startsAt: z.iso.datetime({ offset: true }),
    location: z.string().trim().max(300).nullable(),
    participants: z.array(z.string().trim().min(1).max(120)).max(30),
  })
  .strict();

/** Die eigenen Agendapunkte in Reihenfolge; die der anderen Seite bleiben unberührt. */
export const saveAgendaSchema = z.object({ items: z.array(title).max(30) }).strict();

/** Protokoll (nur die Seite, die den Termin angelegt hat) und die eigenen Beschlüsse. */
export const saveProtocolSchema = z
  .object({
    protocol: z.string().trim().max(20_000).nullable(),
    decisions: z.array(z.string().trim().min(1).max(1000)).max(50),
  })
  .strict();

export const saveMeetingNoteSchema = z.object({ text: z.string().trim().max(10_000) }).strict();

export type MeetingSummary = z.infer<typeof meetingSummarySchema>;
export type MeetingList = z.infer<typeof meetingListSchema>;
export type MeetingDetail = z.infer<typeof meetingDetailSchema>;
export type LiveSection = z.infer<typeof liveSectionSchema>;
export type NextMeeting = z.infer<typeof nextMeetingSchema>;
export type CreateMeeting = z.infer<typeof createMeetingSchema>;
export type UpdateMeeting = z.infer<typeof updateMeetingSchema>;
export type SaveAgenda = z.infer<typeof saveAgendaSchema>;
export type SaveProtocol = z.infer<typeof saveProtocolSchema>;
export type SaveMeetingNote = z.infer<typeof saveMeetingNoteSchema>;
