import type { Role } from '@reziproq/shared';

/** Alles, was eine Person in Reziproq tun oder sehen kann und das nicht jede Rolle darf. */
export type Action =
  | 'lieferanten.sehen'
  | 'prompt.nutzen'
  | 'kunden.wechseln'
  | 'einstellungen.verwalten';

// Welche Rollen eine Aktion ausführen dürfen. Neue Aktionen kommen mit den Funktionen dazu.
// Name und Mitglieder der eigenen Organisation sieht jedes Mitglied (PLT-02); das hängt an der
// Zugehörigkeit, nicht an einer Rolle, und die Datenbank begrenzt es per Row-Level Security.
const allowedRoles: Record<Action, readonly Role[]> = {
  // Betreiber sehen in einem Kunden, was dessen Käufer-Rollen sehen (PLT-13).
  'lieferanten.sehen': ['admin', 'nutzer', 'leser', 'controlling', 'betreiber'],
  // Die KI arbeitet mit den Rechten der fragenden Person; die Werkzeuge prüfen erneut (PLT-12).
  'prompt.nutzen': ['admin', 'nutzer', 'leser', 'controlling', 'betreiber'],
  // Nur das Team von Reziproq, nie ein Admin eines Kunden (PLT-13).
  'kunden.wechseln': ['betreiber'],
  // Weg zu allen Einstellungen (PLT-11). Bis PLT-05 gelten die Rollen aus Zitadel.
  'einstellungen.verwalten': ['admin'],
};

/** Die einzige Stelle, an der Rechte entschieden werden. Die Oberfläche zeigt nur das Ergebnis. */
export function can(user: { roles: readonly Role[] }, action: Action): boolean {
  return user.roles.some((role) => allowedRoles[action].includes(role));
}
