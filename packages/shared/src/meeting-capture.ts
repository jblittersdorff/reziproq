import { z } from 'zod';
import { aiDraftSchema } from './ai-drafts.js';

// KI-17 Ergebnisse nach dem Termin: Aus Notizen entstehen Entwürfe (KI-03) für Zusagen,
// Maßnahmen, Entscheidungen, offene Fragen, Änderungen an bestehenden Zusagen und den Stand der
// Ziele aus dem Briefing (KI-07). Im Zweifel ist ein Punkt intern; das Protokoll enthält nur
// geteilte Punkte. Der Lieferant sieht nichts davon, bis der SRO das Protokoll teilt.

// IN-05: transcript, wenn das Transkript eines Termins ausgewertet wird
export const captureSources = ['typed', 'pasted', 'file', 'transcript'] as const;
export const captureKinds = [
  'commitment',
  'action',
  'decision',
  'open_question',
  'commitment_change',
  'goal_check',
] as const;
export type CaptureKind = (typeof captureKinds)[number];

/** Entwurfsart in ai_draft je Art */
export const captureDraftKinds = {
  commitment: 'capture_commitment',
  action: 'capture_action',
  decision: 'capture_decision',
  open_question: 'capture_question',
  commitment_change: 'capture_commitment_change',
  goal_check: 'capture_goal_check',
} as const satisfies Record<CaptureKind, string>;

export const captureVisibilities = ['shared', 'internal'] as const;
export type CaptureVisibility = (typeof captureVisibilities)[number];

/** Höchstens so viele Zeichen Notizen je Auswertung (etwa 2 MB Text) */
export const maxCaptureChars = 200_000;

export const captureItemSchema = z.object({
  kind: z.enum(captureKinds),
  /** Titel oder Text des Punkts */
  title: z.string().trim().min(1).max(400),
  visibility: z.enum(captureVisibilities),
  /** Satz aus den Notizen, wörtlich */
  quote: z.string().max(1000),
  /** Zusagen: wer zusagt */
  side: z.enum(['buyer', 'supplier']).nullable(),
  /** Nur aus der Teilnehmerliste; sonst null mit Hinweis „Verantwortlich unklar“ */
  owner: z.string().nullable(),
  ownerUnclear: z.boolean(),
  /** Nach dem Termin, höchstens 365 Tage danach; sonst null mit Hinweis „Datum unklar“ */
  dueOn: z.iso.date().nullable(),
  dateUnclear: z.boolean(),
  /** Offene Fragen: an wen */
  addressee: z.string().nullable(),
  /** Änderung an einer bestehenden Zusage */
  commitmentId: z.uuid().nullable(),
  commitmentTitle: z.string().nullable(),
  proposal: z.enum(['kept', 'missed', 'new_date']).nullable(),
  /** Stand eines Ziels aus dem Briefing; immer intern */
  goalKey: z.string().nullable(),
  goalStatus: z.enum(['achieved', 'partly', 'not_achieved']).nullable(),
  reason: z.string().nullable(),
  /** Nach dem Übernehmen: das angelegte Objekt */
  createdId: z.string().nullable(),
});
export type CaptureItem = z.infer<typeof captureItemSchema>;

export const captureDraftSchema = aiDraftSchema.extend({ item: captureItemSchema });
export type CaptureDraft = z.infer<typeof captureDraftSchema>;

export const meetingCaptureSchema = z.object({
  /** Nach dem Start des Termins; vorher gibt es nichts zu erfassen */
  open: z.boolean(),
  /** Notizen erfassen und auswerten: SRO, Admin, Teilnehmer der Käuferseite */
  canCapture: z.boolean(),
  /** Übernehmen, ändern, verwerfen, Protokoll teilen: nur SRO und Admin */
  canDecide: z.boolean(),
  notes: z
    .object({
      id: z.uuid(),
      source: z.enum(captureSources),
      text: z.string(),
      createdAt: z.iso.datetime({ offset: true }),
      createdByName: z.string(),
    })
    .nullable(),
  drafts: z.array(captureDraftSchema),
  /** Protokoll, wie der Lieferant es sehen wird: nur geteilte Punkte */
  protocol: z.object({
    text: z.string(),
    sharedCount: z.number().int(),
    internalCount: z.number().int(),
    /** Schon geteilt: Stand im Termin */
    sharedAt: z.iso.datetime({ offset: true }).nullable(),
  }),
  participants: z.array(z.object({ name: z.string(), side: z.enum(['buyer', 'supplier']) })),
  /** Bei „Alle übernehmen“: Entwürfe, die nicht übernommen werden konnten, mit Grund */
  failed: z.array(z.object({ id: z.uuid(), code: z.string() })).optional(),
});
export type MeetingCapture = z.infer<typeof meetingCaptureSchema>;

export const saveCaptureSchema = z
  .object({
    source: z.enum(captureSources),
    text: z.string().trim().min(1).max(maxCaptureChars),
  })
  .strict();
export type SaveCapture = z.infer<typeof saveCaptureSchema>;

export const editCaptureItemSchema = z
  .object({
    title: z.string().trim().min(1).max(400).optional(),
    visibility: z.enum(captureVisibilities).optional(),
    owner: z.string().trim().max(120).nullable().optional(),
    dueOn: z.iso.date().nullable().optional(),
  })
  .strict();
export type EditCaptureItem = z.infer<typeof editCaptureItemSchema>;

export const acceptCaptureSchema = z.object({ ids: z.array(z.uuid()).min(1).max(50) }).strict();
