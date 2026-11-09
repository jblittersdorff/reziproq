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
  /** Mit Teamrolle Leser an dieser Beziehung verboten, auch für Admins (PLT-05b). */
  notForTeamViewer?: true;
}

export const permissions: Record<Action, Permission> = {
  'organisation.sehen': {
    description: 'Organisation und Mitglieder sehen',
    roles: ['admin', 'member', 'viewer'],
  },
  'start.sehen': {
    description: 'Die eigene Startseite mit Aufgaben und Beziehungen sehen',
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
    description: 'Lieferant anlegen, ändern, beenden, Spend erfassen (nicht mit Teamrolle Leser)',
    roles: ['admin', 'member'],
    notForTeamViewer: true,
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
  'stammdaten.verwalten': {
    description: 'Business Units und Warengruppen anlegen, umbenennen, deaktivieren, löschen',
    roles: ['admin'],
  },
  'zuordnung.bearbeiten': {
    description: 'Lieferanten Business Units und Warengruppen zuordnen (nicht mit Teamrolle Leser)',
    roles: ['admin', 'member'],
    notForTeamViewer: true,
  },
  'segmentmodell.sehen': {
    description: 'Segmentmodell der eigenen Käuferorganisation ansehen',
    roles: ['admin', 'member', 'viewer'],
  },
  'segmentmodell.verwalten': {
    description: 'Segmentmodell der Organisation ändern und aktivieren',
    roles: ['admin'],
  },
  'runden.sehen': {
    description:
      'Bewertungsrunden ansehen (Admin alle, SRO die eigenen Lieferanten, sonst nur Einladungen)',
    roles: ['admin', 'member', 'viewer'],
  },
  'runden.verwalten': {
    description: 'Bewertungsrunde anlegen, starten, verlängern und schließen',
    roles: ['admin'],
  },
  'runden.nachnominieren': {
    description: 'Bewertende nachnominieren (Admin, SRO nur für die eigenen Lieferanten)',
    roles: ['admin', 'member'],
  },
  'bewertungen.sehen': {
    description:
      'Eigene Einladungen und die Bewertungen ansehen, die die Regeln der Runde freigeben',
    roles: ['admin', 'member', 'viewer'],
  },
  'bewertungen.abgeben': {
    description: 'Als bewertende Person Werte eintragen, Entwurf speichern und abgeben',
    roles: ['admin', 'member'],
  },
  'segmentierung.konsolidieren': {
    description: 'Ist und Soll eines Lieferanten festlegen (nur SRO der Beziehung und Admin)',
    roles: ['admin', 'member'],
  },
  'portfolio.sehen': {
    description: 'Portfolio mit Matrix und offenen Entscheidungen ansehen (nur Käufer)',
    roles: ['admin', 'member', 'viewer'],
  },
  'fokus.setzen': {
    description: 'Fokuslieferanten setzen und entfernen, mit Begründung (nur Käufer-Admin)',
    roles: ['admin'],
  },
  'zyklus.starten': {
    description:
      'Zyklus eines Fokuslieferanten starten und JBP-Termin festlegen oder verschieben (Käufer-Admin oder SRO)',
    roles: ['admin', 'member'],
    notForTeamViewer: true,
  },
  'lieferantenplan.bearbeiten': {
    description: 'Lieferantenplan verwalten und eigene zugewiesene Ziele bearbeiten',
    roles: ['admin', 'member'],
    notForTeamViewer: true,
  },
  'lieferanten.einladen': {
    description:
      'Personen des Lieferanten einladen und Einladungen zurückziehen (Admin oder SRO der Beziehung)',
    roles: ['admin', 'member'],
    notForTeamViewer: true,
  },
  'kunden.sehen': {
    description: 'Als Lieferant die eigenen Kunden und ihre Arbeitsbereiche sehen (nur Geteiltes)',
    roles: ['admin', 'member', 'viewer'],
  },
  'spielregeln.sehen': {
    description: 'Kataloge für Spielregeln und Formate und die Vorschau je Typ sehen (nur Käufer)',
    roles: ['admin', 'member', 'viewer'],
  },
  'spielregeln.verwalten': {
    description: 'Rechte, Pflichten und Formate im Katalog anlegen und ändern (nur Käufer-Admin)',
    roles: ['admin'],
  },
  'spielregeln.festlegen': {
    description:
      'Spielregeln einer Beziehung vorschlagen lassen, bearbeiten und intern freigeben (Admin oder SRO)',
    roles: ['admin', 'member'],
    notForTeamViewer: true,
  },
  'termine.sehen': {
    description: 'Termine einer Beziehung sehen, auf beiden Seiten (geteilte und eigene)',
    roles: ['admin', 'member', 'viewer'],
  },
  'termine.bearbeiten': {
    description:
      'Termine anlegen, Agenda, Protokoll, Beschlüsse und interne Notizen pflegen (nicht mit Teamrolle Leser)',
    roles: ['admin', 'member'],
    notForTeamViewer: true,
  },
  'massnahmen.sehen': {
    description:
      'Maßnahmen einer Beziehung sehen, geteilte und die eigenen internen (beide Seiten)',
    roles: ['admin', 'member', 'viewer'],
  },
  'massnahmen.bearbeiten': {
    description:
      'Maßnahmen anlegen, eigene bearbeiten und den Status ändern (nicht mit Teamrolle Leser)',
    roles: ['admin', 'member'],
    notForTeamViewer: true,
  },
  'jbp.sehen': {
    description: 'Gemeinsamen Plan und seine Vorbereitung sehen (beide Seiten)',
    roles: ['admin', 'member', 'viewer'],
  },
  'jbp.anlegen': {
    description: 'Gemeinsamen Plan anlegen, mit Termin und Agenda (Käufer: Admin oder SRO)',
    roles: ['admin', 'member'],
    notForTeamViewer: true,
  },
  'jbp.bearbeiten': {
    description: 'Eigenes Geschäftsupdate schreiben (beide Seiten, nicht mit Teamrolle Leser)',
    roles: ['admin', 'member'],
    notForTeamViewer: true,
  },
  'kunden.wechseln': {
    description: 'Als Betreiber in einen Kunden wechseln',
    roles: [],
    operator: true,
  },
};
