import type { Role } from '@reziproq/shared';

/** Alles, was eine Person in Reziproq tun oder sehen kann und das nicht jede Rolle darf. */
export type Action = 'organisation.einstellungen.sehen' | 'lieferanten.sehen' | 'prompt.nutzen';

// Welche Rollen eine Aktion ausführen dürfen. Neue Aktionen kommen mit den Funktionen dazu.
const allowedRoles: Record<Action, readonly Role[]> = {
  'organisation.einstellungen.sehen': ['admin'],
  'lieferanten.sehen': ['admin', 'nutzer', 'leser', 'controlling'],
  // Die KI arbeitet mit den Rechten der fragenden Person; die Werkzeuge prüfen erneut (PLT-12).
  'prompt.nutzen': ['admin', 'nutzer', 'leser', 'controlling'],
};

/** Die einzige Stelle, an der Rechte entschieden werden. Die Oberfläche zeigt nur das Ergebnis. */
export function can(user: { roles: readonly Role[] }, action: Action): boolean {
  return user.roles.some((role) => allowedRoles[action].includes(role));
}
