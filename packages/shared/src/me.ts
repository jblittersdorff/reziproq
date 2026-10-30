import { z } from 'zod';

/**
 * Rollen auf Käuferseite (PLT-11) und die Rolle des Betreiber-Teams von Reziproq (PLT-13).
 * Lieferanten-Rollen kommen mit Release 0.2.
 */
export const roles = ['admin', 'nutzer', 'leser', 'controlling', 'betreiber'] as const;
export type Role = (typeof roles)[number];

/** Die angemeldete Person, wie sie in app_user gespeichert ist, dazu ihre Rechte aus can(). */
export const meResponseSchema = z.object({
  name: z.string().min(1),
  firstName: z.string().min(1),
  email: z.email(),
  // null, solange die Person keiner Organisation zugeordnet ist (PLT-02). In der
  // Betreiber-Ansicht der gewählte Kunde (PLT-13).
  organization: z.object({ id: z.string(), name: z.string() }).nullable(),
  /** true, solange ein Betreiber in einen Kunden gewechselt ist (PLT-13). */
  supportView: z.boolean(),
  permissions: z.object({
    viewOrganizationSettings: z.boolean(),
    viewSuppliers: z.boolean(),
    switchCustomer: z.boolean(),
  }),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
