import type { Action, OrgRole } from '@reziproq/shared';

// PLT-05: Die Rechte-Matrix. Eine Zeile je Aktion: welche Rollen der Organisation sie dürfen und
// ob das Betreiber-Team von Reziproq sie darf. Daraus entsteht docs/rechte.md (pnpm rechte).
// Jede Spec ergänzt hier ihre Aktionen; der Test in permissions.test.ts prüft jede Zeile.

export interface Permission {
  /** Was die Aktion erlaubt, für docs/rechte.md */
  description: string;
  roles: readonly OrgRole[];
  /** Betreiber von Reziproq (PLT-13); im Kunden gelten sonst die Rechte eines Lesers. */
  operator?: true;
}

export const permissions: Record<Action, Permission> = {
  'organisation.sehen': {
    description: 'Organisation und Mitglieder sehen',
    roles: ['admin', 'member', 'viewer'],
  },
  'rollen.aendern': {
    description: 'Rollen, Controlling und Standardfunktion ändern',
    roles: ['admin'],
  },
  'einstellungen.verwalten': {
    description: 'Alle Einstellungen der Organisation öffnen',
    roles: ['admin'],
  },
  'lieferanten.sehen': {
    description: 'Lieferanten und Spend sehen',
    roles: ['admin', 'member', 'viewer'],
  },
  'lieferanten.bearbeiten': {
    description: 'Lieferant anlegen, ändern, beenden, Spend erfassen',
    roles: ['admin', 'member'],
  },
  'team.festlegen': {
    description: 'Team einer Beziehung festlegen',
    roles: ['admin'],
  },
  'verlauf.sehen': {
    description: 'Verlauf sehen',
    roles: ['admin', 'member', 'viewer'],
  },
  'prompt.nutzen': {
    description: 'Fragen an Reziproq stellen',
    roles: ['admin', 'member', 'viewer'],
  },
  'kunden.wechseln': {
    description: 'Als Betreiber in einen Kunden wechseln',
    roles: [],
    operator: true,
  },
};
