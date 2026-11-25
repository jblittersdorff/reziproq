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
  /** Nur mit der Zusatzrolle Controlling (PNL-06); die Rolle allein genügt nicht. */
  controlling?: true;
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
    description:
      'Eigenes Team einer Beziehung festlegen (Käufer: Admin oder SRO; Lieferant: Admin oder Key Account Manager)',
    roles: ['admin', 'member'],
    notForTeamViewer: true,
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
  'kontaktpunkte.sehen': {
    description: 'Kontaktpunkte einer Beziehung sehen (Lieferant nur geteilte)',
    roles: ['admin', 'member', 'viewer'],
  },
  'hinweise.sehen': {
    description: 'Hinweise auf typische Fehler im Lieferantenmanagement sehen (nur Käufer)',
    roles: ['admin', 'member', 'viewer'],
  },
  'hinweise.entscheiden': {
    description:
      'Hinweise annehmen (erzeugt eine interne Maßnahme) oder begründet verwerfen (SRO der Beziehung oder Admin)',
    roles: ['admin', 'member'],
    notForTeamViewer: true,
  },
  'hinweise.einstellen': {
    description: 'Schwellwerte der Hinweis-Regeln einstellen',
    roles: ['admin'],
  },
  'suche.nutzen': {
    description:
      'Lieferanten, Initiativen und Maßnahmen per Suchwort finden, nur im Sichtbaren (beide Seiten; Lieferant im aktuellen Kunden)',
    roles: ['admin', 'member', 'viewer'],
  },
  'warengruppen.sehen': {
    description: 'Warengruppen mit Team, Produktgruppen und Lieferanten sehen (nur Käufer)',
    roles: ['admin', 'member', 'viewer'],
  },
  'warengruppen.team': {
    description:
      'Team und Produktgruppen einer Warengruppe pflegen (Admin oder Lead der Warengruppe)',
    roles: ['admin', 'member'],
  },
  'warengruppenstrategie.bearbeiten': {
    description:
      'Warengruppenstrategie anlegen und bearbeiten (Lead und Commodity Manager alle Schritte, Einkauf im Team die Schritte 2 bis 9)',
    roles: ['admin', 'member'],
  },
  'aktivitaeten.sehen': {
    description:
      'Aktivitäten eines Lieferanten sehen: Termine, Notizen, Hinweise und Entwürfe von Reziproq (nur Käufer; private Notizen nur die Autorin)',
    roles: ['admin', 'member', 'viewer'],
  },
  'notizen.schreiben': {
    description:
      'Notizen zu einem Lieferanten schreiben, für das Team oder nur für sich; ändern und löschen nur die eigenen (nur Käufer)',
    roles: ['admin', 'member'],
  },
  'warengruppen.segmentieren': {
    description:
      'Bewertungsrunde je Warengruppe starten und das Segment in der Warengruppe festlegen (Lead, Commodity Manager, Admin)',
    roles: ['admin', 'member'],
  },
  'datenexport.anfordern': {
    description:
      'Gesamtexport aller Daten der eigenen Organisation anfordern und 24 Stunden lang herunterladen',
    roles: ['admin'],
  },
  'kommentare.schreiben': {
    description:
      'Objekte kommentieren, die man sieht, intern oder geteilt; eigene Kommentare 24 Stunden bearbeiten (beide Seiten)',
    roles: ['admin', 'member', 'viewer'],
  },
  'kontaktpunkte.bearbeiten': {
    description:
      'Kontaktpunkte anlegen, ändern, teilen und als geprüft markieren (Käufer, Admin oder Team, nicht mit Teamrolle Leser)',
    roles: ['admin', 'member'],
    notForTeamViewer: true,
  },
  'teilung.vereinbaren': {
    description:
      'Teilungsregel einer Initiative vorschlagen (Käufer: SRO oder Admin) oder bestätigen (Lieferant: Key Account Manager oder Admin)',
    roles: ['admin', 'member'],
    notForTeamViewer: true,
  },
  'eigene_sicht.bearbeiten': {
    description:
      'Als Lieferant die eigene Sicht auf einen Kunden bearbeiten (nur Lieferantenseite)',
    roles: ['admin', 'member'],
  },
  'feedback.sehen': {
    description: 'Feedback-Wellen der Beziehung mit Rücklauf je Seite sehen (beide Seiten)',
    roles: ['admin', 'member', 'viewer'],
  },
  'feedback.verwalten': {
    description:
      'Feedback-Welle starten (Käufer: Admin oder SRO), eigene Teilnehmende einladen, eigene Seite abschließen',
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
  'wirkung.sehen': {
    description: 'GuV-Wirkung der Initiativen, Baseline und Reifegrad sehen (nur Käufer)',
    roles: ['admin', 'member', 'viewer'],
  },
  'wirkung.bearbeiten': {
    description:
      'Wirkung einrichten, Baseline einfrieren, Reifegrad mit Nachweis erhöhen (nur Käufer, nicht mit Teamrolle Leser)',
    roles: ['admin', 'member'],
    notForTeamViewer: true,
  },
  'wirkung.freigeben': {
    description:
      'Wirkung freigeben oder mit Begründung zurückweisen (nur Käufer, nur mit Zusatzrolle Controlling)',
    roles: ['admin', 'member', 'viewer'],
    controlling: true,
  },
  'mein_agent.einstellen': {
    description:
      'In Mein Agent festlegen, wie viel Reziproq je Aufgabe für einen selbst tut (nur Käufer, MA-01)',
    roles: ['admin', 'member'],
  },
};
