import { z } from 'zod';
import { orgRoles } from './permissions.js';

/**
 * Die angemeldete Person, wie sie in app_user gespeichert ist, mit Rolle und dem, was sie je nach
 * Organisation sehen kann. Welche Aktionen sie darf, liefert GET /api/me/permissions (PLT-05).
 */
export const meResponseSchema = z.object({
  name: z.string().min(1),
  firstName: z.string().min(1),
  email: z.email(),
  // null, solange die Person keiner Organisation zugeordnet ist (PLT-02). In der
  // Betreiber-Ansicht der gewählte Kunde (PLT-13).
  organization: z.object({ id: z.string(), name: z.string() }).nullable(),
  /** true, solange ein Betreiber in einen Kunden gewechselt ist (PLT-13). */
  supportView: z.boolean(),
  /** Rolle in der Organisation aus der Datenbank (PLT-05); null ohne Organisation. */
  orgRole: z.enum(orgRoles).nullable().default(null),
  /** Zusatzrolle Controlling (PLT-05) */
  isControlling: z.boolean().default(false),
  /** Betreiber-Team von Reziproq (PLT-13); bis UMB-01 aus dem Zitadel-Token */
  isOperator: z.boolean().default(false),
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
  }),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
