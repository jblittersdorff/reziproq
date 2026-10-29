// Alle Texte der App auf Deutsch. Diese Datei ist die Quelle: en.ts muss dieselben Schlüssel haben,
// sonst schlagen pnpm typecheck und der Test in locales.test.ts fehl.

export const de = {
  app: {
    name: 'Reziproq',
    navigation: 'Hauptnavigation',
    openNavigation: 'Navigation öffnen',
    closeNavigation: 'Navigation schließen',
    skipToContent: 'Zum Inhalt springen',
  },

  nav: {
    overview: 'Übersicht',
    settings: 'Einstellungen',
  },

  user: {
    menu: 'Konto-Menü',
    loading: 'Konto wird geladen …',
    failed: 'Konto nicht geladen',
    settings: 'Einstellungen',
    signOut: 'Abmelden',
  },

  auth: {
    welcome: 'Melde dich mit deinem Firmenkonto an, um deine Lieferantenbeziehungen zu öffnen.',
    signIn: 'Anmelden',
    checking: 'Anmeldung wird geprüft …',
    failedTitle: 'Anmeldung fehlgeschlagen',
    failedDescription: 'Zitadel hat die Anmeldung nicht bestätigt. Versuche es noch einmal.',
    retry: 'Erneut anmelden',
    notConfiguredTitle: 'Login ist noch nicht eingerichtet',
    notConfiguredDescription:
      'Trage ZITADEL_ISSUER und ZITADEL_CLIENT_ID in die .env ein und starte die App neu.',
    backHome: 'Zur Übersicht',
  },

  comingWith: (release: string) => `Kommt mit Release ${release}`,

  overview: {
    title: 'Übersicht',
    greetingMorning: (firstName: string) => `Guten Morgen, ${firstName}`,
    greetingDay: (firstName: string) => `Guten Tag, ${firstName}`,
    greetingEvening: (firstName: string) => `Guten Abend, ${firstName}`,
    greetingWithoutName: 'Willkommen bei Reziproq',
    areas: 'Bereiche',
  },

  // Titel, Satz auf Kachel und Bereichsseite, und was auf der Seite entsteht (PLT-11).
  areas: {
    suppliers: {
      title: 'Lieferanten',
      sentence:
        'Welche Lieferanten wirklich zählen – nach Business Impact und Beziehungsqualität, nicht nur nach Spend.',
      emptyDescription:
        'Hier entsteht die Segmentierung deiner Lieferanten nach Business Impact und Beziehungsqualität.',
    },
    relationships: {
      title: 'Beziehungen',
      sentence:
        'Rechte und Pflichten je Beziehungstyp, Rollen und Ansprechpartner auf beiden Seiten.',
      emptyDescription:
        'Hier entstehen die Playbooks je Beziehungstyp mit Rollen und Ansprechpartnern auf beiden Seiten.',
    },
    pulse: {
      title: 'Beziehungspuls',
      sentence: 'Wie beide Seiten die Beziehung sehen – heute und gewünscht.',
      emptyDescription:
        'Hier entsteht der Puls, mit dem Käufer und Lieferant die Beziehung regelmäßig einschätzen.',
    },
    jointBusinessPlans: {
      title: 'Joint Business Plans',
      sentence: 'Gemeinsame Ziele, Initiativen und KPIs mit strategischen Lieferanten.',
      emptyDescription:
        'Hier entstehen gemeinsame Pläne mit Zielen, Initiativen und KPIs für strategische Lieferanten.',
    },
    qbrs: {
      title: 'QBRs und Maßnahmen',
      sentence: 'Fortschritt regelmäßig prüfen, Zusagen nachhalten, Maßnahmen steuern.',
      emptyDescription:
        'Hier entstehen die Quartalsgespräche mit Fortschritt, Zusagen und Maßnahmen.',
    },
    pnlImpact: {
      title: 'P&L-Impact',
      sentence: 'Welcher Wert aus der Zusammenarbeit in der GuV ankommt – belegt und freigegeben.',
      emptyDescription:
        'Hier entsteht der Nachweis, welche Initiativen welche GuV-Zeile bewegen, bis zur Freigabe durch Controlling.',
    },
  },

  settings: {
    title: 'Einstellungen',
    purpose: 'Reziproq so einstellen, wie es für dich passt.',
    display: 'Darstellung',
    theme: 'Erscheinungsbild',
    themeDescription: 'System folgt der Einstellung deines Geräts.',
    themeSystem: 'System',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    organization: 'Organisation',
    organizationTitle: 'Noch nichts einzustellen',
    organizationDescription:
      'Hier verwaltest du später deine Organisation. Nur Admins sehen diesen Abschnitt.',
  },

  notFound: {
    title: 'Diese Seite gibt es nicht',
    description: 'Vielleicht hat sich die Adresse geändert, oder sie enthält einen Tippfehler.',
    back: 'Zur Übersicht',
  },
};

export type Messages = typeof de;
