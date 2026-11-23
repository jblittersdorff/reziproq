import { z } from 'zod';
import { meetingTypes } from './meetings.js';

// IN-03 Termine aus Outlook und Google: Neu eingegangen in Mein Tag, Outlook-Add-in.

export const inboundSources = ['outlook_addin', 'inbound_mail', 'calendar_sync'] as const;
export const inboundStatuses = [
  'auto_assigned',
  'needs_review',
  'assigned',
  'ignored',
  'rejected',
] as const;

export const inboundItemViewSchema = z.object({
  id: z.uuid(),
  source: z.enum(inboundSources),
  receivedAt: z.iso.datetime(),
  subject: z.string(),
  startsAt: z.iso.datetime(),
  /** Wer eingeladen hat (Organisator) */
  organizer: z.string().nullable(),
  attendees: z.number().int(),
  suggestionKind: z.enum(['supplier', 'several', 'event', 'none']),
  suggestions: z.array(z.object({ relationshipId: z.uuid(), name: z.string() })),
  suggestionReason: z.string().nullable(),
  suggestedType: z.enum(meetingTypes),
  status: z.enum(inboundStatuses),
  objectType: z.enum(['meeting', 'event']).nullable(),
  /** Zugeordnete Lieferanten mit Termin */
  assigned: z.array(z.object({ relationshipId: z.uuid(), name: z.string(), meetingId: z.uuid() })),
});
export type InboundItemView = z.infer<typeof inboundItemViewSchema>;

export const inboxSchema = z.object({
  open: z.array(inboundItemViewSchema),
  /** Heute selbst zugeordnet (automatisch) */
  today: z.array(inboundItemViewSchema),
  /** Lieferanten, die die Person zuordnen darf, für „Anderer Lieferant“ */
  suppliers: z.array(z.object({ relationshipId: z.uuid(), name: z.string() })),
  /** true, sobald eine Anbindung für Termine aktiv ist */
  active: z.boolean(),
});
export type Inbox = z.infer<typeof inboxSchema>;

export const decideInboundSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('assign'),
    relationshipIds: z.array(z.uuid()).min(1).max(5),
    type: z.enum(meetingTypes),
  }),
  z.object({ action: z.literal('event') }),
  z.object({ action: z.literal('ignore') }),
]);
export type DecideInbound = z.infer<typeof decideInboundSchema>;

/** Outlook-Add-in: erkannter Lieferant zu den Teilnehmern des Termins */
export const addinDetectRequestSchema = z.object({
  attendees: z.array(z.email()).max(200),
  subject: z.string().max(500).default(''),
});
export const addinDetectSchema = z.object({
  supplier: z.object({ relationshipId: z.uuid(), name: z.string() }).nullable(),
  candidates: z.array(z.object({ relationshipId: z.uuid(), name: z.string() })),
  reason: z.string().nullable(),
  suggestedType: z.enum(meetingTypes),
});
export type AddinDetect = z.infer<typeof addinDetectSchema>;

export const addinRegisterSchema = z
  .object({
    organizerEmail: z.email(),
    subject: z.string().trim().min(1).max(500),
    startAt: z.iso.datetime({ offset: true }),
    relationshipId: z.uuid(),
    type: z.enum(meetingTypes),
    briefOptIn: z.boolean().default(true),
    transcriptOptIn: z.boolean().default(false),
    insertAgenda: z.boolean().default(false),
    eventId: z.string().max(500).optional(),
  })
  .strict();
export type AddinRegister = z.input<typeof addinRegisterSchema>;

export const addinRegisteredSchema = z.object({
  registrationId: z.uuid(),
  /** Diese Adresse setzt das Add-in als Teilnehmer */
  inboundAddress: z.string().nullable(),
  /** Bei „Transkript übernehmen“: Hinweis für den Text der Einladung */
  transcriptNotice: z.string().nullable(),
});
export type AddinRegistered = z.infer<typeof addinRegisteredSchema>;

/** Einstellungen der Eingangsadresse: zugelassene Absender-Domains */
export const inboundMailSettingsSchema = z
  .object({
    allowedDomains: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/),
      )
      .max(20),
  })
  .strict();
export type InboundMailSettings = z.infer<typeof inboundMailSettingsSchema>;
