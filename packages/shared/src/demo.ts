import { z } from 'zod';
import { aiModeValues } from './ai-gateway.js';
import { orgRoles } from './permissions.js';

// DM-01, E-K0-05 (K1-b.2): Demo-Sitzung je Person im Demo-Mandanten, ohne Zitadel. Nur lokal mit
// DEMO_SESSIONS=true und nie im Betrieb; außerhalb antwortet die API mit 404.

export const demoPersonSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  orgId: z.uuid(),
  orgName: z.string(),
  orgRole: z.enum(orgRoles),
  /** Käuferseite (z. B. Nordwind) oder Lieferant (z. B. Rheintal) */
  buyer: z.boolean(),
});
export type DemoPerson = z.infer<typeof demoPersonSchema>;

export const demoPersonsSchema = z.object({ persons: z.array(demoPersonSchema) });
export type DemoPersons = z.infer<typeof demoPersonsSchema>;

export const startDemoSessionSchema = z.object({ userId: z.string().min(1).max(200) }).strict();
export type StartDemoSession = z.infer<typeof startDemoSessionSchema>;

export const demoSessionSchema = z.object({
  accessToken: z.string().min(1),
  expiresAt: z.iso.datetime({ offset: true }),
  person: demoPersonSchema,
});
export type DemoSession = z.infer<typeof demoSessionSchema>;

// DM-01 (K1-g): Demo-Regie. Die Uhr rückt nur vorwärts; „Auf Datum springen“ landet um 07:30 in
// Berlin und führt unterwegs alle fälligen Läufe aus (T1-DM5). Zurücksetzen lädt den Stand „start“.

/** Stationen der Demo-Uhr aus DM-01 (Abschnitt Uhr), Ziele für „Auf Datum springen“ */
export const demoStations = [
  '2026-12-03',
  '2026-12-04',
  '2026-12-09',
  '2026-12-10',
  '2026-12-11',
  '2026-12-14',
  '2026-12-17',
  '2026-12-21',
  '2027-01-18',
  '2027-02-03',
  '2027-02-04',
  '2027-02-05',
  '2027-03-03',
] as const;

/** Läufe, die die Regie beim Vorrücken der Uhr ausführt, in dieser Reihenfolge je Zeitpunkt */
export const demoRunKeys = ['wertfinder', 'briefing', 'triage', 'hinweise'] as const;
export type DemoRunKey = (typeof demoRunKeys)[number];

export const demoTimeRequestSchema = z.discriminatedUnion('aktion', [
  z.object({ aktion: z.literal('neuer_tag') }).strict(),
  z.object({ aktion: z.literal('stunde') }).strict(),
  z.object({ aktion: z.literal('datum'), datum: z.iso.date() }).strict(),
]);
export type DemoTimeRequest = z.infer<typeof demoTimeRequestSchema>;

export const demoRunSchema = z.object({
  key: z.enum(demoRunKeys),
  at: z.iso.datetime({ offset: true }),
});
export type DemoRun = z.infer<typeof demoRunSchema>;

export const demoRegieSchema = z.object({
  demoNow: z.iso.datetime({ offset: true }),
  mode: z.enum(aiModeValues),
  /** Läufe der letzten Zeit-Aktion, für die Rückmeldung in der Regie */
  runs: z.array(demoRunSchema),
});
export type DemoRegie = z.infer<typeof demoRegieSchema>;

/**
 * Signale der Regie (DM-01), die schon laufen; jedes geht durch dieselben Dienste wie das echte
 * Ereignis im Betrieb (T1-DM4). Die übrigen kommen mit den Kapiteln, die sie brauchen.
 */
export const demoSignalKeys = ['mail_kim_kaiser'] as const;
export type DemoSignalKey = (typeof demoSignalKeys)[number];

export const demoSignalRequestSchema = z.object({ key: z.enum(demoSignalKeys) }).strict();
export type DemoSignalRequest = z.infer<typeof demoSignalRequestSchema>;

/** Ergebnis eines Signals: was der Dienst daraus gemacht hat */
export const demoSignalResultSchema = z.object({
  key: z.enum(demoSignalKeys),
  status: z.enum(['applied', 'ignored', 'rejected', 'failed']),
  objectType: z.string().nullable(),
});
export type DemoSignalResult = z.infer<typeof demoSignalResultSchema>;

/** Antworten der KI für alle Organisationen der Demo (Regie) */
export const demoModeRequestSchema = z.object({ mode: z.enum(aiModeValues) }).strict();
export type DemoModeRequest = z.infer<typeof demoModeRequestSchema>;

/** Rollen der Regie (DM-01): Personen der Geschichte, je mit eigener Demo-Sitzung */
export const demoRoles = [
  { id: 'nordwind-jan-luka', key: 'janLuka' },
  { id: 'nordwind-sara-ost', key: 'saraOst' },
  { id: 'rheintal-kim-kaiser', key: 'kimKaiser' },
] as const;
export type DemoRoleKey = (typeof demoRoles)[number]['key'];
