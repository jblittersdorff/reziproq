import { z } from 'zod';
import { orgRoles } from './permissions.js';

/** Sprachen der Oberfläche (PLT-09); gespeichert in app_user.locale. */
export const userLocales = ['de', 'en'] as const;
export type UserLocale = (typeof userLocales)[number];

/** PUT /api/me/sprache */
export const localeRequestSchema = z.object({ locale: z.enum(userLocales) });
export type LocaleRequest = z.infer<typeof localeRequestSchema>;

/**
 * POST /api/me/anmeldung: die Browsersprache für den ersten Login. Sie gilt nur, solange keine
 * Sprache gespeichert ist (PLT-09). Ohne Angabe Deutsch.
 */
export const loginRequestSchema = z.object({
  browserLocale: z.enum(userLocales).default('de'),
});
export type LoginRequest = z.output<typeof loginRequestSchema>;

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
  /** Gespeicherte Sprache (PLT-09); ohne gespeicherte Sprache Deutsch. */
  locale: z.enum(userLocales).default('de'),
  /** WG-01: eigene Bezeichnung der Warengruppe; ohne Organisation die Vorgabe */
  categoryLabel: z
    .object({ singular: z.string(), plural: z.string() })
    .default({ singular: 'Warengruppe', plural: 'Warengruppen' }),
  permissions: z.object({
    /** Abschnitt „Organisation“ in den Einstellungen: jedes Mitglied einer Organisation (PLT-02). */
    viewOrganizationSettings: z.boolean(),
    /**
     * Käuferbereiche (Lieferanten, Beziehungen, Puls, JBP, QBR, P&L): nur mit Feature buyer der
     * Organisation (PLT-02). Fehlt es, sieht die Person den Hinweis zum Lieferantenzugang.
     */
    viewBuyerAreas: z.boolean().default(true),
    viewSuppliers: z.boolean(),
    /** Kunden und ihre Arbeitsbereiche (LIF-02): Organisationen ohne Käuferfunktionen. */
    viewCustomers: z.boolean().default(false),
    switchCustomer: z.boolean(),
  }),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
