import { z } from 'zod';

// IN-05: Transkripte aus Teams, Meet oder Upload. Nur Text, nie Audio oder Video; nur mit
// bestätigter Betriebsvereinbarung und Opt-in je Termin. Der Lieferant sieht nie ein Transkript.

export const transcriptRetentionDays = [30, 90, 180] as const;
export const teamsTranscriptModes = ['meeting', 'org'] as const;
export const defaultInviteNotice =
  'Hinweis: Mit Zustimmung aller Teilnehmenden wird das Transkript dieses Termins in Reziproq übernommen.';

/** Upload: VTT, DOCX oder TXT bis 10 MB */
export const maxTranscriptUploadBytes = 10 * 1024 * 1024;

export const transcriptSettingsSchema = z.object({
  enabled: z.boolean(),
  worksAgreement: z
    .object({ confirmedAt: z.iso.date(), confirmedBy: z.string(), hasFile: z.boolean() })
    .nullable(),
  retentionDays: z.union([z.literal(30), z.literal(90), z.literal(180)]),
  teamsMode: z.enum(teamsTranscriptModes),
  inviteNotice: z.string(),
  canManage: z.boolean(),
});
export type TranscriptSettings = z.infer<typeof transcriptSettingsSchema>;

export const saveTranscriptSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    retentionDays: z.union([z.literal(30), z.literal(90), z.literal(180)]).optional(),
    teamsMode: z.enum(teamsTranscriptModes).optional(),
    inviteNotice: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
export type SaveTranscriptSettings = z.infer<typeof saveTranscriptSettingsSchema>;

/** Betriebsvereinbarung bestätigen: Datum; die Datei kommt optional als eigener Upload */
export const confirmWorksAgreementSchema = z.object({ confirmedAt: z.iso.date() }).strict();
export type ConfirmWorksAgreement = z.infer<typeof confirmWorksAgreementSchema>;

export const transcriptStatuses = ['pending', 'fetched', 'unavailable', 'deleted'] as const;

/** Stand am Termin, für den Reiter Ergebnisse */
export const meetingTranscriptStateSchema = z.object({
  /** Organisation hat Transkripte eingeschaltet (mit Betriebsvereinbarung) */
  orgEnabled: z.boolean(),
  /** „Transkript übernehmen“ an diesem Termin */
  optIn: z.boolean(),
  /** SRO oder Organisator: Opt-in schalten, Rohtext lesen, freigeben */
  canManage: z.boolean(),
  /** Datei hochladen (wie Notizen erfassen) */
  canUpload: z.boolean(),
  /** Rohtext lesen (SRO, Organisator, freigegeben auch Teilnehmer der Käuferseite) */
  canRead: z.boolean(),
  transcript: z
    .object({
      id: z.uuid(),
      source: z.enum(['teams', 'meet', 'upload']),
      status: z.enum(transcriptStatuses),
      /** Ein Satz, warum es kein Transkript gibt */
      unavailableReason: z.string().nullable(),
      durationS: z.number().int().nullable(),
      speakers: z.array(
        z.object({
          label: z.string(),
          name: z.string(),
          side: z.enum(['buyer', 'supplier', 'unknown']),
        }),
      ),
      fetchedAt: z.string().nullable(),
      deleteAfter: z.string().nullable(),
      released: z.boolean(),
    })
    .nullable(),
});
export type MeetingTranscriptState = z.infer<typeof meetingTranscriptStateSchema>;

export const transcriptEntrySchema = z.object({
  /** Sekunden ab Beginn */
  at: z.number().nonnegative(),
  speaker: z.string(),
  text: z.string(),
});
export type TranscriptEntry = z.infer<typeof transcriptEntrySchema>;

export const transcriptTextSchema = z.object({
  entries: z.array(transcriptEntrySchema),
  /** Fundstellen aus den Entwürfen (KI-17), wörtlich; die Oberfläche markiert sie */
  quotes: z.array(z.string()),
});
export type TranscriptText = z.infer<typeof transcriptTextSchema>;

export const transcriptOptInSchema = z.object({ optIn: z.boolean() }).strict();
export const transcriptReleaseSchema = z.object({ released: z.boolean() }).strict();
