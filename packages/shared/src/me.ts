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
  /**
   * Rollen, die die API im Token gefunden hat. Nur zur Anzeige auf /profil (PLT-01),
   * entschieden wird allein über can().
   */
  roles: z.array(z.enum(roles)).default([]),
  permissions: z.object({
    /** Abschnitt „Organisation“ in den Einstellungen: jedes Mitglied einer Organisation (PLT-02). */
    viewOrganizationSettings: z.boolean(),
    /**
     * Käuferbereiche (Lieferanten, Beziehungen, Puls, JBP, QBR, P&L): nur mit Feature buyer der
     * Organisation (PLT-02). Fehlt es, sieht die Person den Hinweis zum Lieferantenzugang.
     */
    viewBuyerAreas: z.boolean().default(true),
    viewSuppliers: z.boolean(),
    switchCustomer: z.boolean(),
    /** Weg zu allen Einstellungen auf /profil: nur Admins (PLT-11). */
    manageSettings: z.boolean().default(false),
  }),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
