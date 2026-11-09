import { z } from 'zod';

// PLT-05: Rollen und Aktionen. Die Matrix (welche Rolle was darf) steht im Backend in
// apps/api/src/modules/auth/permissions.ts; daraus entsteht docs/rechte.md.

/** Rolle in der Organisation: genau eine je Nutzer, neue Nutzer sind viewer. */
export const orgRoles = ['admin', 'member', 'viewer'] as const;
export type OrgRole = (typeof orgRoles)[number];

/** Funktion einer Person, z. B. Vorgabe für Teams (PLT-05b). */
export const userFunctions = [
  'purchasing',
  'quality',
  'engineering',
  'logistics',
  'programs',
  'after_sales',
] as const;
export type UserFunction = (typeof userFunctions)[number];

/** Rolle im Team einer Beziehung (PLT-05b); Leser macht die Beziehung schreibgeschützt. */
export const teamRoles = ['sro', 'sponsor', 'member', 'viewer'] as const;
export type TeamRole = (typeof teamRoles)[number];

/** Alles, was nicht jede Rolle darf. Jede Spec ergänzt ihre Aktionen hier und in der Matrix. */
export const actions = [
  'organisation.sehen',
  'start.sehen',
  'rollen.aendern',
  'einstellungen.verwalten',
  'lieferanten.sehen',
  'lieferanten.bearbeiten',
  'team.festlegen',
  'verlauf.sehen',
  'prompt.nutzen',
  'kunden.wechseln',
  'stammdaten.verwalten',
  'zuordnung.bearbeiten',
  'segmentmodell.sehen',
  'segmentmodell.verwalten',
  'runden.sehen',
  'runden.verwalten',
  'runden.nachnominieren',
  'bewertungen.sehen',
  'bewertungen.abgeben',
  'segmentierung.konsolidieren',
  'portfolio.sehen',
  'fokus.setzen',
  'zyklus.starten',
  'lieferantenplan.bearbeiten',
  'lieferanten.einladen',
  'kunden.sehen',
  'spielregeln.sehen',
  'spielregeln.verwalten',
  'spielregeln.festlegen',
  'termine.sehen',
  'termine.bearbeiten',
  'massnahmen.sehen',
  'massnahmen.bearbeiten',
] as const;
export type Action = (typeof actions)[number];

/** GET /api/me/permissions: die Aktionen, die die Person gerade darf. */
export const permissionsResponseSchema = z.object({ actions: z.array(z.enum(actions)) });
export type PermissionsResponse = z.infer<typeof permissionsResponseSchema>;
