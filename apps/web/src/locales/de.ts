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
    reauthTitle: 'Bitte melde dich neu an',
    reauthDescription: 'Deine Sitzung ist abgelaufen. Was du eingegeben hast, bleibt erhalten.',
    reauthAction: 'Neu anmelden',
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
    account: 'Konto',
    roles: 'Deine Rollen in Reziproq',
    rolesDescription: 'So, wie sie im Token von Zitadel ankommen.',
    rolesNone: 'Keine',
    rolesNoneHint:
      'Zitadel schickt keine Rollen im Token. Prüfe im Zitadel-Projekt „Rollen bei Authentifizierung mitgeben“ und ob dir eine Rolle zugewiesen ist. Danach ab- und wieder anmelden.',
  },

  // Lieferantenliste (PLT-02)
  suppliers: {
    count: (count: number) => (count === 1 ? '1 Lieferant' : `${count} Lieferanten`),
    totalSpend: (amount: string, year: number) => `${amount} Jahresspend ${year}`,
    search: 'Lieferant oder Warengruppe suchen',
    searchPlaceholder: 'Name oder Warengruppe',
    sort: 'Sortieren',
    sortSpend: 'Spend, höchster zuerst',
    sortName: 'Name, A bis Z',
    country: 'Land',
    category: 'Warengruppe',
    annualSpend: (year: number) => `Jahresspend ${year}`,
    loading: 'Lieferanten werden geladen …',
    failed: 'Die Lieferanten konnten nicht geladen werden. Lade die Seite neu.',
    emptyTitle: 'Noch keine Lieferanten.',
    emptyDescription: 'Mit dem Import (kommt in Release 0.1) lädst du sie aus Excel.',
    noResults: (query: string) => `Keine Lieferanten zu „${query}“.`,
    noPermissionTitle: 'Dir fehlt eine Rolle',
    noPermissionDescription:
      'Um Lieferanten zu sehen, brauchst du in Reziproq eine Käufer-Rolle. Wende dich an deinen Admin.',
    tileNoOrganization: 'Keiner Organisation zugeordnet',
    tileNoPermission: 'Keine Rolle für Lieferanten',
    tileFailed: 'Gerade nicht geladen',
  },

  // Prompt-Fenster (PLT-12)
  prompt: {
    title: 'Frag Reziproq',
    placeholder: 'Frag Reziproq …',
    question: 'Deine Frage an Reziproq',
    send: 'Fragen',
    shortcutMac: '⌘ K',
    shortcutOther: 'Strg K',
    suggestions: 'Vorschläge',
    suggestionTopSpend: 'Zeig mir die Lieferanten mit dem höchsten Spend',
    suggestionElectronics: 'Welche Lieferanten haben wir in der Warengruppe Elektronik?',
    suggestionPulse: 'Öffne den Beziehungspuls',
    answering: 'Reziproq antwortet …',
    hits: 'Treffer',
    noHits: 'Keine Treffer',
    failed: 'Gerade keine Antwort möglich. Versuch es gleich noch einmal.',
    rateLimited: 'Du hast gerade sehr viele Fragen gestellt. Warte eine Minute.',
    restart: 'Neu beginnen',
    disclaimer: 'Antworten beruhen nur auf Daten, die du sehen darfst. Bitte prüfen.',
  },

  // Betreiber-Zugang (PLT-13)
  support: {
    switchCustomer: 'Kunde wechseln',
    dialogTitle: 'In einen Kunden wechseln',
    dialogDescription:
      'Du siehst Reziproq dann so wie dieser Kunde. Jeder Zugriff wird protokolliert.',
    loading: 'Kunden werden geladen …',
    failed: 'Die Kunden konnten nicht geladen werden.',
    empty: 'Es gibt noch keine Kunden.',
    banner: (customer: string) =>
      `Betreiber-Ansicht: ${customer}. Alle Zugriffe werden protokolliert.`,
    leave: 'Verlassen',
    chooseCustomer:
      'Du bist keiner Organisation zugeordnet. Wähle als Betreiber im Konto-Menü „Kunde wechseln“.',
  },

  organization: {
    missing: 'Du bist noch keiner Organisation zugeordnet. Wende dich an deinen Admin.',
  },

  notFound: {
    title: 'Diese Seite gibt es nicht',
    description: 'Vielleicht hat sich die Adresse geändert, oder sie enthält einen Tippfehler.',
    back: 'Zur Übersicht',
  },
};

export type Messages = typeof de;
