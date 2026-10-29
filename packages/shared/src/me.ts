import { z } from 'zod';

/** Rollen auf Käuferseite (PLT-11). Lieferanten-Rollen kommen mit Release 0.2. */
export const roles = ['admin', 'nutzer', 'leser', 'controlling'] as const;
export type Role = (typeof roles)[number];

/** Die angemeldete Person, wie sie in app_user gespeichert ist, dazu ihre Rechte aus can(). */
export const meResponseSchema = z.object({
  name: z.string().min(1),
  firstName: z.string().min(1),
  email: z.email(),
  // Die Zuordnung zu einer Organisation kommt mit PLT-02; bis dahin immer null.
  organization: z.object({ id: z.string(), name: z.string() }).nullable(),
  permissions: z.object({
    viewOrganizationSettings: z.boolean(),
  }),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
