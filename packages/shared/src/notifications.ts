import { z } from 'zod';

// IN-06: Benachrichtigungen in Teams und per Mail. Wenig, aber das Richtige: Bündel und nur Dinge
// mit Handlung. Der Lieferant bekommt keine dieser Nachrichten.

export const notificationChannels = ['teams', 'mail'] as const;
export type NotificationChannel = (typeof notificationChannels)[number];

/** Anlässe, die die Person einstellt (die Zusammenfassung des Tages heißt digest) */
export const notificationKinds = [
  'hint_high',
  'brief_ready',
  'results_ready',
  'commitment_due',
  'inbound_review',
  'meeting_reminder',
  'digest',
] as const;
export type NotificationKind = (typeof notificationKinds)[number];

export const notificationModes = ['now', 'digest', 'off'] as const;
export type NotificationMode = (typeof notificationModes)[number];

/** Startwerte aus der Spec: je Anlass Teams und Mail */
export const defaultNotificationModes: Record<
  NotificationKind,
  Record<NotificationChannel, NotificationMode>
> = {
  hint_high: { teams: 'now', mail: 'digest' },
  brief_ready: { teams: 'now', mail: 'digest' },
  results_ready: { teams: 'now', mail: 'off' },
  commitment_due: { teams: 'digest', mail: 'digest' },
  inbound_review: { teams: 'digest', mail: 'off' },
  meeting_reminder: { teams: 'now', mail: 'off' },
  // Zusammenfassung um 08:00; per Mail nur, wenn Teams aus ist
  digest: { teams: 'now', mail: 'now' },
};

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const quietHoursSchema = z.object({
  from: time,
  to: time,
  weekend: z.boolean(),
});
export type QuietHours = z.infer<typeof quietHoursSchema>;
export const defaultQuietHours: QuietHours = { from: '19:00', to: '07:00', weekend: true };

export const notificationPrefsSchema = z.object({
  modes: z.record(
    z.enum(notificationKinds),
    z.object({ teams: z.enum(notificationModes), mail: z.enum(notificationModes) }),
  ),
  quietHours: quietHoursSchema,
  /** Die Organisation hat die Teams-App freigeschaltet */
  teamsAvailable: z.boolean(),
  /** Die Person hat Teams verbunden */
  teamsLinked: z.boolean(),
  /** Mailversand für Benachrichtigungen ist in der Organisation an */
  mailEnabled: z.boolean(),
  /** Admin: darf Teams-App und Mailversand für die Organisation schalten */
  canManageOrganization: z.boolean(),
  /** Letzte Benachrichtigungen der Person, neueste zuerst (höchstens 10) */
  recent: z.array(
    z.object({
      id: z.uuid(),
      channel: z.enum(notificationChannels),
      kind: z.enum(notificationKinds),
      title: z.string(),
      status: z.enum(['queued', 'sent', 'failed', 'suppressed']),
      delivery: z.enum(['now', 'digest']),
      createdAt: z.string(),
    }),
  ),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export const saveNotificationPrefsSchema = z
  .object({
    // Nur die geänderten Anlässe; die übrigen bleiben
    modes: z
      .partialRecord(
        z.enum(notificationKinds),
        z.object({ teams: z.enum(notificationModes), mail: z.enum(notificationModes) }),
      )
      .optional(),
    quietHours: quietHoursSchema.optional(),
  })
  .strict();
export type SaveNotificationPrefs = z.infer<typeof saveNotificationPrefsSchema>;

export const saveNotificationOrgSchema = z
  .object({ teamsApp: z.boolean().optional(), mail: z.boolean().optional() })
  .strict();
export type SaveNotificationOrg = z.infer<typeof saveNotificationOrgSchema>;

/** Knopf auf einer Teams-Karte; die Aktion läuft mit den Rechten der Person */
export const notificationActions = ['agenda_uebernehmen', 'erledigt', 'zuordnen'] as const;
export const notificationActionSchema = z.object({ action: z.enum(notificationActions) }).strict();
export type NotificationAction = z.infer<typeof notificationActionSchema>;

export const notificationActionResultSchema = z.object({
  ok: z.boolean(),
  /** Text für die Karte, z. B. „Agenda übernommen“ oder warum es nicht ging */
  message: z.string(),
});
export type NotificationActionResult = z.infer<typeof notificationActionResultSchema>;
