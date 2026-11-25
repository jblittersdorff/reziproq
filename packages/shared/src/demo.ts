import { z } from 'zod';
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
